import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  useTheme,
  Tooltip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid
} from '@mui/material';
import {
  Visibility,
  Phone,
  CalendarToday,
  AccessTime,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  ExpandMore,
  Person,
  Email,
  QuestionAnswer
} from '@mui/icons-material';
import { toast } from 'react-toastify';

const API_BASE_URL = 'http://13.204.76.229:8000';

interface InterviewResponse {
  question_number: number;
  question: string;
  answer: string;
  duration?: string;
}

interface CallHistoryItem {
  interview_id: string;
  candidate_name: string;
  candidate_phone: string;
  candidate_email?: string;
  status: string;
  start_time: string;
  duration?: string;
  responses: InterviewResponse[];
  tag?: string;
  tagCandidate?: any;
}

export const CallHistory = () => {
  const theme = useTheme();
  const [interviews, setInterviews] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<CallHistoryItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/interviews-detailed`);
      const data = await response.json();

      if (data.success) {
        // Process and enhance data
        const processedInterviews = await enhanceInterviewsWithTagData(data.interviews || []);
        setInterviews(processedInterviews);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  // Helper to load tag data (reused from Dashboard)
  const loadAllTagCandidates = async (): Promise<{[tagName: string]: any[]}> => {
    try {
      const tagCandidatesMap: {[tagName: string]: any[]} = {};
      const tagsResponse = await fetch('http://13.204.76.229:8000/local-tags-summary-exact');
      if (!tagsResponse.ok) return tagCandidatesMap;
      const tagsResult = await tagsResponse.json();
      
      if (tagsResult.success && tagsResult.tags) {
        for (const tag of tagsResult.tags) {
          try {
            const candidatesResponse = await fetch(`http://13.204.76.229:8000/search-candidates-exact`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tag_name: tag.tag_name, case_sensitive: true })
            });
            if (candidatesResponse.ok) {
              const candidatesResult = await candidatesResponse.json();
              if (candidatesResult.success && candidatesResult.candidates) {
                tagCandidatesMap[tag.tag_name] = candidatesResult.candidates;
              }
            }
          } catch (e) {}
        }
      }
      return tagCandidatesMap;
    } catch (error) {
      return {};
    }
  };

  const enhanceInterviewsWithTagData = async (interviews: any[]) => {
    const tagCandidatesMap = await loadAllTagCandidates();
    
    return interviews.map(interview => {
      // Find candidate in tags
      let tagCandidate = null;
      let foundTagName = null;
      
      // Try to find matching candidate in all tags
      for (const [tagName, candidates] of Object.entries(tagCandidatesMap)) {
        const found = (candidates as any[]).find((c: any) => {
          // Match by phone (most reliable)
          if (c.phone && interview.candidate_phone) {
            const cPhone = c.phone.replace(/\D/g, '');
            const iPhone = interview.candidate_phone.replace(/\D/g, '');
            if (cPhone.includes(iPhone.slice(-10)) || iPhone.includes(cPhone.slice(-10))) return true;
          }
          // Match by email
          if (c.email && interview.candidate_email && c.email.toLowerCase() === interview.candidate_email.toLowerCase()) return true;
          return false;
        });
        
        if (found) {
          tagCandidate = found;
          foundTagName = tagName;
          break;
        }
      }
      
      if (tagCandidate) {
        return {
          ...interview,
          candidate_name: tagCandidate.name || interview.candidate_name,
          candidate_phone: tagCandidate.phone || interview.candidate_phone,
          candidate_email: tagCandidate.email || interview.candidate_email,
          tag: foundTagName,
          tagCandidate: tagCandidate
        };
      }
      
      return interview;
    });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleViewDetails = (interview: CallHistoryItem) => {
    setSelectedInterview(interview);
    setDetailsOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'TERMINATED': return 'error';
      default: return 'default';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Helper to get best available name/phone
  const getCandidateInfo = (interview: CallHistoryItem) => {
    const name = interview.tagCandidate?.name || interview.candidate_name || 'Unknown Candidate';
    const phone = interview.tagCandidate?.phone || interview.candidate_phone || 'No Phone';
    const email = interview.tagCandidate?.email || interview.candidate_email || 'No Email';
    
    // Clean up name if it looks like a phone number placeholder
    const displayName = name.startsWith('Candidate_') || name.startsWith('Phone_') ? 'Unknown Candidate' : name;
    
    return { name: displayName, phone, email };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box className="animate-fade-in">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
            Call History
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and analyze past interview calls
          </Typography>
        </Box>
        <Button
          startIcon={<Refresh />}
          onClick={fetchHistory}
          variant="outlined"
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: 'text.secondary',
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.main',
              backgroundColor: 'rgba(0, 217, 255, 0.05)'
            }
          }}
        >
          Refresh
        </Button>
      </Box>

      <TableContainer 
        component={Paper} 
        sx={{ 
          background: 'rgba(30, 41, 59, 0.4)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Candidate</TableCell>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Date & Time</TableCell>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Duration</TableCell>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interviews.map((interview) => {
              const { name, phone } = getCandidateInfo(interview);
              return (
                <TableRow 
                  key={interview.interview_id}
                  sx={{ 
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box 
                        sx={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #00d9ff 0%, #00a8cc 100%)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 'bold'
                        }}
                      >
                        {name.charAt(0)}
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                          {name}
                        </Typography>
                        {/* Hide phone number in main view for cleaner UI */}
                        {interview.tag && (
                          <Chip 
                            label={interview.tag} 
                            size="small" 
                            sx={{ 
                              mt: 0.5, 
                              height: 20, 
                              fontSize: '0.65rem',
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              color: 'text.secondary'
                            }} 
                          />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={interview.status}
                      color={getStatusColor(interview.status) as any}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                      <CalendarToday sx={{ fontSize: 16 }} />
                      <Typography variant="body2">
                        {new Date(interview.start_time).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', ml: 1 }}>
                        {new Date(interview.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                      <AccessTime sx={{ fontSize: 16 }} />
                      <Typography variant="body2">
                        {interview.responses.length > 0 ? `${interview.responses.length} questions` : '-'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton 
                        onClick={() => handleViewDetails(interview)}
                        sx={{ 
                          color: 'primary.main',
                          '&:hover': { backgroundColor: 'rgba(0, 217, 255, 0.1)' }
                        }}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {interviews.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="h6" gutterBottom>No calls found</Typography>
                    <Typography variant="body2">Start a new interview to see history here</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Details Dialog */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <QuestionAnswer sx={{ color: 'primary.main' }} />
            <Box>
              <Typography variant="h6" sx={{ color: '#fff' }}>Interview Details</Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {selectedInterview?.interview_id}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedInterview && (
            <Box>
              {/* Candidate Info Card */}
              <Card sx={{ mb: 3, bgcolor: 'rgba(255, 255, 255, 0.05)', border: 'none' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
                    Candidate Information
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Name</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>{getCandidateInfo(selectedInterview).name}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone sx={{ color: 'text.secondary', fontSize: 20 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Phone</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>{getCandidateInfo(selectedInterview).phone}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Email sx={{ color: 'text.secondary', fontSize: 20 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Email</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>{getCandidateInfo(selectedInterview).email}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Questions */}
              <Typography variant="h6" sx={{ mb: 2, mt: 4, fontWeight: 'bold', color: '#fff' }}>
                Questions & Answers
              </Typography>
              {selectedInterview.responses.map((response, index) => (
                <Accordion 
                  key={index} 
                  sx={{ 
                    bgcolor: 'rgba(255, 255, 255, 0.02)', 
                    color: '#fff',
                    mb: 1,
                    '&:before': { display: 'none' }
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'text.secondary' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography sx={{ color: 'primary.main', fontWeight: 'bold', minWidth: 30 }}>
                        Q{response.question_number}
                      </Typography>
                      <Typography sx={{ flex: 1, color: '#e2e8f0' }}>
                        {response.question.length > 60 ? response.question.substring(0, 60) + '...' : response.question}
                      </Typography>
                      {response.duration && (
                        <Chip label={response.duration} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'text.secondary' }} />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ pl: 4 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Full Question:</Typography>
                      <Typography sx={{ mb: 2, fontStyle: 'italic', color: '#cbd5e1' }}>{response.question}</Typography>
                      
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Answer:</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.2)', color: '#fff' }}>
                        <Typography>{response.answer}</Typography>
                      </Paper>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', p: 2 }}>
          <Button onClick={() => setDetailsOpen(false)} sx={{ color: 'text.secondary' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
