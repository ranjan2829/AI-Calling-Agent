import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  Alert,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Upload,
  Phone,
  Stop,
  PlayArrow,
  CheckCircle,
  Error,
  People,
  Schedule,
  Pause,
  History,
  Refresh,
  CallEnd,
  PhoneInTalk,
  Assessment,
  Pending
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface Contact {
  name: string;
  phone: string;
  email?: string;
  experience?: string;
  skills?: string;
  data?: string;
}

interface CallResult {
  name: string;
  phone: string;
  success: boolean;
  call_sid?: string;
  status: string;
  error?: string;
  timestamp?: string;
  message?: string;
  call_duration?: string;
  // NEW: Call completion tracking
  call_initiated?: boolean;
  call_completed?: boolean;
  interview_status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'TERMINATED' | 'CALLBACK_REQUESTED';
  completion_time?: string;
}

interface BulkCallSession {
  bulk_call_id: string;
  status: string;
  current_index?: number;
  total_contacts?: number;
  total_candidates: number;
  successful_calls: number;
  failed_calls: number;
  completed_calls?: number;
  results: CallResult[];
  start_time?: string;
  created_at?: string;
  end_time?: string;
  // NEW: Completion tracking
  calls_initiated: number;
  calls_completed: number;
  calls_in_progress: number;
  calls_terminated: number;
  callbacks_requested: number;
}

interface SavedBulkResult {
  bulk_call_id: string;
  total_candidates: number;
  successful_calls: number;
  failed_calls: number;
  results: CallResult[];
  created_at: string;
  status: string;
  // NEW: Completion stats
  calls_completed?: number;
  calls_in_progress?: number;
  calls_terminated?: number;
  callbacks_requested?: number;
}

// NEW: Interview data interface
interface InterviewData {
  interview_id: string;
  call_sid: string;
  candidate_name: string;
  candidate_phone: string;
  status: string;
  questions_answered: number;
  total_questions: number;
  completion_time: string;
  bulk_call_id?: string;
  is_bulk_call?: boolean;
}

