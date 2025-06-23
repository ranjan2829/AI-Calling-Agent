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
  InputLabel
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
  Pause
} from '@mui/icons-material';
import { toast } from 'react-toastify';

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
  call_duration?: string;
}

interface BulkCallSession {
  bulk_call_id: string;
  status: string;
  current_index: number;
  total_contacts: number;
  completed_calls: number;
  results: CallResult[];
  start_time: string;
  end_time?: string;
}

export const BulkCallDashboard: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [bulkCallSession, setBulkCallSession] = useState<BulkCallSession | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'time'>('time');

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
        setContacts(result.contacts);
        toast.success(`${result.count} contacts loaded successfully!`);
      } else {
        toast.error(result.error);
      }
    } catch (error: any) {
      toast.error('Failed to upload CSV: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const startBulkCalling = async () => {
    if (contacts.length === 0) return;
    
    setIsCalling(true);
    
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
        
        // Start polling for status more frequently
        pollBulkCallStatus(result.bulk_call_id);
        toast.success('Sequential bulk calling started! Calls will be made one by one.');
      } else {
        toast.error(result.error);
        setIsCalling(false);
      }
    } catch (error: any) {
      toast.error('Failed to start bulk calling: ' + error.message);
      setIsCalling(false);
    }
  };

  const pollBulkCallStatus = async (bulkCallId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/bulk-call-status/${bulkCallId}`);
        const status = await response.json();
        
        if (!status.error) {
          setBulkCallSession(status);
          
          if (status.status === 'COMPLETED' || status.status === 'STOPPED' || status.status === 'ERROR') {
            clearInterval(pollInterval);
            setIsCalling(false);
            
            if (status.status === 'COMPLETED') {
              toast.success(`Bulk calling completed! ${status.results.filter((r: CallResult) => r.status === 'SUCCESS').length} successful calls.`);
            } else if (status.status === 'STOPPED') {
              toast.info('Bulk calling was stopped.');
            }
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 3000);
  };

  const stopBulkCalling = async () => {
    if (!bulkCallSession) return;
    
    try {
      const response = await fetch(`http://localhost:8000/stop-bulk-call/${bulkCallSession.bulk_call_id}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.info('Bulk calling stopped. Current call will complete first.');
      }
    } catch (error: any) {
      toast.error('Failed to stop bulk calling: ' + error.message);
    }
  };

  // Sort results by best candidates first
  const getSortedResults = (results: CallResult[]) => {
    const sortedResults = [...results];
    
    switch (sortBy) {
      case 'status':
        // SUCCESS first, then FAILED
        return sortedResults.sort((a, b) => {
          if (a.status === 'SUCCESS' && b.status === 'FAILED') return -1;
          if (a.status === 'FAILED' && b.status === 'SUCCESS') return 1;
          return 0;
        });
      case 'name':
        return sortedResults.sort((a, b) => a.contact.name.localeCompare(b.contact.name));
      case 'time':
      default:
        return sortedResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

  const getCallStatusMessage = (result: CallResult) => {
    if (result.status === 'SUCCESS') {
      return `Interview completed successfully${result.call_duration ? ` (${result.call_duration}s)` : ''}`;
    }
    return result.message;
  };

  const getCurrentCallContact = () => {
    if (!bulkCallSession || !isCalling) return null;
    return contacts[bulkCallSession.current_index];
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
          Sequential Bulk Call Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Upload CSV and call multiple contacts one by one automatically
        </Typography>
      </Box>

      {/* Upload Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Upload sx={{ color: 'primary.main', mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Upload Contact List
            </Typography>
          </Box>
          
          <Box
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'grey.50' }
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
            <label htmlFor="csv-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
              <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                {isUploading ? 'Processing...' : 'Upload CSV File'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                CSV should contain: name, phone, data (optional)
              </Typography>
            </label>
          </Box>
          
          {contacts.length > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ mr: 1 }} />
                <Typography>
                  {contacts.length} contacts loaded successfully - Calls will be made sequentially
                </Typography>
              </Box>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Current Call Status */}
      {isCalling && getCurrentCallContact() && (
        <Card sx={{ mb: 4, borderLeft: 4, borderColor: 'primary.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Phone sx={{ color: 'primary.main', mr: 1, animation: 'pulse 2s infinite' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Currently Calling
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {getCurrentCallContact()?.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {getCurrentCallContact()?.phone}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="textSecondary">
                  Call {bulkCallSession.current_index + 1} of {bulkCallSession.total_contacts}
                </Typography>
                <LinearProgress sx={{ mt: 1 }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Control Panel */}
      {contacts.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                  Contact List ({contacts.length} contacts)
                </Typography>
                
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {contacts.map((contact, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        mb: 1,
                        bgcolor: bulkCallSession?.current_index === index && isCalling ? 'primary.50' : 
                                bulkCallSession?.results?.find(r => r.contact.phone === contact.phone) ? 'grey.50' : 'white'
                      }}
                    >
                      <Grid container alignItems="center">
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                            {contact.name}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="textSecondary">
                            {contact.phone}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {bulkCallSession?.results?.find(r => r.contact.phone === contact.phone) && (
                              <Chip
                                icon={getStatusIcon(bulkCallSession.results.find(r => r.contact.phone === contact.phone)!.status)}
                                label={bulkCallSession.results.find(r => r.contact.phone === contact.phone)!.status}
                                color={getStatusColor(bulkCallSession.results.find(r => r.contact.phone === contact.phone)!.status) as any}
                                size="small"
                              />
                            )}
                            {bulkCallSession?.current_index === index && isCalling && (
                              <Chip
                                icon={<Schedule />}
                                label="In Progress..."
                                color="primary"
                                size="small"
                                sx={{ animation: 'pulse 2s infinite' }}
                              />
                            )}
                            {bulkCallSession?.current_index > index && (
                              <Chip
                                label="Completed"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                      {contact.data && (
                        <Typography variant="caption" color="textSecondary">
                          {contact.data}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                  Sequential Call Control
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  {!isCalling ? (
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      startIcon={<PlayArrow />}
                      onClick={startBulkCalling}
                      disabled={contacts.length === 0}
                      sx={{ mb: 2 }}
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
                      sx={{ mb: 2 }}
                    >
                      Stop After Current Call
                    </Button>
                  )}
                  
                  {bulkCallSession && bulkCallSession.results.length > 0 && (
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => setShowResults(true)}
                    >
                      View Sorted Results
                    </Button>
                  )}
                </Box>

                {/* Progress */}
                {isCalling && bulkCallSession && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Overall Progress</Typography>
                      <Typography variant="body2">
                        {bulkCallSession.completed_calls} of {bulkCallSession.total_contacts}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(bulkCallSession.completed_calls / bulkCallSession.total_contacts) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      Estimated time remaining: {Math.max(0, (bulkCallSession.total_contacts - bulkCallSession.completed_calls) * 6)} minutes
                    </Typography>
                  </Box>
                )}

                {/* Statistics */}
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
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
                        {bulkCallSession?.results?.filter(r => r.status === 'SUCCESS').length || 0}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Success
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        {bulkCallSession?.results?.filter(r => r.status === 'FAILED').length || 0}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
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

      {/* Sorted Results Dialog */}
      <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Call Results - Best Candidates First</Typography>
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
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Call Details</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getSortedResults(bulkCallSession.results).map((result, index) => (
                    <TableRow key={index} sx={{ backgroundColor: result.status === 'SUCCESS' ? 'success.50' : 'inherit' }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          #{index + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {result.contact.name}
                        </Typography>
                        {result.contact.data && (
                          <Typography variant="caption" color="textSecondary">
                            {result.contact.data}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{result.contact.phone}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(result.status)}
                          label={result.status}
                          color={getStatusColor(result.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {result.call_sid || 'No Call ID'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {getCallStatusMessage(result)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(result.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
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