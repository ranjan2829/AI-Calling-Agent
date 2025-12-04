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
  ai_verdict: string;
  ai_verdict_reason: string;
}

// AI Verdict Generator Function
const generateAIVerdict = (data: {
  overall_score: number;
  skills_percentage: number;
  validation_score: number;
  completion_rate: number;
  found_skills: number;
  responses: any[];
  validation_results: any;
}): { verdict: string; reason: string } => {
  const { overall_score, skills_percentage, validation_score, completion_rate, found_skills, responses, validation_results } = data;
  
  // Calculate response quality
  const avgConfidence = responses.length > 0
    ? responses.reduce((sum: number, r: any) => sum + (r.confidence || 0.5), 0) / responses.length
    : 0.5;
  const responseQuality = Math.round(avgConfidence * 100);
  
  // Check validation results
  const availabilityCheck = validation_results?.["0"]?.passed;
  const skillsCheck = validation_results?.["2"]?.passed;
  const noticeCheck = validation_results?.["3"]?.passed;
  const salaryCheck = validation_results?.["4"]?.passed;
  
  // Comprehensive scoring
  let verdictScore = 0;
  let reasons: string[] = [];
  
  // Overall score weight (40%)
  verdictScore += (overall_score / 100) * 40;
  if (overall_score >= 80) reasons.push('High overall performance');
  else if (overall_score < 50) reasons.push('Low overall score');
  
  // Skills match weight (25%)
  verdictScore += (skills_percentage / 100) * 25;
  if (skills_percentage >= 70) reasons.push('Strong skills match');
  else if (skills_percentage < 40) reasons.push('Weak skills alignment');
  
  // Validation score weight (20%)
  verdictScore += (validation_score / 100) * 20;
  if (validation_score >= 80) reasons.push('Passed key validations');
  else if (validation_score < 50) reasons.push('Failed critical checks');
  
  // Completion rate weight (10%)
  verdictScore += (completion_rate / 100) * 10;
  if (completion_rate >= 90) reasons.push('Complete interview');
  else if (completion_rate < 60) reasons.push('Incomplete responses');
  
  // Response quality weight (5%)
  verdictScore += (responseQuality / 100) * 5;
  if (responseQuality >= 80) reasons.push('Clear communication');
  else if (responseQuality < 60) reasons.push('Unclear responses');
  
  const finalScore = Math.round(verdictScore);
  
  // Generate verdict
  let verdict: string;
  let reason: string;
  
  if (finalScore >= 85 && availabilityCheck && skillsCheck && completion_rate >= 85) {
    verdict = 'STRONG HIRE';
    reason = `Exceptional candidate with ${overall_score}% score, ${skills_percentage}% skills match, and strong validation results. Highly recommended for immediate consideration.`;
  } else if (finalScore >= 70 && availabilityCheck && skillsCheck) {
    verdict = 'RECOMMENDED';
    reason = `Solid candidate with ${overall_score}% score and ${skills_percentage}% skills alignment. Meets key requirements and shows good potential.`;
  } else if (finalScore >= 55 && (availabilityCheck || skillsCheck)) {
    verdict = 'CONSIDER';
    reason = `Moderate fit with ${overall_score}% score. Some gaps in skills (${skills_percentage}%) or requirements. May need additional evaluation.`;
  } else if (finalScore >= 40) {
    verdict = 'MAYBE';
    reason = `Below average performance (${overall_score}% score). Limited skills match (${skills_percentage}%). Consider only if no better candidates available.`;
  } else {
    verdict = 'NOT RECOMMENDED';
    reason = `Low score (${overall_score}%) and weak skills alignment (${skills_percentage}%). Does not meet minimum requirements. Not recommended for this role.`;
  }
  
  return { verdict, reason };
};

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
      console.log('Contact mappings loaded, now loading interviews...');
      loadInterviewData();
    } else {
      const timer = setTimeout(() => {
        console.log('Loading interviews without mappings (timeout fallback)');
        loadInterviewData();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [contactMappings]);

  const loadContactMappings = async () => {
    try {
      console.log('Loading contact mappings from backend...');
      const response = await callsApi.getContactMappings();
      console.log('Backend response:', response);
      
      if (response.success && response.mappings && Object.keys(response.mappings).length > 0) {
        setContactMappings(response.mappings);
        console.log('Contact mappings loaded successfully:', Object.keys(response.mappings).length);

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
            console.log(`Found mapping for ${callId}: ${name} (${phone})`);
          } else {
            console.log(`No mapping found for ${callId}`);
          }
        });
      } else {
        console.log('No contact mappings received from backend');
        setContactMappings({});
      }
    } catch (error) {
      console.error('Error loading contact mappings:', error);
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
    
    return Array.from(new Set(foundSkills));
  };
  const loadInterviewData = async () => {
    try {
      setLoading(true);
      console.log('Loading interview data with', Object.keys(contactMappings).length, 'contact mappings available');
      
      const interviewsResponse = await callsApi.getAllInterviewsDetailed();
      const allInterviews = interviewsResponse.data.interviews || [];
      console.log('📋 Raw interviews loaded:', allInterviews.length, 'interviews');

      const validInterviews = allInterviews.filter((interview: any) => {
        const callId = interview.call_sid || interview.interview_id;
        const responses = interview.responses || [];
        return callId && responses.length > 0;
      });
      
        console.log('Valid interviews after filtering:', validInterviews.length);
      
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
            console.log(`Using candidate_name: ${candidateName}`);
          }
          if (contactMapping.candidate_phone) {
            phoneNumber = contactMapping.candidate_phone;
            console.log(`Using candidate_phone: ${phoneNumber}`);
          }
          
          // Check nested candidate_data
          if (contactMapping.candidate_data) {
            if (contactMapping.candidate_data.name && !contactMapping.candidate_name) {
              candidateName = contactMapping.candidate_data.name;
              console.log(`Using candidate_data.name: ${candidateName}`);
            }
            if (contactMapping.candidate_data.phone && !contactMapping.candidate_phone) {
              phoneNumber = contactMapping.candidate_data.phone;
              console.log(`Using candidate_data.phone: ${phoneNumber}`);
            }
          }
        } else {
          console.log(`No mapping found for ${callId} in contact mappings`);
          
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
            // FIX: Use proper JavaScript regex syntax instead of Python r"..." strings
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
                  console.log(`Extracted name from intro: ${candidateName}`);
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
        
        console.log(`FINAL for ${callId}: Name="${candidateName}" | Phone="${phoneNumber}"`);
        
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

        // AI Verdict Analysis
        const completionRateNum = parseInt(completion_rate.replace('%', '')) || 0;
        const aiVerdict = generateAIVerdict({
          overall_score,
          skills_percentage,
          validation_score,
          completion_rate: completionRateNum,
          found_skills: found_skills.length,
          responses: safeInterview.responses,
          validation_results: safeInterview.validation_results
        });

        return {
          ...safeInterview,
          overall_score,
          skills_percentage,
          found_skills,
          recommendation,
          interview_duration,
          completion_rate,
          ai_verdict: aiVerdict.verdict,
          ai_verdict_reason: aiVerdict.reason
        };
      });
      
      const sortedInterviews = processedInterviews.sort((a: ProcessedInterview, b: ProcessedInterview) => {
        if (a.overall_score !== b.overall_score) {
          return b.overall_score - a.overall_score;
        }
        return b.skills_percentage - a.skills_percentage;
      });
    
      console.log('Final interviews with real names:', sortedInterviews.slice(0, 5).map((i: ProcessedInterview) => ({ 
        name: i.candidate_name, 
        phone: i.candidate_phone, 
        id: i.call_sid 
      })));
      
      setInterviews(sortedInterviews);
    
    } catch (error) {
      console.error('Error loading interview data:', error);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 UPDATE: Re-process interviews when contact mappings are loaded
  useEffect(() => {
    if (Object.keys(contactMappings).length > 0 && interviews.length > 0) {
      console.log('Re-processing interviews with contact mappings...');
      loadInterviewData();
    }
  }, [contactMappings]);

  const runJDAnalysis = async () => {
    try {
      setAnalyzing(true);
      console.log('Running Interview Analysis...');
      const response = await callsApi.runJDAnalysis();
      
      if (response.data.error) {
        toast.error(`Analysis failed: ${response.data.error}`);
      } else {
        toast.success('Interview Analysis completed successfully!');
        console.log('Interview Analysis completed, refreshing data...');
        setTimeout(() => {
          loadInterviewData();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Interview Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRecommendationColor = (recommendation: string): 'success' | 'primary' | 'warning' | 'error' => {
    if (recommendation.includes('EXCELLENT')) return 'success';
    if (recommendation.includes('STRONG')) return 'success';
    if (recommendation.includes('GOOD')) return 'primary';
    if (recommendation.includes('MODERATE')) return 'success';
    if (recommendation.includes('INTERVIEW COMPLETED')) return 'success';
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
        <CircularProgress sx={{ color: '#6366f1' }} />
        <Typography sx={{ ml: 2, color: '#f5f5f5' }}>Loading all interview results...</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: '#f5f5f5', fontSize: '1.125rem' }}>
          Interview Results & Candidate Analysis
        </Typography>
        <Typography variant="body2" sx={{ color: '#a3a3a3', fontSize: '0.75rem' }}>
          Comprehensive interview evaluation with detailed candidate responses and validation results
        </Typography>
      </Box>

      <Card sx={{ 
        mb: 1, 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        backgroundColor: 'rgba(17, 17, 17, 0.7)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.25, color: '#f5f5f5', fontSize: '0.9375rem' }}>
                Interview Analysis
              </Typography>
              <Typography variant="body2" sx={{ color: '#a3a3a3', fontSize: '0.75rem' }}>
                Analyze interview responses and generate comprehensive candidate reports
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <Assessment />}
              onClick={runJDAnalysis}
              disabled={analyzing}
              sx={{
                backgroundColor: '#6366f1',
                color: '#ffffff',
                py: 0.75,
                px: 1.5,
                '&:hover': { backgroundColor: '#4f46e5' }
              }}
            >
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Card sx={{ 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        backgroundColor: 'rgba(17, 17, 17, 0.7)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#f5f5f5', fontSize: '0.9375rem' }}>
            Candidate List ({interviews.length} total)
          </Typography>
          
          {interviews.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 1.5, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6' }}>
              No interview results available. Complete interviews and run analysis to see results here.
            </Alert>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ backgroundColor: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}><strong>Rank</strong></TableCell>
                    <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}><strong>Candidate Details</strong></TableCell>
                    <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}><strong>Score</strong></TableCell>
                    <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}><strong>Skills</strong></TableCell>
                    <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}><strong>Duration</strong></TableCell>
                    <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}><strong>AI Verdict</strong></TableCell>
                    <TableCell align="right" sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.8125rem', py: 1 }}><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {interviews.map((interview, index) => {
                    const safeCallSid = interview.call_sid || `unknown_${index}`;
                    const safeCandidateName = interview.candidate_name || 'Unknown Candidate';
                    const safeCandidatePhone = (interview.candidate_phone && interview.candidate_phone !== 'No Phone Available') 
                      ? interview.candidate_phone 
                      : '';
                    
                    return (
                      <React.Fragment key={safeCallSid}>
                        <TableRow sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' }, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                          <TableCell sx={{ color: '#f5f5f5', py: 1, fontSize: '0.75rem' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              #{index + 1}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: '#f5f5f5', py: 1, fontSize: '0.75rem' }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', mb: 0.25, fontSize: '0.8125rem' }}>
                                <Person sx={{ fontSize: 16, mr: 0.75, color: '#6366f1' }} />
                                {safeCandidateName}
                              </Typography>
                              {safeCandidatePhone && (
                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', color: '#a3a3a3', mb: 0.25, fontSize: '0.75rem' }}>
                                  <Phone sx={{ fontSize: 12, mr: 0.75 }} />
                                  {safeCandidatePhone}
                                </Typography>
                              )}
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#a3a3a3', fontSize: '0.7rem' }}>
                                ID: {safeCallSid.slice(-8)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: '#f5f5f5', py: 1, fontSize: '0.75rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                                {interview.overall_score}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: '#f5f5f5', py: 1, fontSize: '0.75rem' }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium', fontSize: '0.8125rem' }}>
                                {Math.round(interview.skills_percentage)}% Match
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#a3a3a3', fontSize: '0.7rem' }}>
                                {interview.found_skills.length} skills found
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: '#f5f5f5', py: 1, fontSize: '0.75rem' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                              {interview.interview_duration}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <Chip
                              label={interview.ai_verdict || 'PENDING'}
                              size="small"
                              sx={{ 
                                borderRadius: 1.5,
                                height: 24,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  interview.ai_verdict === 'STRONG HIRE' ? 'rgba(16, 185, 129, 0.15)' :
                                  interview.ai_verdict === 'RECOMMENDED' ? 'rgba(34, 197, 94, 0.15)' :
                                  interview.ai_verdict === 'CONSIDER' ? 'rgba(245, 158, 11, 0.15)' :
                                  interview.ai_verdict === 'MAYBE' ? 'rgba(251, 146, 60, 0.15)' :
                                  'rgba(239, 68, 68, 0.15)',
                                color: 
                                  interview.ai_verdict === 'STRONG HIRE' ? '#10b981' :
                                  interview.ai_verdict === 'RECOMMENDED' ? '#22c55e' :
                                  interview.ai_verdict === 'CONSIDER' ? '#f59e0b' :
                                  interview.ai_verdict === 'MAYBE' ? '#fb923c' :
                                  '#ef4444',
                                border: `1px solid ${
                                  interview.ai_verdict === 'STRONG HIRE' ? '#10b981' :
                                  interview.ai_verdict === 'RECOMMENDED' ? '#22c55e' :
                                  interview.ai_verdict === 'CONSIDER' ? '#f59e0b' :
                                  interview.ai_verdict === 'MAYBE' ? '#fb923c' :
                                  '#ef4444'
                                }`
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                              <IconButton
                                size="small"
                                onClick={() => toggleRowExpansion(safeCallSid)}
                                sx={{ color: '#a3a3a3', p: 0.5, '&:hover': { color: '#6366f1' } }}
                              >
                                {expandedRows.has(safeCallSid) ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                              <Button
                                size="small"
                                onClick={() => downloadReport(interview)}
                                startIcon={<CloudDownload />}
                                sx={{ 
                                  color: '#6366f1', 
                                  borderColor: 'rgba(99, 102, 241, 0.3)',
                                  fontSize: '0.75rem',
                                  py: 0.5,
                                  px: 1,
                                  '&:hover': { 
                                    borderColor: '#6366f1',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)'
                                  }
                                }}
                                variant="outlined"
                              >
                                Report
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Details Row */}
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                            <Collapse in={expandedRows.has(safeCallSid)} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 1, p: 1.5, backgroundColor: 'rgba(17, 17, 17, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 2 }}>
                                <Typography variant="h6" gutterBottom sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', pb: 0.75, mb: 1.5, color: '#f5f5f5', fontSize: '0.9375rem' }}>
                                  Detailed Analysis: {safeCandidateName}
                                </Typography>
                                
                                {/* AI Verdict Section */}
                                {interview.ai_verdict && (
                                  <Box sx={{ mb: 1.5, p: 1.25, backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 1.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75, color: '#f5f5f5', fontSize: '0.8125rem', display: 'flex', alignItems: 'center' }}>
                                      <Assessment sx={{ mr: 0.75, fontSize: 18, color: '#6366f1' }} />
                                      AI Verdict: {interview.ai_verdict}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#a3a3a3', fontSize: '0.75rem', lineHeight: 1.6 }}>
                                      {interview.ai_verdict_reason}
                                    </Typography>
                                  </Box>
                                )}
                                
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 1.5 }}>
                                  {/* Skills Analysis */}
                                  <Box sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', p: 1.25, backgroundColor: 'rgba(17, 17, 17, 0.3)', borderRadius: 1.5 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', color: '#f5f5f5', fontSize: '0.875rem' }}>
                                      <Assessment sx={{ mr: 1, fontSize: 18, color: '#6366f1' }} />
                                      Skills & Capabilities
                                    </Typography>
                                    
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.25, color: '#f5f5f5', fontSize: '0.75rem' }}>Found Skills:</Typography>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {interview.found_skills.length > 0 ? (
                                          interview.found_skills.map((skill, skillIndex) => (
                                            <Chip
                                              key={skillIndex}
                                              label={skill}
                                              size="small"
                                              variant="outlined"
                                              sx={{ borderRadius: 1.5, borderColor: 'rgba(99, 102, 241, 0.3)', color: '#6366f1', fontSize: '0.7rem', height: 22 }}
                                            />
                                          ))
                                        ) : (
                                          <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#a3a3a3', fontSize: '0.75rem' }}>No specific technical skills identified</Typography>
                                        )}
                                      </Box>
                                    </Box>

                                    <Typography variant="body2" sx={{ color: '#a3a3a3', fontSize: '0.75rem' }}>
                                      <strong style={{ color: '#f5f5f5' }}>Score Breakdown:</strong><br/>
                                      Skills Match: {interview.skills_percentage}%<br/>
                                      Validation Pass Rate: {interview.overall_score}%
                                    </Typography>
                                  </Box>

                                  {/* Validation Results */}
                                  <Box sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', p: 1.25, backgroundColor: 'rgba(17, 17, 17, 0.3)', borderRadius: 1.5 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', color: '#f5f5f5', fontSize: '0.875rem' }}>
                                      <CheckCircle sx={{ mr: 1, fontSize: 18, color: '#10b981' }} />
                                      Validation Steps
                                    </Typography>
                                    
                                    {Object.entries(interview.validation_results || {}).length === 0 ? (
                                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#a3a3a3', fontSize: '0.8125rem' }}>
                                        No automated validation steps recorded
                                      </Typography>
                                    ) : (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {Object.entries(interview.validation_results || {}).map(([key, validation]) => (
                                          <Box key={key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255, 255, 255, 0.1)', pb: 0.5 }}>
                                            <Typography variant="body2" sx={{ color: '#f5f5f5', fontSize: '0.8125rem' }}>
                                              Step {validation?.step || key}
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                              <Typography variant="body2" sx={{ mr: 1, fontWeight: 'bold', color: validation?.passed ? '#10b981' : '#ef4444', fontSize: '0.8125rem' }}>
                                                {validation?.passed ? 'PASS' : 'FAIL'}
                                              </Typography>
                                              {getValidationIcon(validation?.passed || false)}
                                            </Box>
                                          </Box>
                                        ))}
                                      </Box>
                                    )}
                                  </Box>

                                  {/* Full Responses */}
                                  <Box sx={{ gridColumn: '1 / -1', border: '1px solid rgba(255, 255, 255, 0.1)', p: 1.25, backgroundColor: 'rgba(17, 17, 17, 0.3)', borderRadius: 1.5 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#f5f5f5', fontSize: '0.875rem' }}>
                                      Interview Transcript
                                    </Typography>
                                    
                                    {(interview.responses || []).length === 0 ? (
                                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#a3a3a3', fontSize: '0.75rem' }}>
                                        No transcript available
                                      </Typography>
                                    ) : (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {(interview.responses || []).map((response, responseIndex) => (
                                          <Box key={responseIndex} sx={{ pl: 1.25, borderLeft: '2px solid #6366f1' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#a3a3a3', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                              Question {response?.question_number || responseIndex + 1}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.25, color: '#f5f5f5', fontSize: '0.75rem' }}>
                                              {response?.question || 'Question not available'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#a3a3a3', fontSize: '0.75rem' }}>
                                              "{response?.answer || 'No answer provided'}"
                                            </Typography>
                                          </Box>
                                        ))}
                                      </Box>
                                    )}
                                  </Box>
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
