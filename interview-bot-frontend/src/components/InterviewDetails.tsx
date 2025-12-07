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
  skills_match_percentage?: number;
  overall_score?: number;
  found_skills: string[];
  missing_skills: string[];
  recommendation: string;
  total_required_skills: number;
  analysis_date: string;
  experience_match_percentage?: number;
  openai_verdict?: string;
  openai_verdict_reason?: string;
  candidate_metadata?: {
    phone?: string;
    email?: string;
    source?: string;
  };
}
export const InterviewDetails: React.FC = () => {
  const params = useParams<{ interviewId?: string; id?: string }>();
  const interviewId = params.interviewId || params.id;
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
              skills_match_percentage: report.candidate_analysis.skills_match_percentage || report.candidate_analysis.skill_match_percentage || 0,
              overall_score: report.candidate_analysis.overall_score,
              found_skills: report.candidate_analysis.found_skills || report.candidate_analysis.matched_skills || [],
              missing_skills: report.candidate_analysis.missing_skills || [],
              recommendation: report.candidate_analysis.recommendation,
              total_required_skills: (report.candidate_analysis.found_skills?.length || 0) + (report.candidate_analysis.missing_skills?.length || 0),
              analysis_date: report.analysis_created || new Date().toISOString(),
              experience_match_percentage: report.candidate_analysis.experience_match_percentage,
              openai_verdict: report.candidate_analysis.openai_verdict,
              openai_verdict_reason: report.candidate_analysis.openai_verdict_reason,
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/history')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            📋 Interview Details
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
            Interview ID: {interviewData.interview_id}
          </Typography>
          {interviewData.candidate_name && (
            <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 'medium', mb: 0.5 }}>
              Candidate: {interviewData.candidate_name}
            </Typography>
          )}
          {(interviewData.candidate_phone || interviewData.phone_number) ? (
            <Typography variant="body1" sx={{ color: 'primary.main', fontWeight: 'bold', display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Phone sx={{ fontSize: 16, mr: 0.5 }} />
              Phone: {interviewData.candidate_phone || interviewData.phone_number}
            </Typography>
          ) : null}
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
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Overall Match Score
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                    {jdAnalysis.overall_score || jdAnalysis.skill_match_percentage || 0}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={jdAnalysis.overall_score || jdAnalysis.skill_match_percentage || 0}
                    sx={{ mb: 2, height: 10, borderRadius: 4 }}
                    color={(jdAnalysis.overall_score || jdAnalysis.skill_match_percentage || 0) >= 70 ? 'success' : 
                           (jdAnalysis.overall_score || jdAnalysis.skill_match_percentage || 0) >= 50 ? 'info' : 'warning'}
                  />
                  
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Skills Match:</strong> {jdAnalysis.skill_match_percentage || jdAnalysis.skills_match_percentage || 0}%
                  </Typography>
                  {jdAnalysis.experience_match_percentage && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      <strong>Experience Match:</strong> {jdAnalysis.experience_match_percentage}%
                    </Typography>
                  )}
                  
                  <Chip
                    label={jdAnalysis.recommendation}
                    color={getRecommendationColor(jdAnalysis.recommendation)}
                    sx={{ mb: 2, fontWeight: 'bold' }}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Skills Analysis
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, color: 'success.main' }}>
                    <CheckCircle sx={{ fontSize: 16, mr: 0.5 }} />
                    <strong>Found ({jdAnalysis.found_skills.length}/{jdAnalysis.total_required_skills || jdAnalysis.found_skills.length + jdAnalysis.missing_skills.length}):</strong>
                  </Typography>
                  {jdAnalysis.found_skills.length > 0 ? (
                    <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {jdAnalysis.found_skills.map((skill, idx) => (
                        <Chip key={idx} label={skill} size="small" color="success" sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      No skills matched
                    </Typography>
                  )}
                  
                  {jdAnalysis.missing_skills.length > 0 && (
                    <>
                      <Typography variant="body2" sx={{ mb: 1, color: 'error.main' }}>
                        <Cancel sx={{ fontSize: 16, mr: 0.5 }} />
                        <strong>Missing ({jdAnalysis.missing_skills.length}):</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {jdAnalysis.missing_skills.map((skill, idx) => (
                          <Chip key={idx} label={skill} size="small" color="error" sx={{ fontSize: '0.7rem' }} />
                        ))}
                      </Box>
                    </>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.3)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center' }}>
                    <Box component="span" sx={{ mr: 1, fontSize: '1.5rem' }}>🤖</Box>
                    AI Verdict
                  </Typography>
                  {jdAnalysis.openai_verdict && jdAnalysis.openai_verdict !== 'N/A' ? (
                    <>
                      <Chip
                        label={jdAnalysis.openai_verdict}
                        sx={{ 
                          mb: 2, 
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          height: 32,
                          backgroundColor: 
                            jdAnalysis.openai_verdict === 'STRONG HIRE' ? 'rgba(16, 185, 129, 0.3)' :
                            jdAnalysis.openai_verdict === 'RECOMMENDED' ? 'rgba(34, 197, 94, 0.3)' :
                            jdAnalysis.openai_verdict === 'CONSIDER' ? 'rgba(245, 158, 11, 0.3)' :
                            jdAnalysis.openai_verdict === 'MAYBE' ? 'rgba(251, 146, 60, 0.3)' :
                            'rgba(239, 68, 68, 0.3)',
                          color:
                            jdAnalysis.openai_verdict === 'STRONG HIRE' ? '#10b981' :
                            jdAnalysis.openai_verdict === 'RECOMMENDED' ? '#22c55e' :
                            jdAnalysis.openai_verdict === 'CONSIDER' ? '#f59e0b' :
                            jdAnalysis.openai_verdict === 'MAYBE' ? '#fb923c' :
                            '#ef4444',
                          border: `2px solid ${
                            jdAnalysis.openai_verdict === 'STRONG HIRE' ? '#10b981' :
                            jdAnalysis.openai_verdict === 'RECOMMENDED' ? '#22c55e' :
                            jdAnalysis.openai_verdict === 'CONSIDER' ? '#f59e0b' :
                            jdAnalysis.openai_verdict === 'MAYBE' ? '#fb923c' :
                            '#ef4444'
                          }`
                        }}
                      />
                      {jdAnalysis.openai_verdict_reason && (
                        <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.primary', fontStyle: 'italic', lineHeight: 1.6 }}>
                            "{jdAnalysis.openai_verdict_reason}"
                          </Typography>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        ⚠️ OpenAI verdict not available
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Make sure OPENAI_API_KEY is set in backend .env file
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
                    Analysis Date: {new Date(jdAnalysis.analysis_date).toLocaleString()}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      <Card sx={{ backgroundColor: 'rgba(17, 17, 17, 0.5)' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#f5f5f5' }}>
            💬 Interview Questions & Responses
          </Typography>
          
          {interviewData.responses.length === 0 ? (
            <Alert severity="info">
              No responses recorded for this interview yet.
            </Alert>
          ) : (
            <Box>
              {interviewData.responses.map((response, index) => (
                <Accordion 
                  key={index} 
                  defaultExpanded={index === 0}
                  sx={{ 
                    backgroundColor: 'rgba(17, 17, 17, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 1,
                    mb: 1,
                    '&:before': { display: 'none' }
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMore sx={{ color: '#f5f5f5' }} />}
                    sx={{ 
                      '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flexGrow: 1, color: '#f5f5f5' }}>
                        Question {response.question_number}: {response.question}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={new Date(response.timestamp).toLocaleTimeString()}
                        variant="outlined"
                        sx={{ 
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: '#a3a3a3'
                        }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ pl: 2, borderLeft: 3, borderColor: 'primary.main' }}>
                      <Typography variant="body1" sx={{ mb: 2, color: '#f5f5f5' }}>
                        <strong>Answer:</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        backgroundColor: 'rgba(17, 17, 17, 0.6)', 
                        p: 2, 
                        borderRadius: 1,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontStyle: response.answer ? 'normal' : 'italic',
                        color: response.answer ? '#f5f5f5' : '#a3a3a3',
                        lineHeight: 1.6,
                        wordBreak: 'break-word'
                      }}>
                        {response.answer || 'No response recorded'}
                      </Typography>
                      
                      {response.duration && (
                        <Typography variant="caption" sx={{ color: '#a3a3a3', mt: 1, display: 'block' }}>
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