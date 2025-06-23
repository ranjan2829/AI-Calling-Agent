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
      setInterviews(response.data.interviews || []);
    } catch (error: any) {
      console.error('Error loading interviews:', error);
      // Mock data for development
      setInterviews([
        {
          interview_id: '1',
          status: 'COMPLETED',
          questions_answered: 8,
          total_questions: 10,
          completion_time: '2024-01-15T10:30:00Z',
          all_validations_passed: true,
          candidate_phone: '+1234567890',
          interviewer: 'AI Assistant',
          start_time: '2024-01-15T10:00:00Z',
          end_time: '2024-01-15T10:30:00Z',
          responses: [
            {
              question_number: 1,
              question: 'Tell me about yourself and your background in software development.',
              answer: 'I have 5 years of experience in full-stack development, primarily working with React, Node.js, and Python.',
              timestamp: '2024-01-15T10:01:00Z',
              duration: '2:30'
            },
            {
              question_number: 2,
              question: 'What programming languages are you most comfortable with?',
              answer: 'I\'m most comfortable with JavaScript, Python, and Java. I also have experience with TypeScript and Go.',
              timestamp: '2024-01-15T10:03:30Z',
              duration: '1:45'
            }
          ]
        },
        {
          interview_id: '2',
          status: 'TERMINATED',
          questions_answered: 3,
          total_questions: 10,
          completion_time: '2024-01-14T14:15:00Z',
          all_validations_passed: false,
          termination_reason: 'Candidate disconnected',
          candidate_phone: '+1987654321',
          interviewer: 'AI Assistant',
          start_time: '2024-01-14T14:00:00Z',
          end_time: '2024-01-14T14:15:00Z',
          responses: [
            {
              question_number: 1,
              question: 'Tell me about yourself and your background in software development.',
              answer: 'I am a recent graduate with some internship experience in web development.',
              timestamp: '2024-01-14T14:01:00Z',
              duration: '1:20'
            }
          ]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filterValidInterviews = (interviews: any[]) => {
    return interviews.filter(interview => {
      // Skip interviews with these patterns
      const skipPatterns = [
        'My_Name',
        'BULK', 
        'My',
        'Ohh',
        'test',
        'Test'
      ];
      
      const candidateName = interview.candidate_name || interview.name || '';
      const interviewId = interview.interview_id || interview.call_id || '';
      
      // Skip if candidate name matches skip patterns
      if (skipPatterns.some(pattern => candidateName.toLowerCase().includes(pattern.toLowerCase()))) {
        return false;
      }
      
      // Skip if interview ID contains analysis patterns
      if (interviewId.includes('JD_ANALYSIS') || interviewId.includes('COMPLETED')) {
        return false;
      }
      
      // Skip if responses are empty or invalid
      const responses = interview.responses || [];
      if (!Array.isArray(responses) || responses.length === 0) {
        return false;
      }
      
      // Skip if no proper candidate name
      if (!candidateName || candidateName === 'Not provided' || candidateName.length < 2) {
        return false;
      }
      
      return true;
    });
  };

  const getStatusChip = (status: string, validationsPassed?: boolean) => {
    switch (status) {
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
      case 'IN_PROGRESS':
        return (
          <Chip
            icon={<PlayArrow />}
            label="In Progress"
            color="warning"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        );
      default:
        return (
          <Chip
            label={status}
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
    return Math.round((questionsAnswered / totalQuestions) * 100);
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
                    {interviews.filter(i => i.status === 'TERMINATED').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Terminated
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          
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
                        {getStatusChip(interview.status, interview.all_validations_passed)}
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
                            {interview.questions_answered}/{interview.total_questions}
                          </Typography>
                          <Chip
                            label={`${getCompletionRate(interview.questions_answered, interview.total_questions)}%`}
                            size="small"
                            color={getCompletionRate(interview.questions_answered, interview.total_questions) >= 80 ? 'success' : 'warning'}
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
                  {getStatusChip(selectedInterview.status, selectedInterview.all_validations_passed)}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Completion Rate</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {getCompletionRate(selectedInterview.questions_answered, selectedInterview.total_questions)}%
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

