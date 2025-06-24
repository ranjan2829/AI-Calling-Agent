import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Assessment,
  CloudDownload,
  ExpandMore,
  ExpandLess,
  Phone,
  Person,
  CheckCircle,
  Cancel,
  Schedule,
  LocationOn,
  AttachMoney
} from '@mui/icons-material';
import { callsApi } from '../api/services';
import { toast } from 'react-toastify';

interface InterviewData {
  call_sid?: string;
  phone_number?: string;
  twilio_number?: string;
  start_time?: string;
  status?: string;
  current_question?: number;
  responses?: Array<{
    question?: string;
    answer?: string;
    confidence?: number;
    timestamp?: string;
    question_number?: number;
  }>;
  validation_results?: {
    [key: string]: {
      step?: number;
      passed?: boolean;
      reason?: string;
      skills_match?: boolean;
      found_skills?: string[];
      match_percentage?: number;
      relocation_willing?: boolean;
      onsite_available?: boolean;
      notice_acceptable?: boolean;
      notice_days?: number;
    };
  };
  silence_prompts?: number;
  last_activity?: string;
  candidate_name?: string;
  candidate_phone?: string;
  candidate_data?: string;
  bulk_call_id?: string;
  is_bulk_call?: boolean;
  end_time?: string;
  completion_time?: string;
}

interface ProcessedInterview extends InterviewData {
  overall_score: number;
  skills_percentage: number;
  found_skills: string[];
  recommendation: string;
  interview_duration: string;
  completion_rate: string;
}

