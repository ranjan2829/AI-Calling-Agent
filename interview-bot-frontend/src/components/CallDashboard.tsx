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
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tab,
  Tabs,
  InputAdornment
} from '@mui/material';
import {
  Phone,
  Assessment,
  Work,
  Save,
  CheckCircle,
  Upload,
  People,
  PlayArrow,
  Stop,
  Error,
  CloudUpload,
  PhoneInTalk
} from '@mui/icons-material';
import { getCallStats, getJobDescription, getAllInterviews, callsApi } from '../api/services';
import { toast } from 'react-toastify';
interface CallStats {
  totalCalls: number;
  completedCalls: number;
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
  data?: string;
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
const initiateCall = async (phoneNumber: string) => {
  try {
    const response = await fetch('http://13.204.76.229:8000/make-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error initiating call:', error);
    throw error;
  }
};

export const CallDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [savingJD, setSavingJD] = useState(false);
  const [jdSaved, setJdSaved] = useState(false);
  // FIX: Initialize as empty array
  const [interviews, setInterviews] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<CallStats>({
    totalCalls: 0,
    completedCalls: 0
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
  
  // Bulk calling states
  const [tabValue, setTabValue] = useState(0);
  // FIX: Initialize as empty array
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isBulkCalling, setIsBulkCalling] = useState(false);
  const [bulkCallSession, setBulkCallSession] = useState<BulkCallSession | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadCallStats();
    loadJobDescription();
    loadInterviews();
  }, []);

  const loadCallStats = async () => {
    try {
      const stats = await getCallStats();
      setCallStats(stats || { totalCalls: 0, completedCalls: 0 });
    } catch (error) {
      console.error('Error loading call stats:', error);
      // FIX: Set default values on error
      setCallStats({ totalCalls: 0, completedCalls: 0 });
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

  const handleSaveJD = async () => {
    try {
      setSavingJD(true);
      const response = await callsApi.updateJobDescription(jobDescription);
      
      if (response.data.success) {
        toast.success('Job Description updated successfully!');
        setJdSaved(true);
        setTimeout(() => setJdSaved(false), 3000);
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

  const handleRunAnalysis = async () => {
    try {
      setLoading(true);
      const response = await callsApi.runJDAnalysis();
      
      if (response.data && !response.data.error) {
        toast.success('JD Analysis completed successfully!');
      } else {
        toast.error('Analysis failed: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (error: any) {
      toast.error('Failed to run analysis: ' + error.message);
    } finally {
      setLoading(false);
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

    setIsCallInProgress(true);
    setCallResult(null);

    try {
      const result = await initiateCall(targetPhone); // Now it's defined!
      
      if (result.success) {
        setCallResult(result);
        toast.success(`Call initiated successfully to ${targetPhone}`);
      } else {
        throw new Error(result.error || 'Call failed');
      }
    } catch (error: any) {
      console.error('Call failed:', error);
      toast.error(`Call failed: ${error.message}`);
      setCallResult({ error: error.message });
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
      
      const response = await fetch('http://13.204.76.229:8000/upload-csv', {
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
      const response = await fetch('http://13.204.76.229:8000/bulk-call', {
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
        const response = await fetch(`http://13.204.76.229:8000/bulk-call-status/${bulkCallId}`);
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
      }
    }, 2000);
  };
  const stopBulkCalling = async () => {
    if (!bulkCallSession) return;
    try {
      const response = await fetch(`http://13.204.76.229:8000/stop-bulk-call/${bulkCallSession.bulk_call_id}`, {
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
      case 'FAILED': return <Error />;
      default: return <CircularProgress size={16} />;
    }
  };
  const isValidPhoneNumber = (phone: string) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };
  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Logo */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <img
          src="/public/title-logo.svg"
          alt="Logo"
          style={{
            height: '48px',
            width: 'auto',
            marginRight: '16px'
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

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Phone sx={{ color: 'primary.main', fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {callStats.totalCalls}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Interviews
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ color: 'success.main', fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {callStats.completedCalls}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Completed
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <People sx={{ color: 'info.main', fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                    {contacts.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Bulk Contacts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircle sx={{ color: 'success.main', fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {bulkCallSession?.results?.filter(r => r.status === 'SUCCESS').length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Bulk Success
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for Single Call vs Bulk Call */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Single Call" />
            <Tab label="Bulk Calling" />
            <Tab label="Job Description" />
          </Tabs>

          {/* Single Call Tab */}
          {tabValue === 0 && (
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                  AI Interview Call
                </Typography>
                
                {/* Phone Number Input */}
                <Box sx={{ mb: 3, width: '100%', maxWidth: 400 }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isCallInProgress}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneInTalk />
                        </InputAdornment>
                      ),
                    }}
                    helperText="Enter phone number (e.g., +1234567890) or leave empty for default"
                    error={phoneNumber && !isValidPhoneNumber(phoneNumber)}
                  />
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={() => handleMakeCall()}
                  disabled={isCallInProgress || (phoneNumber && !isValidPhoneNumber(phoneNumber))}
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
            </Box>
          )}

          {/* Bulk Calling Tab - Made Much Larger */}
          {tabValue === 1 && (
            <Box sx={{ minHeight: '70vh' }}>
              {/* CSV Upload Section */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                  Sequential Bulk Calling Dashboard
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
                          CSV should contain: name, phone, data (optional)
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
              </Box>

              {/* Bulk Calling Controls */}
              {contacts.length > 0 && (
                <Grid container spacing={4} sx={{ minHeight: '60vh' }}>
                  <Grid item xs={12} md={8}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Contact List ({contacts.length} contacts)
                        </Typography>
                        
                        {/* Current Call Status */}
                        {isBulkCalling && bulkCallSession && (
                          <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'primary.main', bgcolor: 'primary.50' }}>
                            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Phone sx={{ color: 'primary.main', mr: 1, animation: 'pulse 2s infinite' }} />
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                  Currently Calling: {contacts[bulkCallSession.current_index]?.name}
                                </Typography>
                              </Box>
                              <Typography variant="body1" color="textSecondary">
                                {contacts[bulkCallSession.current_index]?.phone}
                              </Typography>
                              <LinearProgress sx={{ mt: 2 }} />
                            </CardContent>
                          </Card>
                        )}
                        
                        <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                          {contacts.map((contact, index) => (
                            <Card
                              key={index}
                              sx={{
                                mb: 2,
                                bgcolor: bulkCallSession?.current_index === index && isBulkCalling ? 'primary.50' : 
                                        bulkCallSession?.results?.find(r => r.contact.phone === contact.phone) ? 'grey.50' : 'white',
                                border: bulkCallSession?.current_index === index && isBulkCalling ? '2px solid' : '1px solid',
                                borderColor: bulkCallSession?.current_index === index && isBulkCalling ? 'primary.main' : 'grey.300'
                              }}
                            >
                              <CardContent>
                                <Grid container alignItems="center">
                                  <Grid item xs={12} sm={4}>
                                    <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                                      {contact.name}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={4}>
                                    <Typography variant="body1" color="textSecondary">
                                      {contact.phone}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={4}>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                      {bulkCallSession?.results?.find(r => r.contact.phone === contact.phone) && (
                                        <Chip
                                          icon={getStatusIcon(bulkCallSession.results.find(r => r.contact.phone === contact.phone)!.status)}
                                          label={bulkCallSession.results.find(r => r.contact.phone === contact.phone)!.status}
                                          color={getStatusColor(bulkCallSession.results.find(r => r.contact.phone === contact.phone)!.status) as any}
                                          size="medium"
                                        />
                                      )}
                                      {bulkCallSession?.current_index === index && isBulkCalling && (
                                        <Chip
                                          icon={<CircularProgress size={16} />}
                                          label="Calling Now..."
                                          color="primary"
                                          size="medium"
                                          sx={{ animation: 'pulse 2s infinite' }}
                                        />
                                      )}
                                    </Box>
                                  </Grid>
                                </Grid>
                                {contact.data && (
                                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                    <strong>Info:</strong> {contact.data}
                                  </Typography>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Sequential Call Control
                        </Typography>
                        
                        <Box sx={{ mb: 4 }}>
                          {!isBulkCalling ? (
                            <Button
                              variant="contained"
                              fullWidth
                              size="large"
                              startIcon={<PlayArrow />}
                              onClick={startBulkCalling}
                              disabled={contacts.length === 0}
                              sx={{ mb: 2, py: 2 }}
                            >
                              Start Sequential Calling
                            </Button>
                          ) : (
                            <Button
                              variant="contained"
                              color="error"
                              fullWidth
                              size="large"
                              startIcon={<Stop />}
                              onClick={stopBulkCalling}
                              sx={{ mb: 2, py: 2 }}
                            >
                              Stop After Current Call
                            </Button>
                          )}
                          
                          {bulkCallSession && bulkCallSession.results.length > 0 && (
                            <Button
                              variant="outlined"
                              fullWidth
                              size="large"
                              onClick={() => setShowResults(true)}
                              sx={{ py: 2 }}
                            >
                              View Results ({bulkCallSession.results.length})
                            </Button>
                          )}
                        </Box>

                        {/* Progress */}
                        {isBulkCalling && bulkCallSession && (
                          <Box sx={{ mb: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                              <Typography variant="h6">Progress</Typography>
                              <Typography variant="h6">
                                {bulkCallSession.current_index + 1} of {bulkCallSession.total_contacts}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={((bulkCallSession.current_index + 1) / bulkCallSession.total_contacts) * 100}
                              sx={{ height: 12, borderRadius: 6, mb: 2 }}
                            />
                            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                              Estimated time remaining: {Math.max(0, (bulkCallSession.total_contacts - bulkCallSession.current_index - 1) * 6)} minutes
                            </Typography>
                          </Box>
                        )}

                        {/* Statistics */}
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                          Statistics
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                {contacts.length}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Total
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={4}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {bulkCallSession?.results?.filter(r => r.status === 'SUCCESS').length || 0}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Success
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={4}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
                              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                {bulkCallSession?.results?.filter(r => r.status === 'FAILED').length || 0}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Failed
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
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
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Work sx={{ color: 'primary.main', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Job Description Configuration
                  </Typography>
                  {jdSaved && (
                    <Chip
                      icon={<CheckCircle />}
                      label="Saved"
                      color="success"
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  )}
                </Box>
                <Box>
                  <Button
                    variant="contained"
                    startIcon={savingJD ? <CircularProgress size={20} /> : <Save />}
                    onClick={handleSaveJD}
                    disabled={savingJD}
                    sx={{ mr: 2 }}
                  >
                    {savingJD ? 'Saving...' : 'Save JD'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={loading ? <CircularProgress size={20} /> : <Assessment />}
                    onClick={handleRunAnalysis}
                    disabled={loading}
                  >
                    {loading ? 'Running...' : 'Run Analysis'}
                  </Button>
                </Box>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={jobDescription.title}
                    onChange={(e) => setJobDescription({...jobDescription, title: e.target.value})}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={jobDescription.company}
                    onChange={(e) => setJobDescription({...jobDescription, company: e.target.value})}
                    sx={{ mb: 2 }}
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
        <DialogTitle>Sequential Call Results</DialogTitle>
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