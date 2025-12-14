import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogContent,
  DialogActions,
  Divider,
  Tab,
  Tabs,
  InputAdornment
} from '@mui/material';
import {
  Phone,
  Save,
  CheckCircle,
  People,
  PlayArrow,
  Stop,
  Error as ErrorIcon,
  CloudUpload,
  PhoneInTalk,
  QuestionAnswer
} from '@mui/icons-material';
import { getJobDescription, getAllInterviews, callsApi } from '../api/services';
import { toast } from 'react-toastify';

interface CallStats {
  totalCalls: number;
  completedCalls: number;
  incompleteSilence?: number;
  terminated?: number;
  inProgress?: number;
  callbackRequested?: number;
}
interface JobDescription {
  title: string;
  company: string;
  description: string;
  required_skills: string;
  experience_required: string;
}
interface Contact {
  name: string;
  phone: string;
  email?: string;
  experience?: string;
  skills?: string;
  tag?: string;
  batch_name?: string;
}
interface CallResult {
  contact: Contact;
  status: 'SUCCESS' | 'FAILED';
  call_sid?: string;
  timestamp: string;
  message: string;
}
interface BulkCallSession {
  bulk_call_id: string;
  status: string;
  current_index: number;
  total_contacts: number;
  completed_calls: number;
  results: CallResult[];
  start_time: string;
}


const initiateCall = async (phoneNumber: string, candidateName?: string) => {
  try {
    const response = await fetch('http://localhost:8000/make-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        candidate_name: candidateName || ''
      })
    });

    if (!response.ok) {
      const errorMsg = `HTTP error! status: ${response.status}`;
      throw new Error(errorMsg);
    }

    const result = await response.json();
    
    // If backend returned an error, throw it properly
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error initiating call:', error);
    // Re-throw as Error if it's not already an Error instance
    if (error && typeof error === 'object' && 'message' in error) {
      throw error as Error;
    }
    throw new Error(String(error || 'Unknown error occurred'));
  }
};

interface InterviewQuestion {
  id: number;
  question: string;
}

