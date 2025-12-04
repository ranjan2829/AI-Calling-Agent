import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Divider,
  LinearProgress,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack,
  Assessment,
  PlayArrow,
  Person,
  WorkOutline,
  CheckCircle,
  Cancel,
  ExpandMore,
  QuestionAnswer,
  Analytics,
  Phone,
  Schedule,
  CalendarToday
} from '@mui/icons-material';
import { callsApi } from '../api/services';
import { toast } from 'react-toastify';

interface InterviewResponse {
  question_number: number;
  question: string;
  answer: string;
  timestamp: string;
  duration?: string;
}

interface InterviewData {
  interview_id: string;
  status: string;
  questions_answered: number;
  total_questions: number;
  completion_rate: string;
  start_time: string;
  end_time?: string;
  responses: InterviewResponse[];
  candidate_phone?: string;
  candidate_name?: string;
  phone_number?: string;
  interviewer?: string;
}

interface JDAnalysis {
  job_title: string;
  company: string;
  skill_match_percentage: number;
  overall_score?: number;
  found_skills: string[];
  missing_skills: string[];
  recommendation: string;
  total_required_skills: number;
  analysis_date: string;
  experience_match_percentage?: number;
  candidate_metadata?: {
    phone?: string;
    email?: string;
    source?: string;
  };
}
export const InterviewDetails: React.FC = () => {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [jdAnalysis, setJDAnalysis] = useState<JDAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  useEffect(() => {
    if (interviewId) {
      loadInterviewDetails();
      loadJDAnalysis();
    }
  }, [interviewId]);

  const loadInterviewDetails = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading interview details for:', interviewId);
      const response = await callsApi.getInterviewDetails(interviewId!);
      
      if (response.data && !response.data.error) {
        console.log('✅ Interview details loaded:', response.data);
        console.log('📞 Phone data check:', {
          candidate_phone: response.data.candidate_phone,
          phone_number: response.data.phone_number,
          candidate_name: response.data.candidate_name
        });
        setInterviewData(response.data);
      } else {
        setError('Interview not found or no data available');
      }
    } catch (error: any) {
      console.error('❌ Error loading interview details:', error);
      setError('Failed to load interview details');
    } finally {
      setLoading(false);
    }
  };
  const loadJDAnalysis = async () => {
    try {
      console.log('🔍 Loading JD analysis for:', interviewId);
      const response = await callsApi.getJDReport(interviewId!);
      if (response.data && !response.data.error) {
        console.log('✅ JD Analysis loaded:', response.data.candidate_analysis);
        setJDAnalysis(response.data.candidate_analysis);
      }
    } catch (error) {
      console.log('⚠️ JD Analysis not available for this interview');
    }
  };

  const handleRunAnalysis = async (interview: InterviewData) => {
    try {
      setRunningAnalysis(true);
      console.log('🔄 Running JD analysis for interview:', interview.interview_id);
      const analysisResponse = await callsApi.runJDAnalysis();
      console.log('📊 JD Analysis response:', analysisResponse.data);
      setTimeout(async () => {
        try {
          const reportResponse = await callsApi.getJDReport(interview.interview_id);
          
          if (reportResponse.data && !reportResponse.data.error) {
            const report = reportResponse.data;
            console.log('✅ Analysis report received:', report);
            setJDAnalysis({
              job_title: report.candidate_analysis.job_title,
              company: report.candidate_analysis.company,
              skill_match_percentage: report.candidate_analysis.skill_match_percentage || report.candidate_analysis.skills_match_percentage || 0,
              overall_score: report.candidate_analysis.overall_score,
              found_skills: report.candidate_analysis.found_skills || report.candidate_analysis.matched_skills || [],
              missing_skills: report.candidate_analysis.missing_skills || [],
              recommendation: report.candidate_analysis.recommendation,
              total_required_skills: (report.candidate_analysis.found_skills?.length || 0) + (report.candidate_analysis.missing_skills?.length || 0),
              analysis_date: report.analysis_created || new Date().toISOString(),
              experience_match_percentage: report.candidate_analysis.experience_match_percentage,
              candidate_metadata: report.candidate_analysis.candidate_metadata
            });
            
            toast.success('JD Analysis completed successfully!');
          } else {
            throw new Error(reportResponse.data?.error || 'Failed to get analysis report');
          }
        } catch (error: any) {
          console.error('❌ Error getting analysis report:', error);
          toast.error(`Analysis failed: ${error.message || 'Unknown error'}`);
        }
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Analysis error:', error);
      toast.error(`Analysis failed: ${error.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => {
        setRunningAnalysis(false);
      }, 3500);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'FAILED': return 'error';
      default: return 'default';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    if (recommendation.includes('EXCELLENT')) return 'success';
    if (recommendation.includes('STRONG')) return 'success';
    if (recommendation.includes('GOOD')) return 'info';
    if (recommendation.includes('MODERATE')) return 'warning';
    return 'error';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const calculateDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    return `${diffMins} minutes`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>🔄 Loading interview details...</Typography>
      </Box>
    );
  }

  if (error || !interviewData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Interview data not found'}
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/history')}
        >
          Back to History
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>~
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/history')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            📋 Interview Details
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Interview ID: {interviewData.interview_id}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Interview ID: {interviewData.interview_id}
          </Typography>
          <Box sx={{ mt: 1, p: 1, backgroundColor: 'yellow', border: '1px solid red' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              DEBUG - Phone Info:
            </Typography>
            <Typography variant="body2">
              candidate_phone: {JSON.stringify(interviewData.candidate_phone)}
            </Typography>
            <Typography variant="body2">
              phone_number: {JSON.stringify(interviewData.phone_number)}
            </Typography>
            <Typography variant="body2">
              candidate_name: {JSON.stringify(interviewData.candidate_name)}
            </Typography>
          </Box>
          {(interviewData.candidate_phone || interviewData.phone_number) ? (
            <Typography variant="body1" sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Phone sx={{ fontSize: 16, mr: 0.5 }} />
              Phone: {interviewData.candidate_phone || interviewData.phone_number}
            </Typography>
          ) : (
            <Typography variant="body1" sx={{ color: 'error.main', mt: 0.5 }}>
              ⚠️ No phone number found in interview data
            </Typography>
          )}
        </Box>
        {!jdAnalysis && (
          <Button
            variant="contained"
            startIcon={runningAnalysis ? <CircularProgress size={20} /> : <Analytics />}
            onClick={() => handleRunAnalysis(interviewData)}
            disabled={runningAnalysis}
          >
            {runningAnalysis ? 'Running Analysis...' : 'Run JD Analysis'}
          </Button>
        )}
      </Box>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Status</Typography>
              </Box>
              <Chip
                label={interviewData.status}
                color={getStatusColor(interviewData.status)}
                size="medium"
              />
              {interviewData.candidate_name && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 'medium' }}>
                  {interviewData.candidate_name}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <QuestionAnswer sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Progress</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                {interviewData.questions_answered}/{interviewData.total_questions}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(interviewData.questions_answered / interviewData.total_questions) * 100}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Completion</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {Math.round((interviewData.questions_answered / interviewData.total_questions) * 100)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Schedule sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Duration</Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {calculateDuration(interviewData.start_time, interviewData.end_time)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Started: {formatDateTime(interviewData.start_time)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {jdAnalysis && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <WorkOutline sx={{ mr: 1 }} />
              Job Description Match Analysis
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Overall Score: {jdAnalysis.overall_score || jdAnalysis.skill_match_percentage}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={jdAnalysis.overall_score || jdAnalysis.skill_match_percentage}
                    sx={{ mb: 2, height: 8, borderRadius: 4 }}
                    color={(jdAnalysis.overall_score || jdAnalysis.skill_match_percentage) >= 70 ? 'success' : 
                           (jdAnalysis.overall_score || jdAnalysis.skill_match_percentage) >= 50 ? 'info' : 'warning'}
                  />
                  
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Skills Match: {jdAnalysis.skill_match_percentage}%
                  </Typography>
                  {jdAnalysis.experience_match_percentage && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Experience Match: {jdAnalysis.experience_match_percentage}%
                    </Typography>
                  )}
                  
                  <Chip
                    label={jdAnalysis.recommendation}
                    color={getRecommendationColor(jdAnalysis.recommendation)}
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Position: {jdAnalysis.job_title} at {jdAnalysis.company}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Skills Analysis
                  </Typography>
                  {jdAnalysis.found_skills.length > 0 && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <CheckCircle sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />
                      Found Skills ({jdAnalysis.found_skills.length}): {jdAnalysis.found_skills.join(', ')}
                    </Typography>
                  )}
                  {jdAnalysis.missing_skills.length > 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      <Cancel sx={{ fontSize: 16, color: 'error.main', mr: 0.5 }} />
                      Missing Skills ({jdAnalysis.missing_skills.length}): {jdAnalysis.missing_skills.join(', ')}
                    </Typography>
                  )}
                  {jdAnalysis.candidate_metadata?.phone && (
                    <Typography variant="body2" sx={{ color: 'info.main', mt: 1 }}>
                      <Phone sx={{ fontSize: 16, mr: 0.5 }} />
                      Contact: {jdAnalysis.candidate_metadata.phone}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                    Analysis Date: {new Date(jdAnalysis.analysis_date).toLocaleString()}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            💬 Interview Questions & Responses
          </Typography>
          
          {interviewData.responses.length === 0 ? (
            <Alert severity="info">
              No responses recorded for this interview yet.
            </Alert>
          ) : (
            <Box>
              {interviewData.responses.map((response, index) => (
                <Accordion key={index} defaultExpanded={index === 0}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                        Question {response.question_number}: {response.question}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={new Date(response.timestamp).toLocaleTimeString()}
                        variant="outlined"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ pl: 2, borderLeft: 3, borderColor: 'primary.main' }}>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        <strong>Answer:</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        backgroundColor: 'grey.50', 
                        p: 2, 
                        borderRadius: 1,
                        fontStyle: response.answer ? 'normal' : 'italic',
                        color: response.answer ? 'text.primary' : 'text.secondary'
                      }}>
                        {response.answer || 'No response recorded'}
                      </Typography>
                      
                      {response.duration && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                          Response Duration: {response.duration}
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};