export const BulkCallDashboard: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [bulkCallSession, setBulkCallSession] = useState<BulkCallSession | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'time' | 'completion'>('status');
  
  const [savedBulkResults, setSavedBulkResults] = useState<SavedBulkResult[]>([]);
  const [loadingSavedResults, setLoadingSavedResults] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  // NEW: Interview tracking
  const [interviewData, setInterviewData] = useState<InterviewData[]>([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadSavedBulkResults();
    loadInterviewData();
  }, []);

  // NEW: Auto-refresh for real-time updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && bulkCallSession) {
      interval = setInterval(() => {
        loadInterviewData();
      }, 10000); // Refresh every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, bulkCallSession]);

  // NEW: Load interview data to track completions
  const loadInterviewData = async () => {
    try {
      setIsLoadingInterviews(true);
      const response = await fetch('http://13.204.76.229:8000/interviews-detailed');
      const data = await response.json();
      
      if (data.success) {
        setInterviewData(data.interviews || []);
        console.log('✅ Loaded interview data:', data.interviews?.length || 0);
        
        // Update bulk call session with completion data
        if (bulkCallSession) {
          updateBulkCallSessionWithCompletions(data.interviews || []);
        }
      } else {
        console.error('❌ Failed to load interview data:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading interview data:', error);
    } finally {
      setIsLoadingInterviews(false);
    }
  };

  // NEW: Update bulk call session with completion data
  const updateBulkCallSessionWithCompletions = (interviews: InterviewData[]) => {
    if (!bulkCallSession) return;

    const bulkInterviews = interviews.filter(interview => 
      interview.bulk_call_id === bulkCallSession.bulk_call_id || 
      interview.is_bulk_call
    );

    const updatedResults = bulkCallSession.results.map(result => {
      const matchingInterview = bulkInterviews.find(interview => 
        interview.call_sid === result.call_sid || 
        interview.candidate_phone === result.phone
      );

      if (matchingInterview) {
        return {
          ...result,
          call_completed: matchingInterview.status === 'COMPLETED',
          interview_status: matchingInterview.status as any,
          completion_time: matchingInterview.completion_time,
          call_initiated: true
        };
      }

      return {
        ...result,
        call_initiated: result.success,
        call_completed: false,
        interview_status: result.success ? 'IN_PROGRESS' : 'NOT_STARTED' as any
      };
    });

    // Calculate completion stats
    const calls_completed = updatedResults.filter(r => r.call_completed).length;
    const calls_in_progress = updatedResults.filter(r => 
      r.call_initiated && !r.call_completed && r.interview_status === 'IN_PROGRESS'
    ).length;
    const calls_terminated = updatedResults.filter(r => 
      r.interview_status === 'TERMINATED'
    ).length;
    const callbacks_requested = updatedResults.filter(r => 
      r.interview_status === 'CALLBACK_REQUESTED'
    ).length;

    setBulkCallSession({
      ...bulkCallSession,
      results: updatedResults,
      calls_initiated: updatedResults.filter(r => r.call_initiated).length,
      calls_completed,
      calls_in_progress,
      calls_terminated,
      callbacks_requested
    });
  };

  const loadSavedBulkResults = async () => {
    try {
      setLoadingSavedResults(true);
      const response = await fetch('http://13.204.76.229:8000/bulk-results');
      const data = await response.json();
      
      if (data.success) {
        setSavedBulkResults(data.bulk_results || []);
        console.log('✅ Loaded saved bulk results:', data.bulk_results?.length || 0);
      } else {
        console.error('❌ Failed to load saved bulk results:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading saved bulk results:', error);
    } finally {
      setLoadingSavedResults(false);
    }
  };

  const saveBulkResults = async (bulkData: BulkCallSession) => {
    try {
      const response = await fetch('http://13.204.76.229:8000/save-bulk-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bulkData)
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Bulk call results saved persistently');
        await loadSavedBulkResults();
      } else {
        console.error('❌ Failed to save bulk results:', result.error);
      }
    } catch (error) {
      console.error('❌ Error saving bulk results:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('📤 Uploading CSV file...');
      
      const response = await fetch('http://13.204.76.229:8000/upload-csv', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      console.log('📥 Upload response:', result);
      
      if (result.success && result.contacts && Array.isArray(result.contacts)) {
        const validContacts = result.contacts.map((contact: any) => ({
          name: contact.name || contact.Name || `Contact_${Math.random().toString(36).substr(2, 4)}`,
          phone: contact.phone || contact.Phone || contact.mobile || contact.Mobile,
          email: contact.email || contact.Email || '',
          experience: contact.experience || contact.Experience || contact.data || '',
          skills: contact.skills || contact.Skills || '',
          data: contact.data || ''
        })).filter((contact: any) => contact.phone && contact.phone.trim());
        
        setContacts(validContacts);
        console.log('✅ Contacts loaded:', validContacts);
        
        toast.success(`✅ ${validContacts.length} contacts loaded successfully! Review the list and click "Start AI Bulk Interviews" to begin calling.`);
        
      } else {
        setContacts([]);
        toast.error(result.error || 'Failed to process CSV file');
        console.error('❌ CSV upload failed:', result.error);
      }
    } catch (error: any) {
      setContacts([]);
      toast.error('Failed to upload CSV: ' + error.message);
      console.error('❌ CSV upload error:', error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const startBulkCalling = async () => {
    if (!contacts || contacts.length === 0) {
      toast.error('❌ No contacts available for calling. Please upload a CSV file first.');
      return;
    }
    
    const validContacts = contacts.filter(contact => contact.phone && contact.phone.trim());
    if (validContacts.length === 0) {
      toast.error('❌ No valid phone numbers found in contacts');
      return;
    }
    
    if (validContacts.length !== contacts.length) {
      toast.warning(`⚠️ ${contacts.length - validContacts.length} contacts without phone numbers will be skipped`);
    }
    
    setIsCalling(true);
    console.log('🚀 Starting bulk calling for', validContacts.length, 'contacts...');
    
    try {
      const response = await fetch('http://13.204.76.229:8000/bulk-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validContacts),
      });
      
      const result = await response.json();
      console.log('📞 Bulk call response:', result);
      
      if (result.success && result.bulk_call_id) {
        const newSession: BulkCallSession = {
          bulk_call_id: result.bulk_call_id,
          status: 'COMPLETED',
          total_candidates: result.total_candidates,
          successful_calls: result.successful_calls || 0,
          failed_calls: result.failed_calls || 0,
          results: (result.results || []).map((r: any) => ({
            ...r,
            call_initiated: r.success,
            call_completed: false,
            interview_status: r.success ? 'IN_PROGRESS' : 'NOT_STARTED'
          })),
          start_time: new Date().toISOString(),
          created_at: new Date().toISOString(),
          // NEW: Initialize completion tracking
          calls_initiated: result.successful_calls || 0,
          calls_completed: 0,
          calls_in_progress: result.successful_calls || 0,
          calls_terminated: 0,
          callbacks_requested: 0
        };
        
        setBulkCallSession(newSession);
        setShowResults(true);
        setAutoRefresh(true); // Start auto-refresh
        
        await saveBulkResults(newSession);
        
        toast.success(`🎉 Bulk calling completed! ${result.successful_calls}/${result.total_candidates} calls initiated successfully. Tracking completion status...`);
        
        // Load interview data to start tracking
        setTimeout(() => {
          loadInterviewData();
        }, 2000);
        
      } else {
        toast.error(result.error || 'Failed to start bulk calling');
      }
    } catch (error: any) {
      toast.error('Failed to start bulk calling: ' + error.message);
      console.error('❌ Bulk calling error:', error);
    } finally {
      setIsCalling(false);
    }
  };

  // Enhanced results sorting
  const getSortedResults = (results: CallResult[]) => {
    const sortedResults = [...results];
    
    switch (sortBy) {
      case 'completion':
        return sortedResults.sort((a, b) => {
          if (a.call_completed && !b.call_completed) return -1;
          if (!a.call_completed && b.call_completed) return 1;
          if (a.call_initiated && !b.call_initiated) return -1;
          if (!a.call_initiated && b.call_initiated) return 1;
          return 0;
        });
      case 'status':
        return sortedResults.sort((a, b) => {
          if (a.success && !b.success) return -1;
          if (!a.success && b.success) return 1;
          return 0;
        });
      case 'name':
        return sortedResults.sort((a, b) => a.name.localeCompare(b.name));
      case 'time':
      default:
        return sortedResults.sort((a, b) => {
          const timeA = a.completion_time ? new Date(a.completion_time).getTime() : 0;
          const timeB = b.completion_time ? new Date(b.completion_time).getTime() : 0;
          return timeB - timeA;
        });
    }
  };

  // NEW: Get call status info
  const getCallStatusInfo = (result: CallResult) => {
    if (!result.call_initiated) {
      return { icon: <Error />, color: 'error', label: 'NOT INITIATED', bgColor: 'error.50' };
    }
    
    if (result.call_completed) {
      return { icon: <CheckCircle />, color: 'success', label: 'COMPLETED', bgColor: 'success.50' };
    }
    
    switch (result.interview_status) {
      case 'IN_PROGRESS':
        return { icon: <PhoneInTalk />, color: 'primary', label: 'IN PROGRESS', bgColor: 'primary.50' };
      case 'TERMINATED':
        return { icon: <CallEnd />, color: 'warning', label: 'TERMINATED', bgColor: 'warning.50' };
      case 'CALLBACK_REQUESTED':
        return { icon: <Schedule />, color: 'info', label: 'CALLBACK', bgColor: 'info.50' };
      default:
        return { icon: <Pending />, color: 'default', label: 'PENDING', bgColor: 'grey.50' };
    }
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'success' : 'error';
  };

  const getStatusIcon = (success: boolean) => {
    return success ? <CheckCircle /> : <Error />;
  };

  const getStatusLabel = (success: boolean) => {
    return success ? 'INITIATED' : 'FAILED';
  };

  const loadBulkResult = (savedResult: SavedBulkResult) => {
    setBulkCallSession({
      bulk_call_id: savedResult.bulk_call_id,
      status: savedResult.status,
      total_candidates: savedResult.total_candidates,
      successful_calls: savedResult.successful_calls,
      failed_calls: savedResult.failed_calls,
      results: savedResult.results,
      created_at: savedResult.created_at,
      // NEW: Load completion data
      calls_initiated: savedResult.successful_calls,
      calls_completed: savedResult.calls_completed || 0,
      calls_in_progress: savedResult.calls_in_progress || 0,
      calls_terminated: savedResult.calls_terminated || 0,
      callbacks_requested: savedResult.callbacks_requested || 0
    });
    setShowHistoryDialog(false);
    setShowResults(true);
    setAutoRefresh(true);
    loadInterviewData(); // Refresh completion data
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
          📞 AI Bulk Call Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Upload CSV and automatically call multiple candidates with AI interviewer - Track call completion status
        </Typography>
      </Box>

      {/* Action Bar */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<History />}
          onClick={() => setShowHistoryDialog(true)}
          disabled={loadingSavedResults}
        >
          View History ({savedBulkResults.length})
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => {
            loadSavedBulkResults();
            loadInterviewData();
          }}
          disabled={loadingSavedResults || isLoadingInterviews}
        >
          {loadingSavedResults || isLoadingInterviews ? 'Loading...' : 'Refresh'}
        </Button>

        {/* NEW: Auto-refresh toggle */}
        {bulkCallSession && (
          <Button
            variant={autoRefresh ? "contained" : "outlined"}
            size="small"
            onClick={() => setAutoRefresh(!autoRefresh)}
            startIcon={autoRefresh ? <Pause /> : <PlayArrow />}
          >
            {autoRefresh ? 'Pause Tracking' : 'Start Tracking'}
          </Button>
        )}

        {/* Enhanced Stats */}
        {contacts.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', ml: 'auto' }}>
            <Chip 
              icon={<People />} 
              label={`${contacts.length} contacts loaded`} 
              color="primary" 
              variant="outlined"
            />
            {bulkCallSession && (
              <>
                <Chip 
                  icon={<Phone />} 
                  label={`${bulkCallSession.calls_initiated} initiated`} 
                  color="info" 
                  size="small"
                />
                <Chip 
                  icon={<CheckCircle />} 
                  label={`${bulkCallSession.calls_completed} completed`} 
                  color="success" 
                  size="small"
                />
                <Chip 
                  icon={<PhoneInTalk />} 
                  label={`${bulkCallSession.calls_in_progress} in progress`} 
                  color="primary" 
                  size="small"
                />
                {bulkCallSession.calls_terminated > 0 && (
                  <Chip 
                    icon={<CallEnd />} 
                    label={`${bulkCallSession.calls_terminated} terminated`} 
                    color="warning" 
                    size="small"
                  />
                )}
                {bulkCallSession.callbacks_requested > 0 && (
                  <Chip 
                    icon={<Schedule />} 
                    label={`${bulkCallSession.callbacks_requested} callbacks`} 
                    color="info" 
                    size="small"
                  />
                )}
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Upload Section - Keep existing code */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Upload sx={{ color: 'primary.main', mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Step 1: Upload Contact List
            </Typography>
          </Box>
          
          <Box
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: isUploading || isCalling ? 'not-allowed' : 'pointer',
              '&:hover': { 
                bgcolor: isUploading || isCalling ? 'inherit' : 'grey.50' 
              },
              opacity: isUploading || isCalling ? 0.6 : 1
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="csv-upload"
              disabled={isUploading || isCalling}
            />
            <label 
              htmlFor="csv-upload" 
              style={{ 
                cursor: isUploading || isCalling ? 'not-allowed' : 'pointer', 
                width: '100%', 
                display: 'block' 
              }}
            >
              {isUploading ? (
                <Box>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Processing CSV file...
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Please wait while we parse your contact list
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Upload CSV File
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    CSV format: name, phone, data (experience), additional_phone
                  </Typography>
                </Box>
              )}
            </label>
          </Box>
          
          {contacts.length > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ mr: 1 }} />
                  <Typography>
                    ✅ {contacts.length} contacts loaded successfully! 
                    Primary data: name and phone. Click "Start AI Bulk Interviews" to begin calling.
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Contact List and Control Panel */}
      {contacts.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Contact List - Keep existing but enhance */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    📋 Contact List Preview
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {contacts.length} contacts ready for AI interviews
                  </Typography>
                </Box>
                
                <Box sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  {contacts.map((contact, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 2,
                        borderBottom: index < contacts.length - 1 ? '1px solid #f0f0f0' : 'none',
                        '&:hover': { bgcolor: 'grey.50' }
                      }}
                    >
                      <Grid container alignItems="center" spacing={2}>
                        <Grid item xs={12} sm={1}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            #{index + 1}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                            👤 {contact.name}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="textSecondary">
                            📞 {contact.phone}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          {contact.data && (
                            <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.8rem' }}>
                              💼 {contact.data.substring(0, 30)}{contact.data.length > 30 ? '...' : ''}
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Enhanced Control Panel */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                  🚀 Step 2: Start AI Interviews
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={isCalling ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                    onClick={startBulkCalling}
                    disabled={contacts.length === 0 || isCalling}
                    sx={{ 
                      mb: 2,
                      bgcolor: isCalling ? 'grey.500' : 'primary.main',
                      '&:hover': {
                        bgcolor: isCalling ? 'grey.500' : 'primary.dark'
                      }
                    }}
                  >
                    {isCalling ? 'Calling in Progress...' : 'Start AI Bulk Interviews'}
                  </Button>
                  
                  {bulkCallSession && bulkCallSession.results.length > 0 && (
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => setShowResults(true)}
                      startIcon={<Assessment />}
                    >
                      View Results ({bulkCallSession.results.length})
                    </Button>
                  )}
                </Box>

                {/* Enhanced Statistics */}
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  📊 Call Statistics
                </Typography>
                
                {/* Primary Stats */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {contacts.length}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Total
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                        {bulkCallSession?.calls_initiated || 0}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Initiated
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        {bulkCallSession?.calls_completed || 0}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Completed
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Secondary Stats */}
                {bulkCallSession && (
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'primary.50', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {bulkCallSession.calls_in_progress}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          In Progress
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'error.50', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          {bulkCallSession.failed_calls}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Failed
                        </Typography>
                      </Box>
                    </Grid>
                    {bulkCallSession.calls_terminated > 0 && (
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'warning.50', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                            {bulkCallSession.calls_terminated}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Terminated
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {bulkCallSession.callbacks_requested > 0 && (
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'info.50', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                            {bulkCallSession.callbacks_requested}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Callbacks
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                )}

                {/* Progress */}
                {isCalling && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      🔄 Processing bulk calls...
                    </Typography>
                    <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      AI interviews are being conducted automatically. Each call will be processed and analyzed.
                    </Typography>
                  </Box>
                )}

                {/* Real-time tracking indicator */}
                {autoRefresh && bulkCallSession && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="info" sx={{ p: 1 }}>
                      <Typography variant="caption">
                        🔄 Real-time tracking active - Updates every 10 seconds
                        {isLoadingInterviews && <CircularProgress size={12} sx={{ ml: 1 }} />}
                      </Typography>
                    </Alert>
                  </Box>
                )}

                {/* Completion Summary */}
                {bulkCallSession && !isCalling && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      ✅ Bulk calling completed! 
                      <br />
                      <strong>Initiated:</strong> {bulkCallSession.calls_initiated}/{bulkCallSession.total_candidates}
                      <br />
                      <strong>Completed:</strong> {bulkCallSession.calls_completed}/{bulkCallSession.calls_initiated}
                      <br />
                      Check the results for detailed completion tracking.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Empty State - Keep existing */}
      {contacts.length === 0 && !isUploading && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              No contacts loaded
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Upload a CSV file with candidate information to start bulk AI interviews
            </Typography>
            <Typography variant="body2" color="textSecondary">
              CSV format: name, phone, data (experience), additional_phone
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Results Dialog */}
      <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">📊 AI Interview Results - Call Completion Tracking</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort by"
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <MenuItem value="completion">Completion Status</MenuItem>
                  <MenuItem value="status">Initiation Status</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="time">Time</MenuItem>
                </Select>
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadInterviewData}
                disabled={isLoadingInterviews}
              >
                {isLoadingInterviews ? 'Loading...' : 'Refresh'}
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {bulkCallSession && (
            <>
              {/* Enhanced Summary */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Bulk Call ID:</strong> {bulkCallSession.bulk_call_id} | 
                  <strong> Total:</strong> {bulkCallSession.total_candidates} | 
                  <strong> Initiated:</strong> {bulkCallSession.calls_initiated} | 
                  <strong> Completed:</strong> {bulkCallSession.calls_completed} | 
                  <strong> In Progress:</strong> {bulkCallSession.calls_in_progress} | 
                  <strong> Completion Rate:</strong> {Math.round((bulkCallSession.calls_completed / Math.max(bulkCallSession.calls_initiated, 1)) * 100)}%
                </Typography>
              </Alert>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Rank</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell><strong>Phone</strong></TableCell>
                      <TableCell><strong>Call Status</strong></TableCell>
                      <TableCell><strong>Interview Status</strong></TableCell>
                      <TableCell><strong>Call Details</strong></TableCell>
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getSortedResults(bulkCallSession.results).map((result, index) => {
                      const statusInfo = getCallStatusInfo(result);
                      return (
                        <TableRow 
                          key={index} 
                          sx={{ 
                            backgroundColor: statusInfo.bgColor,
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              #{index + 1}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                              {result.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {result.phone}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getStatusIcon(result.success)}
                              label={getStatusLabel(result.success)}
                              color={getStatusColor(result.success) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title={`Last updated: ${result.completion_time || 'Unknown'}`}>
                              <Chip
                                icon={statusInfo.icon}
                                label={statusInfo.label}
                                color={statusInfo.color as any}
                                size="small"
                                variant={result.call_completed ? "filled" : "outlined"}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {result.call_sid || 'No Call ID'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {result.call_completed 
                                ? `Completed: ${result.completion_time ? new Date(result.completion_time).toLocaleString() : 'Unknown'}`
                                : result.success 
                                  ? 'Interview in progress...' 
                                  : (result.error || 'Call failed')
                              }
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {result.success && result.call_sid && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  window.open(`/interview-details/${result.call_sid}`, '_blank');
                                }}
                              >
                                View Interview
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoRefresh(false)}>Stop Tracking</Button>
          <Button onClick={() => setShowResults(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog - Keep existing but enhance with completion data */}
      <Dialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">📈 Bulk Call History</Typography>
            <Button startIcon={<Refresh />} onClick={loadSavedBulkResults} disabled={loadingSavedResults}>
              Refresh
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingSavedResults ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : savedBulkResults.length === 0 ? (
            <Alert severity="info">No previous bulk call results found.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Bulk Call ID</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Total</strong></TableCell>
                    <TableCell><strong>Initiated</strong></TableCell>
                    <TableCell><strong>Completed</strong></TableCell>
                    <TableCell><strong>Failed</strong></TableCell>
                    <TableCell><strong>Completion Rate</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {savedBulkResults.map((result, index) => (
                    <TableRow key={result.bulk_call_id || index}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {result.bulk_call_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(result.created_at).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={result.total_candidates} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={result.successful_calls} color="info" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={result.calls_completed || 0} color="success" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={result.failed_calls} color="error" size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {Math.round(((result.calls_completed || 0) / Math.max(result.successful_calls, 1)) * 100)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => loadBulkResult(result)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};