export const InterviewResults: React.FC = () => {
  const [interviews, setInterviews] = useState<ProcessedInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInterviewData();
  }, []);

  const extractSkillsFromText = (text: string): string[] => {
    const skillKeywords = [
      'python', 'java', 'javascript', 'typescript', 'react', 'node.js', 'nodejs',
      'angular', 'vue', 'html', 'css', 'sql', 'mongodb', 'mysql', 'postgresql',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'git', 'jenkins',
      'machine learning', 'deep learning', 'data science', 'artificial intelligence',
      'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn',
      'spring', 'django', 'flask', 'express', 'restapi', 'graphql',
      'microservices', 'devops', 'ci/cd', 'linux', 'bash'
    ];
    
    const foundSkills: string[] = [];
    const lowerText = text.toLowerCase();
    
    skillKeywords.forEach(skill => {
      if (lowerText.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });
    
    return [...new Set(foundSkills)]; // Remove duplicates
  };

  const loadInterviewData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading all interview data...');
      
      // Get all interviews with detailed information
      const interviewsResponse = await callsApi.getAllInterviewsDetailed();
      const allInterviews = interviewsResponse.data.interviews || [];
      
      console.log('📋 Raw interviews loaded:', allInterviews.length, 'interviews');
      console.log('📊 Sample interview data:', allInterviews[0]);
      
      // Filter out invalid interviews and process valid ones
      const validInterviews = allInterviews.filter((interview: InterviewData) => {
        // Skip test/invalid candidates
        const skipPatterns = ['My_Name', 'Test Candidate', 'Unknown', 'Ohh', 'BULK'];
        const candidateName = interview.candidate_name || '';
        
        if (skipPatterns.some(pattern => candidateName.includes(pattern))) {
          return false;
        }
        
        // Must have responses and valid call_sid
        return interview.responses && 
               interview.responses.length > 0 && 
               interview.call_sid && 
               interview.status === 'COMPLETED';
      });
      
      console.log('✅ Valid interviews after filtering:', validInterviews.length);
      
      // Process each interview to extract meaningful data
      const processedInterviews = validInterviews.map((interview: InterviewData) => {
        console.log('🔍 Processing interview:', interview.call_sid);
        
        // Safe data extraction with proper fallbacks
        const safeInterview = {
          call_sid: interview.call_sid || 'unknown',
          phone_number: interview.phone_number || interview.candidate_phone || 'Unknown',
          candidate_name: interview.candidate_name || 'Unknown Candidate',
          candidate_phone: interview.candidate_phone || interview.phone_number || 'Unknown',
          twilio_number: interview.twilio_number || 'Unknown',
          start_time: interview.start_time || new Date().toISOString(),
          end_time: interview.end_time,
          status: interview.status || 'Unknown',
          current_question: interview.current_question || 1,
          responses: interview.responses || [],
          validation_results: interview.validation_results || {},
          ...interview
        };

        // Extract all text from responses for skills analysis
        const allResponseText = safeInterview.responses
          .map(r => r.answer || '')
          .join(' ');
        
        // Use skills detection from validation results OR extract from text
        let found_skills: string[] = [];
        let skills_percentage = 0;
        
        // First try to get from validation results
        const skillsValidation = safeInterview.validation_results?.["2"];
        if (skillsValidation && skillsValidation.found_skills) {
          found_skills = skillsValidation.found_skills;
          skills_percentage = skillsValidation.match_percentage || 0;
        } else {
          // Fallback: extract skills from response text
          found_skills = extractSkillsFromText(allResponseText);
          // Calculate percentage based on job requirements (assume python is required)
          const requiredSkills = ['python']; // You can make this dynamic
          skills_percentage = requiredSkills.length > 0 
            ? (found_skills.filter(skill => requiredSkills.includes(skill.toLowerCase())).length / requiredSkills.length) * 100
            : 0;
        }

        // Calculate overall score based on validation results
        const validationResults = Object.values(safeInterview.validation_results || {});
        const passedValidations = validationResults.filter(v => v?.passed).length;
        const totalValidations = Math.max(validationResults.length, 1);
        const validation_score = Math.round((passedValidations / totalValidations) * 100);
        
        // Combine validation score with skills percentage for overall score
        const overall_score = Math.round((validation_score * 0.6) + (skills_percentage * 0.4));
        
        // Calculate interview duration
        const startTime = new Date(safeInterview.start_time);
        const endTime = safeInterview.end_time ? new Date(safeInterview.end_time) : new Date();
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        const interview_duration = `${Math.max(0, durationMinutes)} min`;
        
        // Calculate completion rate based on actual responses
        const totalQuestions = 7;
        const answeredQuestions = safeInterview.responses.length;
        const completion_rate = `${Math.round((answeredQuestions / totalQuestions) * 100)}%`;
        
        // Generate recommendation based on scores and skills
        let recommendation = 'NEEDS REVIEW';
        if (overall_score >= 80 && skills_percentage >= 70) {
          recommendation = 'EXCELLENT FIT';
        } else if (overall_score >= 70 && skills_percentage >= 60) {
          recommendation = 'STRONG CANDIDATE';
        } else if (overall_score >= 60 && skills_percentage >= 50) {
          recommendation = 'GOOD CANDIDATE';
        } else if (overall_score >= 50) {
          recommendation = 'MODERATE FIT';
        }
        
        console.log(`📊 Processed interview for ${safeInterview.candidate_name}:`, {
          call_sid: safeInterview.call_sid,
          overall_score,
          skills_percentage,
          found_skills,
          validation_score,
          passedValidations,
          totalValidations,
          recommendation
        });
        
        return {
          ...safeInterview,
          overall_score,
          skills_percentage,
          found_skills,
          recommendation,
          interview_duration,
          completion_rate
        };
      });
      
      // Sort by overall score first, then skills percentage (highest first)
      const sortedInterviews = processedInterviews.sort((a, b) => {
        if (a.overall_score !== b.overall_score) {
          return b.overall_score - a.overall_score;
        }
        return b.skills_percentage - a.skills_percentage;
      });
      
      console.log('✅ Final sorted interviews:', sortedInterviews);
      setInterviews(sortedInterviews);
      
    } catch (error) {
      console.error('❌ Error loading interview data:', error);
      toast.error('Failed to load interview data');
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  const runJDAnalysis = async () => {
    try {
      setAnalyzing(true);
      console.log('🔄 Running Interview Analysis...');
      const response = await callsApi.runJDAnalysis();
      
      if (response.data.error) {
        toast.error(`Analysis failed: ${response.data.error}`);
      } else {
        toast.success('Interview Analysis completed successfully!');
        console.log('✅ Interview Analysis completed, refreshing data...');
        
        // Refresh data after analysis
        setTimeout(() => {
          loadInterviewData();
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Interview Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRecommendationColor = (recommendation: string): 'success' | 'primary' | 'warning' | 'error' => {
    if (recommendation.includes('EXCELLENT')) return 'success';
    if (recommendation.includes('STRONG')) return 'success';
    if (recommendation.includes('GOOD')) return 'primary';
    if (recommendation.includes('MODERATE')) return 'warning';
    return 'error';
  };

  const toggleRowExpansion = (callId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(callId)) {
      newExpanded.delete(callId);
    } else {
      newExpanded.add(callId);
    }
    setExpandedRows(newExpanded);
  };

  const downloadReport = (interview: ProcessedInterview) => {
    try {
      const reportData = JSON.stringify(interview, null, 2);
      const blob = new Blob([reportData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Safe filename generation
      const safeName = (interview.candidate_name || 'unknown').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const safeCallSid = (interview.call_sid || 'unknown').slice(-8);
      a.download = `interview_report_${safeName}_${safeCallSid}.json`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Interview report downloaded successfully');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const getValidationIcon = (passed: boolean) => {
    return passed ? 
      <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} /> : 
      <Cancel sx={{ color: 'error.main', fontSize: 16 }} />;
  };

  const getConfidenceLevel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    if (confidence >= 0.3) return 'Low';
    return 'Very Low';
  };

  const getConfidenceColor = (confidence: number): 'success' | 'info' | 'warning' | 'error' => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'info';
    if (confidence >= 0.3) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>🔄 Loading all interview results...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
          📋 Interview Results & Candidate Analysis
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Comprehensive interview evaluation with detailed candidate responses and validation results
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                📊 Interview Analysis
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Analyze interview responses and generate comprehensive candidate reports
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={analyzing ? <CircularProgress size={20} /> : <Assessment />}
              onClick={runJDAnalysis}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing...' : 'Run Interview Analysis'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            📞 Interview Results ({interviews.length} candidates with detailed analysis)
          </Typography>
          
          {interviews.length === 0 ? (
            <Alert severity="info">
              No interview results available. Complete interviews and run analysis to see results here.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Rank</strong></TableCell>
                    <TableCell><strong>📞 Contact Info</strong></TableCell>
                    <TableCell><strong>👤 Candidate Details</strong></TableCell>
                    <TableCell><strong>📊 Overall Score</strong></TableCell>
                    <TableCell><strong>🎯 Skills Match</strong></TableCell>
                    <TableCell><strong>⏱️ Interview Info</strong></TableCell>
                    <TableCell><strong>✅ Recommendation</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {interviews.map((interview, index) => {
                    // Extra safety for rendering
                    const safeCallSid = interview.call_sid || `unknown_${index}`;
                    const safeCandidateName = interview.candidate_name || 'Unknown Candidate';
                    const safeCandidatePhone = interview.candidate_phone || interview.phone_number || 'Unknown';
                    
                    return (
                      <React.Fragment key={safeCallSid}>
                        <TableRow>
                          <TableCell>
                            <Chip 
                              label={`#${index + 1}`} 
                              color="primary"
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Phone sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
                                {safeCandidatePhone}
                              </Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                ID: {safeCallSid.slice(-8)}
                              </Typography>
                              <br />
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                Twilio: {interview.twilio_number || 'Unknown'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium', display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Person sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                                {safeCandidateName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Status: {interview.status || 'Unknown'}
                              </Typography>
                              <br />
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Completion: {interview.completion_rate}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CircularProgress
                                variant="determinate"
                                value={interview.overall_score}
                                size={40}
                                sx={{ mr: 1 }}
                                color={
                                  interview.overall_score >= 70 ? 'success' :
                                  interview.overall_score >= 50 ? 'info' : 'warning'
                                }
                              />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                  {interview.overall_score}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Overall
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CircularProgress
                                variant="determinate"
                                value={interview.skills_percentage}
                                size={30}
                                sx={{ mr: 1 }}
                                color={interview.skills_percentage >= 70 ? 'success' : interview.skills_percentage >= 50 ? 'info' : 'warning'}
                              />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                  {Math.round(interview.skills_percentage)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {interview.found_skills.length} skills
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium', display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                <Schedule sx={{ fontSize: 14, mr: 0.5 }} />
                                {interview.interview_duration}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Questions: {interview.responses?.length || 0}/7
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={interview.recommendation}
                              color={getRecommendationColor(interview.recommendation)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => toggleRowExpansion(safeCallSid)}
                              >
                                {expandedRows.has(safeCallSid) ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                              <Button
                                size="small"
                                onClick={() => downloadReport(interview)}
                                startIcon={<CloudDownload />}
                              >
                                Download
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Details Row */}
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                            <Collapse in={expandedRows.has(safeCallSid)} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                                  📋 Detailed Analysis for {safeCandidateName}
                                </Typography>
                                
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                                  {/* Contact Information */}
                                  <Card variant="outlined">
                                    <CardContent>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                                        <Phone sx={{ mr: 1 }} />
                                        Contact Information
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        📞 Phone: {safeCandidatePhone}
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 1 }}>
                                        📞 Twilio: {interview.twilio_number || 'Unknown'}
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 1 }}>🆔 Call ID: {safeCallSid}</Typography>
                                      {interview.start_time && (
                                        <Typography variant="body2" sx={{ mb: 1 }}>📅 Started: {new Date(interview.start_time).toLocaleString()}</Typography>
                                      )}
                                      <Typography variant="body2">⏱️ Duration: {interview.interview_duration}</Typography>
                                    </CardContent>
                                  </Card>

                                  {/* Skills Analysis */}
                                  <Card variant="outlined">
                                    <CardContent>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        🎯 Skills Analysis
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 1 }}>
                                        Skills Match: {interview.skills_percentage}%
                                      </Typography>
                                      <Typography variant="body2" sx={{ mb: 2 }}>
                                        Overall Score: {interview.overall_score}%
                                      </Typography>
                                      <Box sx={{ mt: 1 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                          Found Skills ({interview.found_skills.length}):
                                        </Typography>
                                        <Box sx={{ mt: 0.5 }}>
                                          {interview.found_skills.length > 0 ? (
                                            interview.found_skills.map((skill, skillIndex) => (
                                              <Chip
                                                key={skillIndex}
                                                label={skill}
                                                size="small"
                                                sx={{ mr: 0.5, mb: 0.5 }}
                                                color="success"
                                              />
                                            ))
                                          ) : (
                                            <Chip label="No skills identified" size="small" variant="outlined" />
                                          )}
                                        </Box>
                                      </Box>
                                    </CardContent>
                                  </Card>

                                  {/* Validation Results */}
                                  <Card variant="outlined">
                                    <CardContent>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        ✅ Validation Results
                                      </Typography>
                                      {Object.entries(interview.validation_results || {}).length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                          No validation results available
                                        </Typography>
                                      ) : (
                                        Object.entries(interview.validation_results || {}).map(([key, validation]) => (
                                          <Box key={key} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            {getValidationIcon(validation?.passed || false)}
                                            <Typography variant="body2" sx={{ ml: 1 }}>
                                              Step {validation?.step || key}: {validation?.passed ? 'Passed' : 'Failed'}
                                            </Typography>
                                            {validation?.match_percentage && (
                                              <Chip 
                                                label={`${validation.match_percentage}%`} 
                                                size="small" 
                                                sx={{ ml: 1 }}
                                                color="info"
                                              />
                                            )}
                                          </Box>
                                        ))
                                      )}
                                    </CardContent>
                                  </Card>

                                  {/* Interview Responses */}
                                  <Card variant="outlined" sx={{ gridColumn: 'span 2' }}>
                                    <CardContent>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                                        🗣️ Interview Responses ({(interview.responses || []).length} answers)
                                      </Typography>
                                      {(interview.responses || []).length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                          No responses recorded
                                        </Typography>
                                      ) : (
                                        (interview.responses || []).map((response, responseIndex) => (
                                          <Box key={responseIndex} sx={{ mb: 2, p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                              Q{response?.question_number || responseIndex + 1}: {response?.question || 'Question not available'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                                              "{response?.answer || 'No answer provided'}"
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                              <Chip 
                                                label={`Confidence: ${getConfidenceLevel(response?.confidence || 0)}`}
                                                size="small"
                                                color={getConfidenceColor(response?.confidence || 0)}
                                              />
                                              {response?.timestamp && (
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                  Answered: {new Date(response.timestamp).toLocaleTimeString()}
                                                </Typography>
                                              )}
                                            </Box>
                                          </Box>
                                        ))
                                      )}
                                    </CardContent>
                                  </Card>
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};