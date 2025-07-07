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
  const [contactMappings, setContactMappings] = useState<{[key: string]: any}>({});

  useEffect(() => {
    loadContactMappings();
  }, []);
  useEffect(() => {
    if (Object.keys(contactMappings).length > 0) {
      console.log('🔄 Contact mappings loaded, now loading interviews...');
      loadInterviewData();
    } else {
      const timer = setTimeout(() => {
        console.log('⏰ Loading interviews without mappings (timeout fallback)');
        loadInterviewData();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [contactMappings]);

  const loadContactMappings = async () => {
    try {
      console.log('🔄 Loading contact mappings from backend...');
      const response = await callsApi.getContactMappings();
      console.log('📡 Backend response:', response);
      
      if (response.success && response.mappings && Object.keys(response.mappings).length > 0) {
        setContactMappings(response.mappings);
        console.log('✅ Contact mappings loaded successfully:', Object.keys(response.mappings).length);

        const testCallIds = [
          'CA5f0e20a83a4524369b15adb814e96172',
          'CAd16e725703b0659f3bfd074a4b078ae7',
          'CAdba6aaa07c7ed7effd7998b6b9645798'
        ];
        
        testCallIds.forEach(callId => {
          const mapping = response.mappings[callId];
          if (mapping) {
            const name = mapping.candidate_name || mapping.candidate_data?.name || 'No Name';
            const phone = mapping.candidate_phone || mapping.candidate_data?.phone || 'No Phone';
            console.log(`🎯 Found mapping for ${callId}: ${name} (${phone})`);
          } else {
            console.log(`❌ No mapping found for ${callId}`);
          }
        });
      } else {
        console.log('⚠️ No contact mappings received from backend');
        setContactMappings({});
      }
    } catch (error) {
      console.error('❌ Error loading contact mappings:', error);
      setContactMappings({});
    }
  };

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
    
    return [...new Set(foundSkills)];
  };
  const loadInterviewData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading interview data with', Object.keys(contactMappings).length, 'contact mappings available');
      
      const interviewsResponse = await callsApi.getAllInterviewsDetailed();
      const allInterviews = interviewsResponse.data.interviews || [];
      console.log('📋 Raw interviews loaded:', allInterviews.length, 'interviews');

      const validInterviews = allInterviews.filter((interview: any) => {
        const callId = interview.call_sid || interview.interview_id;
        const responses = interview.responses || [];
        return callId && responses.length > 0;
      });
      
      console.log('✅ Valid interviews after filtering:', validInterviews.length);
      
      const processedInterviews = validInterviews.map((interview: any) => {
        const callId = interview.call_sid || interview.interview_id || 'unknown';
        console.log(`🔍 Processing interview: ${callId}`);

        // 🔥 ENHANCED MAPPING LOGIC - Check both formats
        let candidateName = `Unknown Candidate`;
        let phoneNumber = 'No Phone Available';
        
        // Priority 1: Check contact mappings
        const contactMapping = contactMappings[callId];
        if (contactMapping) {
          console.log(`📋 Found mapping data for ${callId}:`, contactMapping);
          
          // Check direct fields first
          if (contactMapping.candidate_name) {
            candidateName = contactMapping.candidate_name;
            console.log(`✅ Using candidate_name: ${candidateName}`);
          }
          if (contactMapping.candidate_phone) {
            phoneNumber = contactMapping.candidate_phone;
            console.log(`✅ Using candidate_phone: ${phoneNumber}`);
          }
          
          // Check nested candidate_data
          if (contactMapping.candidate_data) {
            if (contactMapping.candidate_data.name && !contactMapping.candidate_name) {
              candidateName = contactMapping.candidate_data.name;
              console.log(`✅ Using candidate_data.name: ${candidateName}`);
            }
            if (contactMapping.candidate_data.phone && !contactMapping.candidate_phone) {
              phoneNumber = contactMapping.candidate_data.phone;
              console.log(`✅ Using candidate_data.phone: ${phoneNumber}`);
            }
          }
        } else {
          console.log(`❌ No mapping found for ${callId} in contact mappings`);
          
          // Priority 2: Check interview data directly
          if (interview.candidate_name && interview.candidate_name !== 'Unknown') {
            candidateName = interview.candidate_name;
            console.log(`📝 Using interview.candidate_name: ${candidateName}`);
          }
          if (interview.candidate_phone && interview.candidate_phone !== 'Unknown') {
            phoneNumber = interview.candidate_phone;
            console.log(`📝 Using interview.candidate_phone: ${phoneNumber}`);
          }
          
          // Priority 3: Extract from responses
          const responses = interview.responses || [];
          if (responses.length > 0 && candidateName === 'Unknown Candidate') {
            const introText = responses[0].answer || '';
            // 🔥 FIX: Use proper JavaScript regex syntax instead of Python r"..." strings
            const namePatterns = [
              /(?:my name is|i'?m|i am|this is)\s+([a-zA-Z][a-zA-Z\s]{1,25})/i,
              /^([a-zA-Z][a-zA-Z\s]{1,25}?)(?:\s+speaking|\s+here|\s*$)/i
            ];
            
            for (const pattern of namePatterns) {
              const match = introText.match(pattern);
              if (match) {
                const extractedName = match[1].trim();
                if (extractedName.length > 2 && !extractedName.toLowerCase().includes('from')) {
                  candidateName = extractedName;
                  console.log(`🎯 Extracted name from intro: ${candidateName}`);
                  break;
                }
              }
            }
          }
        }
        
        // Final fallback if still no good name
        if (candidateName === 'Unknown Candidate' || candidateName.includes('Candidate_')) {
          const phoneDigits = phoneNumber.replace(/\D/g, '').slice(-4);
          candidateName = phoneDigits ? `Candidate_${phoneDigits}` : `ID_${callId.slice(-8)}`;
        }
        
        console.log(`📊 FINAL for ${callId}: Name="${candidateName}" | Phone="${phoneNumber}"`);
        
        // Build safe interview object
        const safeInterview = {
          call_sid: callId,
          phone_number: phoneNumber,
          candidate_name: candidateName,
          candidate_phone: phoneNumber,
          candidate_email: interview.candidate_email || contactMapping?.candidate_email || '',
          candidate_experience: interview.candidate_experience || contactMapping?.candidate_experience || '',
          candidate_skills: interview.candidate_skills || contactMapping?.candidate_skills || '',
          twilio_number: interview.twilio_number || '+14787807480',
          start_time: interview.start_time || new Date().toISOString(),
          end_time: interview.end_time,
          status: interview.status || 'COMPLETED',
          current_question: interview.current_question || interview.questions_answered || 7,
          responses: interview.responses || [],
          validation_results: interview.validation_results || {},
          is_bulk_call: interview.is_bulk_call || contactMapping?.is_bulk_call || false,
          bulk_call_id: interview.bulk_call_id || contactMapping?.bulk_call_id || null,
          ...interview
        };

        const allResponseText = safeInterview.responses
          .map((r: any) => r.answer || '')
          .join(' ');
        
        let found_skills: string[] = [];
        let skills_percentage = 0;
        const skillsValidation = safeInterview.validation_results?.["2"];
        if (skillsValidation && skillsValidation.found_skills) {
          found_skills = skillsValidation.found_skills;
          skills_percentage = skillsValidation.match_percentage || 0;
        } else {
          found_skills = extractSkillsFromText(allResponseText);
          const commonRequiredSkills = ['python', 'javascript', 'java', 'react', 'node'];
          skills_percentage = commonRequiredSkills.length > 0 
            ? (found_skills.filter(skill => 
                commonRequiredSkills.some(req => 
                  req.toLowerCase().includes(skill.toLowerCase()) || 
                  skill.toLowerCase().includes(req.toLowerCase())
                )).length / commonRequiredSkills.length) * 100
            : found_skills.length > 0 ? 50 : 0;
        }
        
        const validationResults = Object.values(safeInterview.validation_results || {});
        const passedValidations = validationResults.filter((v: any) => v?.passed).length;
        const totalValidations = Math.max(validationResults.length, 1);
        const validation_score = Math.round((passedValidations / totalValidations) * 100);
        const overall_score = validationResults.length > 0 
          ? Math.round((validation_score * 0.6) + (skills_percentage * 0.4))
          : Math.round(skills_percentage);
        
        const startTime = new Date(safeInterview.start_time);
        const endTime = safeInterview.end_time ? new Date(safeInterview.end_time) : new Date();
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        const interview_duration = `${Math.max(0, durationMinutes)} min`;
        
        const totalQuestions = 7;
        const answeredQuestions = safeInterview.responses.length;
        const completion_rate = `${Math.round((answeredQuestions / totalQuestions) * 100)}%`;
        
        // Simple recommendation logic
        let recommendation = 'INTERVIEW COMPLETED';
        if (overall_score >= 80) {
          recommendation = 'EXCELLENT FIT';
        } else if (overall_score >= 60) {
          recommendation = 'GOOD CANDIDATE';
        } else if (overall_score >= 40) {
          recommendation = 'MODERATE FIT';
        }

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
      
      const sortedInterviews = processedInterviews.sort((a, b) => {
        if (a.overall_score !== b.overall_score) {
          return b.overall_score - a.overall_score;
        }
        return b.skills_percentage - a.skills_percentage;
      });
    
      console.log('🎯 Final interviews with real names:', sortedInterviews.slice(0, 5).map(i => ({ 
        name: i.candidate_name, 
        phone: i.candidate_phone, 
        id: i.call_sid 
      })));
      
      setInterviews(sortedInterviews);
    
    } catch (error) {
      console.error('❌ Error loading interview data:', error);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 UPDATE: Re-process interviews when contact mappings are loaded
  useEffect(() => {
    if (Object.keys(contactMappings).length > 0 && interviews.length > 0) {
      console.log('🔄 Re-processing interviews with contact mappings...');
      loadInterviewData();
    }
  }, [contactMappings]);

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
                    // 🔥 UPDATED: Use the processed data directly
                    const safeCallSid = interview.call_sid || `unknown_${index}`;
                    const safeCandidateName = interview.candidate_name || 'Unknown Candidate';
                    const safeCandidatePhone = interview.candidate_phone || interview.phone_number || 'No Phone Available';
                    
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
                                {/* 🔥 Show real phone number */}
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
                                {/* 🔥 Show real candidate name */}
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