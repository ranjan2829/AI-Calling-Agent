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
  Divider
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
  Refresh
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
}

// NEW: Saved bulk results interface
interface SavedBulkResult {
  bulk_call_id: string;
  total_candidates: number;
  successful_calls: number;
  failed_calls: number;
  results: CallResult[];
  created_at: string;
  status: string;
}

export const BulkCallDashboard: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [bulkCallSession, setBulkCallSession] = useState<BulkCallSession | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'time'>('status');
  
  // NEW: Persistent bulk results state
  const [savedBulkResults, setSavedBulkResults] = useState<SavedBulkResult[]>([]);
  const [loadingSavedResults, setLoadingSavedResults] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // NEW: Load saved bulk results on component mount
  useEffect(() => {
    loadSavedBulkResults();
  }, []);

  // NEW: Load saved bulk call results
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

  // NEW: Save bulk call results
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
        // Reload saved results to include the new one
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
      
      if (result.success) {
        // FIX: Always ensure contacts is an array and process properly
        const processedContacts = Array.isArray(result.contacts) ? result.contacts : [];
        
        // Enhanced contact processing with safe array handling
        const validContacts = processedContacts.map((contact: any) => ({
          name: contact.name || contact.Name || `Contact_${Math.random().toString(36).substr(2, 4)}`,
          phone: contact.phone || contact.Phone || contact.mobile || contact.Mobile,
          email: contact.email || contact.Email || '',
          experience: contact.experience || contact.Experience || '',
          skills: contact.skills || contact.Skills || '',
          data: contact.data || ''
        })).filter((contact: any) => contact.phone && contact.phone.trim()); // Only include contacts with phone numbers
        
        setContacts(validContacts);
        console.log('✅ Contacts loaded:', validContacts);
        
        toast.success(`✅ ${validContacts.length} contacts loaded successfully! Review the list and click "Start AI Bulk Interviews" to begin calling.`);
      } else {
        // FIX: Handle error case properly
        setContacts([]); // Reset contacts on error
        toast.error(result.error || 'Failed to process CSV file');
        console.error('❌ CSV upload failed:', result.error);
      }
    } catch (error: any) {
      // FIX: Reset contacts on error
      setContacts([]);
      toast.error('Failed to upload CSV: ' + error.message);
      console.error('❌ CSV upload error:', error);
    } finally {
      setIsUploading(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  const startBulkCalling = async () => {
    if (!contacts || contacts.length === 0) {
      toast.error('❌ No contacts available for calling. Please upload a CSV file first.');
      return;
    }
    
    // FIX: Validate contacts have phone numbers
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
        body: JSON.stringify(validContacts), // Use validContacts instead of contacts
      });
      
      const result = await response.json();
      console.log('📞 Bulk call response:', result);
      
      if (result.success) {
        const newSession: BulkCallSession = {
          bulk_call_id: result.bulk_call_id,
          status: 'COMPLETED', // Mark as completed since backend processes all calls
          total_candidates: result.total_candidates,
          successful_calls: result.successful_calls || 0,
          failed_calls: result.failed_calls || 0,
          results: result.results || [],
          start_time: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        
        setBulkCallSession(newSession);
        setShowResults(true); // Show results immediately
        
        // NEW: Save results automatically
        await saveBulkResults(newSession);
        
        toast.success(`🎉 Bulk calling completed! ${result.successful_calls}/${result.total_candidates} calls initiated successfully.`);
        
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
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
    }
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'success' : 'error';
  };

  const getStatusIcon = (success: boolean) => {
    return success ? <CheckCircle /> : <Error />;
  };

  const getStatusLabel = (success: boolean) => {
    return success ? 'SUCCESS' : 'FAILED';
  };

  // NEW: Load specific bulk result
  const loadBulkResult = (savedResult: SavedBulkResult) => {
    setBulkCallSession({
      bulk_call_id: savedResult.bulk_call_id,
      status: savedResult.status,
      total_candidates: savedResult.total_candidates,
      successful_calls: savedResult.successful_calls,
      failed_calls: savedResult.failed_calls,
      results: savedResult.results,
      created_at: savedResult.created_at
    });
    setShowHistoryDialog(false);
    setShowResults(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
          📞 AI Bulk Call Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Upload CSV and automatically call multiple candidates with AI interviewer
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
          onClick={loadSavedBulkResults}
          disabled={loadingSavedResults}
        >
          {loadingSavedResults ? 'Loading...' : 'Refresh'}
        </Button>

        {/* Stats */}
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
                  icon={<CheckCircle />} 
                  label={`${bulkCallSession.successful_calls} successful`} 
                  color="success" 
                  size="small"
                />
                <Chip 
                  icon={<Error />} 
                  label={`${bulkCallSession.failed_calls} failed`} 
                  color="error" 
                  size="small"
                />
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Upload Section */}
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
                    CSV should contain: name, phone, email (optional), experience (optional), skills (optional)
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
                    Review the contact list below and click "Start AI Bulk Interviews" to begin calling.
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
          {/* Contact List */}
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
                        <Grid item xs={12} sm={3}>
                          <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                            👤 {contact.name}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="body2" color="textSecondary">
                            📞 {contact.phone}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          {contact.email && (
                            <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.8rem' }}>
                              ✉️ {contact.email.substring(0, 15)}{contact.email.length > 15 ? '...' : ''}
                            </Typography>
                          )}
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          {contact.experience && (
                            <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.8rem' }}>
                              🎯 {contact.experience}
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                      {contact.skills && (
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                          💼 Skills: {contact.skills}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Control Panel */}
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
                    >
                      View Results ({bulkCallSession.results.length})
                    </Button>
                  )}
                </Box>

                {/* Statistics */}
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  📊 Call Statistics
                </Typography>
                <Grid container spacing={2}>
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
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        {bulkCallSession?.successful_calls || 0}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Success
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        {bulkCallSession?.failed_calls || 0}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Failed
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

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

                {/* Success Message */}
                {bulkCallSession && !isCalling && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      ✅ Bulk calling completed! 
                      <br />
                      <strong>{bulkCallSession.successful_calls}/{bulkCallSession.total_candidates}</strong> calls initiated successfully.
                      <br />
                      Check the interview results dashboard for detailed analysis.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Empty State */}
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
              CSV format: name, phone, email (optional), experience (optional), skills (optional)
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Results Dialog */}
      <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">📊 AI Interview Results</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value as 'name' | 'status' | 'time')}
              >
                <MenuItem value="status">Success First</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="time">Time</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogTitle>
        <DialogContent>
          {bulkCallSession && (
            <>
              {/* Summary */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Bulk Call ID:</strong> {bulkCallSession.bulk_call_id} | 
                  <strong> Total:</strong> {bulkCallSession.total_candidates} | 
                  <strong> Success:</strong> {bulkCallSession.successful_calls} | 
                  <strong> Failed:</strong> {bulkCallSession.failed_calls} | 
                  <strong> Success Rate:</strong> {Math.round((bulkCallSession.successful_calls / bulkCallSession.total_candidates) * 100)}%
                </Typography>
              </Alert>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Rank</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell><strong>Phone</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Call Details</strong></TableCell>
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getSortedResults(bulkCallSession.results).map((result, index) => (
                      <TableRow key={index} sx={{ backgroundColor: result.success ? 'success.50' : 'inherit' }}>
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
                          <Typography variant="body2">
                            {result.call_sid || 'No Call ID'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {result.success ? 'Interview initiated successfully' : (result.error || 'Call failed')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {result.success && result.call_sid && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                // Navigate to interview details
                                window.open(`/interview-details/${result.call_sid}`, '_blank');
                              }}
                            >
                              View Interview
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResults(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
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
                    <TableCell><strong>Success</strong></TableCell>
                    <TableCell><strong>Failed</strong></TableCell>
                    <TableCell><strong>Success Rate</strong></TableCell>
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
                        <Chip label={result.successful_calls} color="success" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={result.failed_calls} color="error" size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {Math.round((result.successful_calls / result.total_candidates) * 100)}%
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