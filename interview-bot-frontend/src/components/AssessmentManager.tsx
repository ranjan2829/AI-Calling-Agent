import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import {
  Assessment,
  Email as EmailIcon,
  ContentCopy,
  Refresh,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface AssessmentData {
  id: string;
  testName: string;
  jobRole: string;
  experience: number;
  duration: number;
  totalTopics: number;
  status: string;
  assessmentLink: string;
}

interface CandidateData {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
}

const API_BASE_URL = 'http://13.204.76.229:8000';

const AssessmentManager: React.FC = () => {
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch assessments
  const fetchAssessments = async () => {
    try {
      setLoading(true);
      console.log('Fetching assessments...');
      
      const response = await fetch(`${API_BASE_URL}/api/assessments`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Assessments response:', data);
      
      if (data.success) {
        setAssessments(data.assessments);
        toast.success(`Loaded ${data.assessments.length} assessments`);
      } else {
        toast.error(data.error || 'Failed to load assessments');
      }
    } catch (error) {
      console.error('Error fetching assessments:', error);
      toast.error('Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  // Fetch candidates
  const fetchCandidates = async () => {
    try {
      setCandidatesLoading(true);
      console.log('Fetching candidates...');
      
      const response = await fetch(`${API_BASE_URL}/api/candidates`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Candidates response:', data);
      
      if (data.success) {
        setCandidates(data.candidates);
        toast.success(`Loaded ${data.candidates.length} candidates`);
      } else {
        toast.error(data.error || 'Failed to load candidates');
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setCandidatesLoading(false);
    }
  };

  // Select assessment
  const handleAssessmentSelect = (assessment: AssessmentData) => {
    setSelectedAssessment(assessment);
    toast.success(`Selected: ${assessment.testName}`);
  };

  // Copy assessment link
  const copyAssessmentLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Assessment link copied!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  // Send bulk emails
  const sendBulkEmails = async () => {
    if (!selectedAssessment) {
      toast.error('Please select an assessment first');
      return;
    }

    if (candidates.length === 0) {
      toast.error('No candidates available');
      return;
    }

    try {
      setSending(true);
      toast.info('Sending assessment invitations...');
      
      const response = await fetch(`${API_BASE_URL}/api/send-assessment-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentName: selectedAssessment.testName,
          jobRole: selectedAssessment.jobRole,
          assessmentLink: selectedAssessment.assessmentLink,
          candidates: candidates
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Bulk email result:', result);

      if (result.success) {
        toast.success(`${result.message} - ${result.stats.sent} sent, ${result.stats.failed} failed`);
      } else {
        toast.error(result.error || 'Failed to send emails');
      }
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast.error('Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchAssessments();
    fetchCandidates();
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: '1400px', mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 3 }}>
        Assessment Management
      </Typography>

      <Grid container spacing={3}>
        {/* Assessments */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Available Assessments ({assessments.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={fetchAssessments}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Box>

              {selectedAssessment && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <strong>Selected:</strong> {selectedAssessment.testName} - {selectedAssessment.jobRole}
                </Alert>
              )}

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Test Name</TableCell>
                      <TableCell>Job Role</TableCell>
                      <TableCell>Experience</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : assessments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">No assessments found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      assessments.map((assessment) => (
                        <TableRow 
                          key={assessment.id}
                          hover
                          sx={{ 
                            backgroundColor: selectedAssessment?.id === assessment.id ? '#e3f2fd' : 'inherit',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleAssessmentSelect(assessment)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {assessment.testName}
                            </Typography>
                          </TableCell>
                          <TableCell>{assessment.jobRole}</TableCell>
                          <TableCell>{assessment.experience} years</TableCell>
                          <TableCell>
                            {assessment.duration ? Math.floor(assessment.duration / 60) + ' min' : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={assessment.status}
                              color={assessment.status === 'active' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              startIcon={<ContentCopy />}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyAssessmentLink(assessment.assessmentLink);
                              }}
                            >
                              Copy Link
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Candidates */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Candidates ({candidates.length})
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  size="small"
                  onClick={fetchCandidates}
                  disabled={candidatesLoading}
                >
                  Refresh
                </Button>
              </Box>

              {candidatesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {candidates.map((candidate) => (
                    <Box 
                      key={candidate.id} 
                      sx={{ 
                        p: 2, 
                        mb: 1, 
                        border: '1px solid #e0e0e0', 
                        borderRadius: 1,
                        backgroundColor: '#f9f9f9'
                      }}
                    >
                      <Typography variant="body2" fontWeight="medium">
                        {candidate.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {candidate.email}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        {candidate.phone}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<EmailIcon />}
                  onClick={sendBulkEmails}
                  disabled={!selectedAssessment || candidates.length === 0 || sending}
                  size="large"
                >
                  {sending ? 'Sending...' : `Send Assessment to All ${candidates.length} Candidates`}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AssessmentManager;