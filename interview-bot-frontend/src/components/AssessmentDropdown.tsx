import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  CircularProgress,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider
} from '@mui/material';
import {
  Search,
  Close,
  Assessment,
  Work,
  Assignment,
  Person,
  Schedule,
  ContentCopy,
  Email as EmailIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface AssessmentData {
  id: string;
  testName: string;
  jobRole: string;
  candidateCount: number;
  createdAt: string;
  status: 'active' | 'inactive';
  description?: string;
  experience?: number;
  duration?: number;
  totalTopics?: number;
  allowVideoRecording?: boolean;
  createdBy?: string;
}

interface AssessmentDropdownProps {
  onAssessmentSelect?: (assessment: AssessmentData | null) => void;
  selectedAssessment?: AssessmentData | null;
}

// External API URLs - configure these in environment variables
const API_BASE_URL = import.meta.env.VITE_ASSESSMENT_API_URL || '';
const FALLBACK_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const AssessmentDropdown: React.FC<AssessmentDropdownProps> = ({ 
  onAssessmentSelect,
  selectedAssessment: externalSelectedAssessment
}) => {
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [showAssessmentDropdown, setShowAssessmentDropdown] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentData | null>(
    externalSelectedAssessment || null
  );
  const [assessmentSearchTerm, setAssessmentSearchTerm] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedAssessmentForEmail, setSelectedAssessmentForEmail] = useState<AssessmentData | null>(null);
  const [candidateEmailInput, setCandidateEmailInput] = useState('');
  const [sendingEmails, setSendingEmails] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (externalSelectedAssessment) {
      setSelectedAssessment(externalSelectedAssessment);
    }
  }, [externalSelectedAssessment]);

  const fetchAssessments = async (page = 1, limit = 10, searchTerm = '') => {
    try {
      setLoadingAssessments(true);
      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
      
      const response = await fetch(`${API_BASE_URL}/assessment/?page=${page}&limit=${limit}&sortOrder=DESC&sortBy=createdAt&searchBy=${searchParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 401) {
          setAssessments([]);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assessments = data.result?.assessments || [];
      
      const mappedAssessments: AssessmentData[] = assessments.map((assessment: any) => ({
        id: assessment.id,
        testName: assessment.title,
        jobRole: assessment.designation,
        candidateCount: assessment.candidateCount,
        createdAt: assessment.createdAt,
        status: assessment.isActive ? 'active' : 'inactive',
        description: assessment.description,
        experience: assessment.experience,
        duration: assessment.duration,
        totalTopics: assessment.totalTopics,
        allowVideoRecording: assessment.allowVideoRecording,
        createdBy: assessment.createdBy
      }));

      setAssessments(mappedAssessments);
    } catch (error) {
      console.error('Error fetching assessments:', error);
      setAssessments([]);
    } finally {
      setLoadingAssessments(false);
    }
  };

  const handleAssessmentSelect = async (assessment: AssessmentData) => {
    setSelectedAssessment(assessment);
    setShowAssessmentDropdown(false);
    
    if (onAssessmentSelect) {
      onAssessmentSelect(assessment);
    }
    
    toast.success(`Selected assessment: ${assessment.testName}`);
  };

  const handleAssessmentSearch = (searchTerm: string) => {
    setAssessmentSearchTerm(searchTerm);
    fetchAssessments(1, 10, searchTerm);
  };

  const handleSendEmailClick = (assessment: AssessmentData) => {
    setSelectedAssessmentForEmail(assessment);
    setCandidateEmailInput('');
    setEmailDialogOpen(true);
  };

  const generateAssessmentLink = async (assessmentId: string): Promise<string> => {
    const assessmentLink = `https://dev.d23pi31x94e0bg.amplifyapp.com/assessment/${assessmentId}`;
    return assessmentLink;
  };

  const handleSendEmailSubmit = async () => {
    if (selectedAssessmentForEmail && candidateEmailInput.trim()) {
      const assessmentLink = await generateAssessmentLink(selectedAssessmentForEmail.id);
      // Email sending logic will be handled by the parent component
      setEmailDialogOpen(false);
      setSelectedAssessmentForEmail(null);
      setCandidateEmailInput('');
      toast.success('Email functionality delegated to parent component');
    }
  };

  const handleCopyAssessmentLink = async (assessment: AssessmentData) => {
    try {
      const link = await generateAssessmentLink(assessment.id);
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        toast.success(`Assessment link copied for ${assessment.testName}!`);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          toast.success(`Assessment link copied for ${assessment.testName}!`);
        } catch (err) {
          console.error('Fallback copy failed:', err);
          window.prompt('Copy this link:', link);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy link. Please try again.');
    }
  };

  useEffect(() => {
    fetchAssessments().catch(err => {
      console.log('Assessment loading failed:', err);
    });
  }, []);

  if (!loadingAssessments && assessments.length === 0) {
    return (
      <Card sx={{ mb: 3, p: 2, backgroundColor: '#fff3cd', border: '1px solid #ffeaa7' }}>
        <Typography variant="body2" color="text.secondary">
          <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
          Assessment management is temporarily unavailable
        </Typography>
      </Card>
    );
  }

  return (
    <>
      <Box sx={{ position: 'relative', mb: 3 }}>
        <Button
          variant="outlined"
          onClick={() => setShowAssessmentDropdown(!showAssessmentDropdown)}
          sx={{ 
            minWidth: 300,
            justifyContent: 'space-between',
            textTransform: 'none',
            borderRadius: 2
          }}
          endIcon={showAssessmentDropdown ? <Close /> : <Assessment />}
        >
          {selectedAssessment 
            ? `${selectedAssessment.testName} - ${selectedAssessment.jobRole}`
            : 'Select Assessment Profile'
          }
        </Button>

        {selectedAssessment && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
              Selected: {selectedAssessment.testName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={() => handleCopyAssessmentLink(selectedAssessment)}
              >
                Copy Link
              </Button>
              <Button
                variant="outlined"
                startIcon={<Person />}
                onClick={() => {
                  toast.info(`Total candidates: ${selectedAssessment.candidateCount}`);
                }}
              >
                View Candidates ({selectedAssessment.candidateCount})
              </Button>
            </Box>
          </Box>
        )}

        {showAssessmentDropdown && (
          <Card sx={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 400,
            overflow: 'auto',
            mt: 1,
            boxShadow: 3
          }}>
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by Test Name or Job Role"
                value={assessmentSearchTerm}
                onChange={(e) => handleAssessmentSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              {loadingAssessments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : assessments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No assessments found
                </Typography>
              ) : (
                <Box>
                  {assessments.map((assessment) => (
                    <Box
                      key={assessment.id}
                      onClick={() => handleAssessmentSelect(assessment)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        borderRadius: 1,
                        border: '1px solid transparent',
                        '&:hover': {
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #e0e0e0'
                        },
                        mb: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                            {assessment.testName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {assessment.jobRole}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              <Work sx={{ fontSize: 14, mr: 0.5 }} />
                              {assessment.experience} years exp
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              <Assignment sx={{ fontSize: 14, mr: 0.5 }} />
                              {assessment.totalTopics} topics
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              <Person sx={{ fontSize: 14, mr: 0.5 }} />
                              {assessment.candidateCount} candidates
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              <Schedule sx={{ fontSize: 14, mr: 0.5 }} />
                              {new Date(assessment.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={assessment.status}
                          color={assessment.status === 'active' ? 'success' : 'default'}
                          size="small"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Card>
        )}
      </Box>

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Send Assessment Link
            </Typography>
            <IconButton onClick={() => setEmailDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAssessmentForEmail && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {selectedAssessmentForEmail.testName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Job Role: {selectedAssessmentForEmail.jobRole}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Experience: {selectedAssessmentForEmail.experience} years
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Duration: {selectedAssessmentForEmail.duration ? Math.floor(selectedAssessmentForEmail.duration / 60) : 60} minutes
              </Typography>
              <Divider sx={{ my: 2 }} />
            </Box>
          )}
          
          <TextField
            fullWidth
            label="Candidate Email"
            type="email"
            value={candidateEmailInput}
            onChange={(e) => setCandidateEmailInput(e.target.value)}
            placeholder="candidate@email.com"
            required
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            The assessment link will be sent to this email address along with instructions and assessment details.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSendEmailSubmit}
            variant="contained"
            disabled={
              !candidateEmailInput.trim() || 
              !/\S+@\S+\.\S+/.test(candidateEmailInput) ||
              sendingEmails[selectedAssessmentForEmail?.id || '']
            }
            startIcon={
              sendingEmails[selectedAssessmentForEmail?.id || ''] ? 
              <CircularProgress size={20} /> : 
              <EmailIcon />
            }
          >
            {sendingEmails[selectedAssessmentForEmail?.id || ''] ? 'Sending...' : 'Send Assessment Link'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssessmentDropdown;