export const CallDashboard: React.FC = () => {
  const [savingJD, setSavingJD] = useState(false);
  // FIX: Initialize as empty array
  const [, setInterviews] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<CallStats>({
    totalCalls: 0,
    completedCalls: 0,
    incompleteSilence: 0,
    terminated: 0,
    inProgress: 0,
    callbackRequested: 0
  });
  const [jobDescription, setJobDescription] = useState<JobDescription>({
    title: '',
    company: '',
    description: '',
    required_skills: '',
    experience_required: ''
  });
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  
  // Single call states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');
  
  // Bulk calling states
  const [tabValue, setTabValue] = useState(0);
  // FIX: Initialize as empty array
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isBulkCalling, setIsBulkCalling] = useState(false);
  const [bulkCallSession, setBulkCallSession] = useState<BulkCallSession | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Add new state for questions
  const [questions, setQuestions] = useState<InterviewQuestion[]>([
    { id: 0, question: "Is this a good time to speak for a 3-4 minute interview?" },
    { id: 1, question: "Introduce yourself." },
    { id: 2, question: "What are your key skills for this role?" },
    { id: 3, question: "What is your current notice period?" },
    { id: 4, question: "What is your current CTC and expected salary?" },
    { id: 5, question: "Tell us about your experience with APIs." },
    { id: 6, question: "What is your understanding of cloud platforms? Have you worked with AWS, Azure, or GCP?" },
    { id: 7, question: "Describe your experience with deployments, including the use of Docker and Kubernetes." },
    { id: 8, question: "What is your experience with AI and machine learning? Mention any GenAI, deep learning technologies, or frameworks you've used." }
  ]);
  const [savingQuestions, setSavingQuestions] = useState(false);

  // Add new state for Twilio balance
  const [, setTwilioBalance] = useState<{
    balance: string;
    currency: string;
    loading: boolean;
  }>({
    balance: '0.00',
    currency: 'USD',
    loading: false
  });

  useEffect(() => {
    loadCallStats();
    loadJobDescription();
    loadInterviews();
    loadQuestions(); 
    loadTwilioBalance();
  }, []);

  // ✅ FIXED: Add the missing loadCallStats function
  const loadCallStats = async () => {
    try {
      // 🔥 FIX: Use getAllInterviewsDetailed instead of getCallStats
      const response = await callsApi.getAllInterviewsDetailed();
      const allInterviews = response.data.interviews || [];
      
      console.log('📊 CallDashboard - Raw interviews loaded:', allInterviews.length);
      
      // 🔥 Include ALL interviews (same logic as CallHistory)
      const validInterviews = allInterviews.filter((interview: any) => {
        const hasBasicData = interview.interview_id || interview.call_sid;
        
        // Don't exclude INCOMPLETE_SILENCE - keep them!
        if (!hasBasicData) {
          return false;
        }
        
        // Keep INCOMPLETE_SILENCE interviews
        if (interview.status === 'INCOMPLETE_SILENCE') {
          return true;
        }
        
        // Check for invalid time fields
        const completionTime = interview.completion_time;
        const endTime = interview.end_time;
        const startTime = interview.start_time;
        
        if (completionTime === "N/A" || endTime === "N/A" || startTime === "N/A") {
          return false;
        }
        
        if ((!completionTime || !endTime || !startTime) && 
            (!interview.responses || interview.responses.length === 0)) {
          return false;
        }
        
        return true;
      });
      
      console.log('📊 CallDashboard - Valid interviews after filtering:', validInterviews.length);
      
      // 🔥 Calculate comprehensive stats
      const totalCalls = validInterviews.length;
      const completedCalls = validInterviews.filter((i: any) => i.status === 'COMPLETED').length;
      const incompleteSilence = validInterviews.filter((i: any) => i.status === 'INCOMPLETE_SILENCE').length;
      const terminated = validInterviews.filter((i: any) => i.status === 'TERMINATED').length;
      const inProgress = validInterviews.filter((i: any) => i.status === 'IN_PROGRESS').length;
      const callbackRequested = validInterviews.filter((i: any) => i.status === 'CALLBACK_REQUESTED').length;
      
      console.log('📊 CallDashboard - Stats breakdown:', {
        totalCalls,
        completedCalls,
        incompleteSilence,
        terminated,
        inProgress,
        callbackRequested
      });
      
      setCallStats({ 
        totalCalls, 
        completedCalls,
        incompleteSilence,
        terminated,
        inProgress,
        callbackRequested
      });
      
      // Also set the interviews for display
      setInterviews(validInterviews);
      
    } catch (error) {
      console.error('Error loading call stats:', error);
      setCallStats({ 
        totalCalls: 0, 
        completedCalls: 0,
        incompleteSilence: 0,
        terminated: 0,
        inProgress: 0,
        callbackRequested: 0
      });
      setInterviews([]);
    }
  };

  const loadJobDescription = async () => {
    try {
      const jd = await getJobDescription();
      setJobDescription(jd || {
        title: '',
        company: '',
        description: '',
        required_skills: '',
        experience_required: ''
      });
    } catch (error) {
      console.error('Error loading job description:', error);
      // FIX: Set default values on error
      setJobDescription({
        title: '',
        company: '',
        description: '',
        required_skills: '',
        experience_required: ''
      });
    }
  };

  const loadInterviews = async () => {
    try {
      const data = await getAllInterviews();
      // FIX: Always ensure interviews is an array
      setInterviews(data?.interviews || []);
    } catch (error) {
      console.error('Error loading interviews:', error);
      // FIX: Set empty array on error
      setInterviews([]);
    }
  };


  // Add this function
  const loadQuestions = async () => {
    try {
      const response = await callsApi.getInterviewQuestions();
      if (response.success && response.questions) {
        setQuestions(response.questions);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  // Add this function to load Twilio balance
  const loadTwilioBalance = async () => {
    try {
      setTwilioBalance(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('http://localhost:8000/twilio-balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorMsg = `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }

      const result = await response.json();
      
      if (result.success) {
        setTwilioBalance({
          balance: result.balance,
          currency: result.currency || 'USD',
          loading: false
        });
      } else {
        // ✅ Fix the error handling here
        const errorMessage = typeof result.error === 'object' ? JSON.stringify(result.error) : (result.error || 'Failed to fetch balance');
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error loading Twilio balance:', error);
      setTwilioBalance({
        balance: 'Error',
        currency: 'USD',
        loading: false
      });
    }
  };

  const handleSaveJD = async () => {
    try {
      setSavingJD(true);
      const response = await callsApi.updateJobDescription(jobDescription);
      
      if (response.data.success) {
        toast.success('Job Description updated successfully!');
      } else {
        toast.error(`Failed to update JD: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error("Error updating JD:", error);
      toast.error(`Failed to update JD: ${error.message}`);
    } finally {
      setSavingJD(false);
    }
  };

  const handleMakeCall = async (customPhone?: string) => {
    if (isCallInProgress) {
      toast.warning('A call is already in progress');
      return;
    }

    const targetPhone = customPhone || phoneNumber;
    if (!targetPhone) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!candidateName.trim()) {
      toast.error('Please enter candidate name');
      return;
    }

    setIsCallInProgress(true);
    setCallResult(null);

    try {
      const result = await initiateCall(targetPhone, candidateName);
      
      if (result.success) {
        setCallResult(result);
        toast.success(`Call initiated successfully to ${targetPhone}`);
      } else {
        throw new Error(result.error || 'Call failed');
      }
    } catch (error: any) {
      console.error('Call failed:', error);
      const errorMessage = error?.message || error?.error || String(error) || 'Unknown error occurred';
      toast.error(`Call failed: ${errorMessage}`);
      setCallResult({ error: errorMessage });
    } finally {
      setIsCallInProgress(false);
    }
  };

  // Bulk calling functions
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:8000/upload-csv', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        // FIX: Always ensure contacts is an array
        const processedContacts = result.contacts || [];
        
        const validContacts = processedContacts.map((contact: any) => ({
          name: contact.name || contact.Name || `Contact_${Math.random().toString(36).substr(2, 4)}`,
          phone: contact.phone || contact.Phone || contact.mobile || contact.Mobile,
          data: contact.data || ''
        })).filter((contact: any) => contact.phone);
        
        setContacts(validContacts);
        toast.success(`${validContacts.length} contacts loaded successfully!`);
      } else {
        setContacts([]);
        toast.error(result.error || 'Failed to process CSV file');
      }
    } catch (error: any) {
      setContacts([]);
      toast.error('Failed to upload CSV: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const startBulkCalling = async () => {
    if (contacts.length === 0) return;
    
    setIsBulkCalling(true);
    
    try {
      const response = await fetch('http://localhost:8000/bulk-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contacts),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBulkCallSession({
          bulk_call_id: result.bulk_call_id,
          status: 'STARTING',
          current_index: 0,
          total_contacts: result.total_contacts,
          completed_calls: 0,
          results: [],
          start_time: new Date().toISOString()
        });
        
        pollBulkCallStatus(result.bulk_call_id);
        toast.success('Sequential bulk calling started!');
      } else {
        toast.error(result.error);
        setIsBulkCalling(false);
      }
    } catch (error: any) {
      toast.error('Failed to start bulk calling: ' + error.message);
      setIsBulkCalling(false);
    }
  };

  const pollBulkCallStatus = async (bulkCallId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/bulk-call-status/${bulkCallId}`);
        
        if (!response.ok) {
          console.warn(`Bulk call status endpoint returned ${response.status} for ${bulkCallId}`);
          return;
        }
        
        const status = await response.json();
        
        if (!status.error) {
          setBulkCallSession(status);
          
          if (status.status === 'COMPLETED' || status.status === 'STOPPED' || status.status === 'ERROR') {
            clearInterval(pollInterval);
            setIsBulkCalling(false);
            
            if (status.status === 'COMPLETED') {
              toast.success('Bulk calling completed!');
              loadCallStats();
            }
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
        // Don't clear interval on network errors, keep trying
      }
    }, 2000);
    
    // Auto-clear interval after 10 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsBulkCalling(false);
    }, 600000);
  };
  const stopBulkCalling = async () => {
    if (!bulkCallSession) return;
    try {
      const response = await fetch(`http://localhost:8000/stop-bulk-call/${bulkCallSession.bulk_call_id}`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        toast.info('Bulk calling stopped');
      }
    } catch (error: any) {
      toast.error('Failed to stop bulk calling: ' + error.message);
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'success';
      case 'FAILED': return 'error';
      default: return 'default';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle />;
      case 'FAILED': return <ErrorIcon />;
      default: return <CircularProgress size={16} />;
    }
  };
  const isValidPhoneNumber = (phone: string) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };
  
  // Save questions to backend
  const saveQuestions = async () => {
    try {
      setSavingQuestions(true);
      const response = await callsApi.updateInterviewQuestions(questions);
      if (response && response.success) {
        toast.success('Questions saved successfully!');
        // Reload questions to ensure sync
        await loadQuestions();
      } else {
        toast.error(response?.error || 'Failed to save questions');
      }
    } catch (error: any) {
      console.error('Error saving questions:', error);
      toast.error('Failed to save questions: ' + (error.message || 'Unknown error'));
    } finally {
      setSavingQuestions(false);
    }
  };

  // Add this function
  const updateQuestion = (id: number, newText: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, question: newText } : q
    ));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Logo - FIX: Correct logo path */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <img
          src="/title-logo.svg"
          alt="Logo"
          style={{
            height: '48px',
            width: 'auto',
            marginRight: '16px'
          }}
          onError={(e) => {
            console.warn('Logo not found, hiding image');
            e.currentTarget.style.display = 'none';
          }}
        />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
            AI Interview Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage job descriptions, make calls, and monitor interview performance
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ color: 'primary.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {callStats.totalCalls}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Total Interviews
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ color: 'success.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main', fontSize: '1.25rem' }}>
                    {callStats.completedCalls}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Completed
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ color: 'warning.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.main', fontSize: '1.25rem' }}>
                    {callStats.incompleteSilence || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    No Response
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ErrorIcon sx={{ color: 'error.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '1.25rem' }}>
                    {callStats.terminated || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Terminated
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ color: 'primary.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.25rem' }}>
                    {contacts.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Ready to Call
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
            <Tab label="Single Call" />
            <Tab label="CSV Upload" />
            <Tab label="Job Description" />
          </Tabs>
          {tabValue === 0 && (
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                  AI Interview Call
                </Typography>
                
                {/* Candidate Name Input */}
                <Box sx={{ mb: 2, width: '100%', maxWidth: 400 }}>
                  <TextField
                    fullWidth
                    label="Candidate Name"
                    placeholder="Enter candidate name"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    disabled={isCallInProgress}
                    required
                    helperText="Enter the candidate's full name"
                  />
                </Box>

                {/* Phone Number Input */}
                <Box sx={{ mb: 2, width: '100%', maxWidth: 400 }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isCallInProgress}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneInTalk />
                        </InputAdornment>
                      ),
                    }}
                    helperText="Enter phone number (e.g., +1234567890)"
                    error={!!(phoneNumber && !isValidPhoneNumber(phoneNumber))}
                  />
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={() => handleMakeCall()}
                  disabled={isCallInProgress || !candidateName.trim() || !!(phoneNumber && !isValidPhoneNumber(phoneNumber))}
                  startIcon={isCallInProgress ? <CircularProgress size={24} /> : <Phone />}
                  sx={{ 
                    px: 4, 
                    py: 1.5, 
                    fontSize: '1.1rem',
                    minWidth: 250
                  }}
                >
                  {isCallInProgress ? 'Calling...' : 'Make AI Interview Call'}
                </Button>

                {callResult && (
                  <Alert 
                    severity={callResult.success ? 'success' : 'error'}
                    sx={{ mt: 3, width: '100%', maxWidth: 600 }}
                  >
                    {callResult.success ? (
                      <>
                        Call initiated successfully! Call SID: {callResult.call_sid}
                      </>
                    ) : (
                      <>
                        Call failed: {callResult.error}
                      </>
                    )}
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Modern Interview Questions Section */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <QuestionAnswer sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                      Interview Questions
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={savingQuestions ? <CircularProgress size={16} /> : <Save sx={{ fontSize: 18 }} />}
                    onClick={saveQuestions}
                    disabled={savingQuestions}
                    sx={{ 
                      px: 2, 
                      py: 0.75,
                      fontSize: '0.875rem',
                      borderRadius: 1.5
                    }}
                  >
                    {savingQuestions ? 'Saving...' : 'Save'}
                  </Button>
                </Box>

                <Grid container spacing={1}>
                  {questions.map((question) => (
                    <Grid item xs={12} key={question.id}>
                      <Card sx={{ 
                        p: 1.25, 
                        backgroundColor: 'rgba(17, 17, 17, 0.6)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: question.id === 0 || question.id === 3 || question.id === 4 
                            ? 'rgba(255, 255, 255, 0.1)' 
                            : 'rgba(99, 102, 241, 0.4)',
                          backgroundColor: 'rgba(17, 17, 17, 0.8)',
                        }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
                          <Chip 
                            label={`Q${question.id}`} 
                            size="small"
                            sx={{ 
                              minWidth: 36,
                              height: 24,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: question.id === 0 
                                ? 'rgba(255, 152, 0, 0.2)' 
                                : question.id === 2 
                                ? 'rgba(99, 102, 241, 0.2)' 
                                : 'rgba(99, 102, 241, 0.15)',
                              color: question.id === 0 
                                ? '#ff9800' 
                                : question.id === 2 
                                ? '#6366f1' 
                                : '#a3a3a3',
                              border: '1px solid',
                              borderColor: question.id === 0 
                                ? 'rgba(255, 152, 0, 0.3)' 
                                : question.id === 2 
                                ? 'rgba(99, 102, 241, 0.3)' 
                                : 'rgba(255, 255, 255, 0.1)',
                            }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ 
                              color: '#a3a3a3', 
                              fontSize: '0.7rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              fontWeight: 500
                            }}>
                              {question.id === 0 && "Availability Check"}
                              {question.id === 2 && "Skills Assessment"}
                              {question.id === 3 && "Notice Period"}
                              {question.id === 4 && "Salary Details"}
                              {![0, 2, 3, 4].includes(question.id) && `Question ${question.id}`}
                            </Typography>
                          </Box>
                          {(question.id === 0 || question.id === 3 || question.id === 4) && (
                            <Chip 
                              label="Locked" 
                              size="small"
                              sx={{ 
                                height: 20,
                                fontSize: '0.65rem',
                                backgroundColor: 'rgba(107, 114, 128, 0.2)',
                                color: '#9ca3af',
                                border: '1px solid rgba(107, 114, 128, 0.3)',
                              }}
                            />
                          )}
                        </Box>
                        
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, e.target.value)}
                          variant="outlined"
                          placeholder={`Enter question ${question.id}...`}
                          disabled={question.id === 0 || question.id === 3 || question.id === 4}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'rgba(10, 10, 10, 0.4)',
                              fontSize: '0.875rem',
                              '& fieldset': {
                                borderColor: 'rgba(255, 255, 255, 0.08)',
                                borderWidth: 1,
                              },
                              '&:hover fieldset': {
                                borderColor: question.id === 0 || question.id === 3 || question.id === 4 
                                  ? 'rgba(255, 255, 255, 0.08)' 
                                  : 'rgba(99, 102, 241, 0.5)',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: 'primary.main',
                                borderWidth: 1.5,
                              },
                            },
                            '& .MuiInputBase-input': {
                              color: '#f5f5f5',
                              py: 1.25,
                              px: 1.5,
                            },
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(163, 163, 163, 0.5)',
                              backgroundColor: 'rgba(0, 0, 0, 0.15)',
                            }
                          }}
                        />
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Box>
          )}

          {/* CSV Upload Tab */}
          {tabValue === 1 && (
            <Box sx={{ minHeight: '70vh' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                CSV Upload Bulk Calling
              </Typography>
              
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                    Upload Contact List
                  </Typography>
                  
                  <Box
                    sx={{
                      border: '2px dashed #ccc',
                      borderRadius: 2,
                      p: 6,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' },
                      minHeight: 200
                    }}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="csv-upload"
                      disabled={isUploading || isBulkCalling}
                    />
                    <label htmlFor="csv-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                      <CloudUpload sx={{ fontSize: 72, color: 'text.secondary', mb: 3 }} />
                      <Typography variant="h5" sx={{ mb: 2 }}>
                        {isUploading ? 'Processing CSV...' : 'Drop CSV File Here or Click to Upload'}
                      </Typography>
                      <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
                        CSV should contain: name, phone, email, experience, skills
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Calls will be made sequentially with proper spacing
                      </Typography>
                    </label>
                  </Box>
                  
                  {contacts.length > 0 && (
                    <Alert severity="success" sx={{ mt: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <People sx={{ mr: 1 }} />
                        <Typography variant="h6">
                          {contacts.length} contacts loaded successfully - Ready for sequential calling!
                        </Typography>
                      </Box>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Bulk Calling Controls */}
              {contacts.length > 0 && (
                <Grid container spacing={4}>
                  <Grid item xs={12} md={8}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Contact List ({contacts.length} contacts)
                        </Typography>
                        
                        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Skills</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {contacts.map((contact, index) => (
                                <TableRow key={index}>
                                  <TableCell>{contact.name}</TableCell>
                                  <TableCell>{contact.phone}</TableCell>
                                  <TableCell>{contact.email || 'N/A'}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                                      {contact.skills || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Bulk Calling Controls
                        </Typography>

                        {!isBulkCalling ? (
                          <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            startIcon={<PlayArrow />}
                            onClick={startBulkCalling}
                            disabled={contacts.length === 0}
                            sx={{ mb: 2 }}
                          >
                            Start Sequential Calling ({contacts.length} contacts)
                          </Button>
                        ) : (
                          <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                              <Typography variant="body2">
                                📞 Bulk calling in progress...
                              </Typography>
                            </Alert>
                            
                            {bulkCallSession && (
                              <Box sx={{ mb: 3 }}>
                                <Typography variant="body2" color="textSecondary">
                                  Progress: {bulkCallSession.completed_calls} / {bulkCallSession.total_contacts}
                                </Typography>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={(bulkCallSession.completed_calls / bulkCallSession.total_contacts) * 100}
                                  sx={{ mt: 1 }}
                                />
                              </Box>
                            )}

                            <Button
                              variant="outlined"
                              color="warning"
                              startIcon={<Stop />}
                              onClick={stopBulkCalling}
                              fullWidth
                            >
                              Stop Calling
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* Job Description Tab */}
          {tabValue === 2 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Job Description
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveJD}
                  disabled={savingJD}
                  startIcon={savingJD ? <CircularProgress size={16} /> : <Save />}
                >
                  {savingJD ? 'Saving...' : 'Save Job Description'}
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={jobDescription.title}
                    onChange={(e) => setJobDescription({...jobDescription, title: e.target.value})}
                    sx={{ mb: 2 }}
                    placeholder="e.g., Senior Software Engineer"
                  />
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={jobDescription.company}
                    onChange={(e) => setJobDescription({...jobDescription, company: e.target.value})}
                    sx={{ mb: 2 }}
                    placeholder="e.g., Tech Innovations Inc."
                  />
                  <TextField
                    fullWidth
                    label="Experience Required"
                    value={jobDescription.experience_required}
                    onChange={(e) => setJobDescription({...jobDescription, experience_required: e.target.value})}
                    placeholder="e.g., 2-5 years experience in software development"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Job Description"
                    value={jobDescription.description}
                    onChange={(e) => setJobDescription({...jobDescription, description: e.target.value})}
                    sx={{ mb: 2 }}
                    placeholder="Brief description of the role..."
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Required Skills (comma-separated)"
                    value={jobDescription.required_skills}
                    onChange={(e) => setJobDescription({...jobDescription, required_skills: e.target.value})}
                    placeholder="python, javascript, react, node.js, sql, aws, docker"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="lg" fullWidth>
        <DialogContent>
          {bulkCallSession && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Call ID</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bulkCallSession.results.map((result, index) => (
                    <TableRow 
                      key={index} 
                      sx={{ backgroundColor: result.status === 'SUCCESS' ? 'success.50' : 'inherit' }}
                    >
                      <TableCell>#{index + 1}</TableCell>
                      <TableCell>{result.contact.name}</TableCell>
                      <TableCell>{result.contact.phone}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(result.status)}
                          label={result.status}
                          color={getStatusColor(result.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{result.call_sid || 'N/A'}</TableCell>
                      <TableCell>
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>{result.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResults(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};