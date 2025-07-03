import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  History,
  Phone,
  Visibility,
  ExpandMore,
  CheckCircle,
  Cancel,
  PlayArrow,
  Person,
  AccessTime,
  QuestionAnswer
} from '@mui/icons-material';
import { callsApi } from '../api/services';

interface InterviewResponse {
  question_number: number;
  question: string;
  answer: string;
  timestamp: string;
  duration?: string;
}

interface Interview {
  interview_id: string;
  status: 'COMPLETED' | 'TERMINATED' | 'IN_PROGRESS';
  questions_answered: number;
  total_questions: number;
  completion_time: string;
  all_validations_passed: boolean;
  termination_reason?: string;
  candidate_phone?: string;
  interviewer?: string;
  start_time?: string;
  end_time?: string;
  responses: InterviewResponse[];
}

export const CallHistory: React.FC = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadInterviews();
  }, []);

  const loadInterviews = async () => {
    try {
      setLoading(true);
      const response = await callsApi.getAllInterviewsDetailed();
      
      console.log('Raw interviews from API:', response.data.interviews);
      
      // FIXED: More thorough filtering to remove ALL "N/A" records
      const filteredInterviews = (response.data.interviews || []).filter(interview => {
        // Keep all interviews that have basic data
        const hasBasicData = interview.interview_id || interview.call_sid;
        
        // Only exclude if completely invalid
        if (!hasBasicData) {
          console.log(`Filtering out - no basic data:`, interview);
          return false;
        }
        
        // Get ALL possible time fields
        const completionTime = interview.completion_time;
        const endTime = interview.end_time;
        const startTime = interview.start_time;
        
        // Check if ANY time field is exactly "N/A"
        if (completionTime === "N/A" || endTime === "N/A" || startTime === "N/A") {
          console.log(`Filtering out - has N/A time:`, {
            id: interview.interview_id,
            completion_time: completionTime,
            end_time: endTime,
            start_time: startTime
          });
          return false;
        }
        
        // Also filter out records with 0 responses AND no valid dates
        if ((!completionTime || !endTime || !startTime) && 
            (!interview.responses || interview.responses.length === 0)) {
          console.log(`Filtering out - no dates and no responses:`, {
            id: interview.interview_id,
            responses: interview.responses?.length || 0
          });
          return false;
        }
        
        // Keep the record
        console.log(`Keeping interview:`, {
          id: interview.interview_id,
          completion_time: completionTime,
          responses: interview.responses?.length || 0
        });
        return true;
      });
      
      console.log(`Filtered from ${response.data.interviews?.length || 0} to ${filteredInterviews.length} interviews`);
      setInterviews(filteredInterviews);
    } catch (error: any) {
      console.error('Error loading interviews:', error);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };
  const getActualStatus = (interview: Interview) => {
    if (interview.status === 'TERMINATED' || interview.status === 'COMPLETED') {
      return interview.status;
    }
    if (interview.status === 'IN_PROGRESS') {
      if (interview.end_time) {
        return 'TERMINATED';
      }
      const startTime = interview.start_time || interview.completion_time;
      if (startTime) {
        const start = new Date(startTime);
        const now = new Date();
        const hoursSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (hoursSinceStart > 2) {
          return 'HUNG_UP';
        }
      }
    }
    
    return interview.status;
  };
  const getStatusChip = (interview: Interview) => {
    const actualStatus = getActualStatus(interview);
    switch (actualStatus) {
      case 'COMPLETED':
        return (
          <Chip
            icon={<CheckCircle />}
            label="Completed"
            color="success"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        );
      case 'TERMINATED':
        return (
          <Chip
            icon={<Cancel />}
            label="Terminated"
            color="error"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        );
      case 'HUNG_UP':
        return (
          <Chip
            icon={<Cancel />}
            label="Hung Up"
            color="warning"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        );
      case 'IN_PROGRESS':
        return (
          <Chip
            icon={<PlayArrow />}
            label="In Progress"
            color="info"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        );
      default:
        return (
          <Chip
            label={actualStatus}
            color="default"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  const getCompletionRate = (questionsAnswered: number, totalQuestions: number) => {
    if (totalQuestions === 0) return 0;
    
    // Fix for the backend issue: if total_questions is less than questions_answered, 
    // use questions_answered as the total to prevent >100%
    const actualTotal = Math.max(totalQuestions, questionsAnswered);
    
    const rate = Math.round((questionsAnswered / actualTotal) * 100);
    return Math.min(rate, 100); // Cap at 100%
  };
  const formatCompletionRate = (questionsAnswered: number, totalQuestions: number) => {
    // Fix the display to show correct total
    const actualTotal = Math.max(totalQuestions, questionsAnswered, 8); // 9 is the actual total questions (0-8)
    const rate = getCompletionRate(questionsAnswered, actualTotal);
    
    return {
      displayText: `${questionsAnswered}/${actualTotal}`,
      percentage: rate
    };
  };

  const handleViewDetails = (interview: Interview) => {
    setSelectedInterview(interview);
    setDetailsOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={50} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading interview history...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <History sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            Interview Call History
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          View and analyze all completed AI interview calls
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {interviews.length}
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
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {interviews.filter(i => i.status === 'COMPLETED').length}
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
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Cancel sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    {interviews.filter(i => {
                      const status = getActualStatus(i);
                      return status === 'TERMINATED' || status === 'HUNG_UP';
                    }).length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Terminated/Hung Up
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PlayArrow sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                    {interviews.filter(i => getActualStatus(i) === 'IN_PROGRESS').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Now
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Interviews Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
            All Interview Records
          </Typography>
          
          {interviews.length === 0 ? (
            <Alert severity="info">
              No interview records found. Start by making your first AI interview call.
            </Alert>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Interview ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Candidate</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {interviews.map((interview) => (
                    <TableRow key={interview.interview_id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {interview.interview_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {getStatusChip(interview)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(interview.completion_time)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Person sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {interview.candidate_phone || 'Not provided'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ mr: 1 }}>
                            {(() => {
                              const formatted = formatCompletionRate(interview.questions_answered, interview.total_questions);
                              return formatted.displayText;
                            })()}
                          </Typography>
                          <Chip
                            label={`${(() => {
                              const formatted = formatCompletionRate(interview.questions_answered, interview.total_questions);
                              return formatted.percentage;
                            })()}%`}
                            size="small"
                            color={(() => {
                              const formatted = formatCompletionRate(interview.questions_answered, interview.total_questions);
                              return formatted.percentage >= 80 ? 'success' : 'warning';
                            })()}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <AccessTime sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {interview.start_time && interview.end_time
                              ? `${Math.round((new Date(interview.end_time).getTime() - new Date(interview.start_time).getTime()) / 60000)}m`
                              : 'N/A'
                            }
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(interview)}
                            color="primary"
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Interview Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <QuestionAnswer sx={{ mr: 2, color: 'primary.main' }} />
            Interview Details - {selectedInterview?.interview_id}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedInterview && (
            <Box>
              {/* Interview Info */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Status</Typography>
                  {getStatusChip(selectedInterview)}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Completion Rate</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {(() => {
                      const formatted = formatCompletionRate(selectedInterview.questions_answered, selectedInterview.total_questions);
                      return `${formatted.percentage}% (${formatted.displayText})`;
                    })()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Start Time</Typography>
                  <Typography variant="body1">
                    {selectedInterview.start_time ? formatDate(selectedInterview.start_time) : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">End Time</Typography>
                  <Typography variant="body1">
                    {selectedInterview.end_time ? formatDate(selectedInterview.end_time) : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Questions and Answers */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Questions & Answers
              </Typography>

              {selectedInterview.responses.map((response, index) => (
                <Accordion key={index} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mr: 2 }}>
                        Q{response.question_number}:
                      </Typography>
                      <Typography variant="body1" sx={{ flex: 1 }}>
                        {response.question.length > 80 
                          ? `${response.question.substring(0, 80)}...` 
                          : response.question
                        }
                      </Typography>
                      {response.duration && (
                        <Chip label={response.duration} size="small" color="info" />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Question:
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2, fontStyle: 'italic' }}>
                        "{response.question}"
                      </Typography>
                      
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Answer:
                      </Typography>
                      <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="body1">
                          {response.answer}
                        </Typography>
                      </Paper>
                      
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                        Answered at: {formatDate(response.timestamp)}
                      </Typography>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}

              {selectedInterview.termination_reason && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>Termination Reason:</strong> {selectedInterview.termination_reason}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

