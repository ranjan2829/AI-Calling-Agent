import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Alert,
  Divider,
  InputAdornment,
  Avatar
} from '@mui/material';
import {
  Search,
  Refresh,
  PlayArrow,
  Close,
  Upload,
  CheckCircle,
  Work,
  Business,
  Schedule,
  Assignment,
  TrendingUp,
  Person
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface InterviewDetails {
  interview_id: string;
  candidate_name: string;
  candidate_phone: string;
  status: string;
  questions_answered: number;
  total_questions: number;
  start_time: string;
  end_time: string;
  completion_rate: string;
  interviewer: string;
}

interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  inProgressInterviews: number;
  terminatedInterviews: number;
}

interface InterviewFormData {
  title: string;
  role: string;
  jobDescription: string;
  candidateName: string;
  candidateEmail: string;
  resume: string;
  resumeText: string;
  yearsOfExperience: number;
  totalQuestion: number;
  startTime: Date | null;
  expiryTime: Date | null;
  duration: number;
}

interface JobDescription {
  title: string;
  company: string;
  description: string;
  required_skills: string;
  experience_required: string;
}

const API_BASE_URL = 'http://13.204.76.229:8000';
const PRODUCTION_API_URL = 'https://onelabceo.com/api';

const fetchAllInterviews = async () => {
  const response = await fetch(`${API_BASE_URL}/interviews-detailed`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

const Dashboard: React.FC = () => {
  const [interviews, setInterviews] = useState<InterviewDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalInterviews: 0,
    completedInterviews: 0,
    inProgressInterviews: 0,
    terminatedInterviews: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showInterviewForm, setShowInterviewForm] = useState<string | null>(null);
  const [interviewFormData, setInterviewFormData] = useState<InterviewFormData>({
    title: '',
    role: '',
    jobDescription: '',
    candidateName: '',
    candidateEmail: '',
    resume: '',
    resumeText: 'Resume text',
    yearsOfExperience: 0,
    totalQuestion: 5,
    startTime: null,
    expiryTime: null,
    duration: 60,
  });
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [jobDescription, setJobDescription] = useState<JobDescription | null>(null);
  const [loadingJD, setLoadingJD] = useState(false);
  const [isSubmittingInterview, setIsSubmittingInterview] = useState(false);

  useEffect(() => {
    loadInterviews();
    loadJobDescription();
  }, []);

  const loadInterviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchAllInterviews();
      
      const interviewData = response.interviews || response.data || response || [];
      setInterviews(Array.isArray(interviewData) ? interviewData : []);
      
      calculateStats(interviewData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch interviews');
      console.error('Error fetching interviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadJobDescription = async () => {
    try {
      setLoadingJD(true);
      const response = await fetch(`${API_BASE_URL}/job-description`);
      if (response.ok) {
        const jdData = await response.json();
        setJobDescription(jdData);
        console.log('📋 Loaded JD:', jdData);
      }
    } catch (error) {
      console.error('Error loading job description:', error);
    } finally {
      setLoadingJD(false);
    }
  };

  const calculateStats = (interviewData: InterviewDetails[]) => {
    const validCompletedInterviews = interviewData.filter(interview => {
      const hasValidStartTime = interview.start_time && interview.start_time !== 'N/A';
      const hasProgress = interview.questions_answered > 0;
      return interview.status === 'COMPLETED' && hasValidStartTime && hasProgress;
    });

    const total = interviewData.length;
    const completed = validCompletedInterviews.length;
    const inProgress = interviewData.filter(i => i.status === 'IN_PROGRESS').length;
    const terminated = interviewData.filter(i => i.status === 'TERMINATED').length;

    setStats({
      totalInterviews: total,
      completedInterviews: completed,
      inProgressInterviews: inProgress,
      terminatedInterviews: terminated
    });
  };

  const filteredInterviews = interviews.filter(interview => {
    const matchesSearch = interview.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interview.interview_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interview.candidate_phone?.includes(searchTerm);
    const hasValidStartTime = interview.start_time && interview.start_time !== 'N/A';
    const hasProgress = interview.questions_answered > 0;
    
    return matchesSearch && interview.status === 'COMPLETED' && hasValidStartTime && hasProgress;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'TERMINATED': return 'error';
      case 'CALLBACK_REQUESTED': return 'info';
      default: return 'default';
    }
  };

  const handleInterviewFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInterviewFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, interviewId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const presignedUrlResponse = await fetch(`${PRODUCTION_API_URL}/proctor/create-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!presignedUrlResponse.ok) {
        throw new Error('Failed to get upload URL from server');
      }

      const uploadData = await presignedUrlResponse.json();
      const { uploadUrl, readUrl } = uploadData;

      if (!uploadUrl) {
        throw new Error('No upload URL received from server');
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      setInterviewFormData(prev => ({
        ...prev,
        resume: readUrl || URL.createObjectURL(file)
      }));

      setFormErrors(prev => ({
        ...prev,
        resume: ''
      }));

      toast.success('Resume uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload resume');
      setFormErrors(prev => ({
        ...prev,
        resume: error instanceof Error ? error.message : 'Failed to upload resume'
      }));
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!interviewFormData.title.trim()) newErrors.title = 'Title is required';
    if (!interviewFormData.role.trim()) newErrors.role = 'Role is required';
    if (!interviewFormData.jobDescription.trim()) newErrors.jobDescription = 'Job description is required';
    if (!interviewFormData.candidateEmail.trim()) newErrors.candidateEmail = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(interviewFormData.candidateEmail)) newErrors.candidateEmail = 'Invalid email format';
    if (!interviewFormData.resume.trim()) newErrors.resume = 'Resume is required';
    if (interviewFormData.yearsOfExperience < 0) newErrors.yearsOfExperience = 'Experience cannot be negative';
    if (interviewFormData.totalQuestion <= 0) newErrors.totalQuestion = 'Questions must be greater than 0';
    if (!interviewFormData.startTime) newErrors.startTime = 'Start time is required';
    if (!interviewFormData.expiryTime) newErrors.expiryTime = 'Expiry time is required';
    if (interviewFormData.startTime && interviewFormData.expiryTime && interviewFormData.startTime >= interviewFormData.expiryTime) {
      newErrors.expiryTime = 'Expiry time must be after start time';
    }
    if (interviewFormData.duration <= 0) newErrors.duration = 'Duration must be greater than 0';

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStartInterview = async (candidateData: InterviewDetails) => {
    if (!validateForm()) {
      return;
    }

    setIsSubmittingInterview(true);
    try {
      // Use the provided user ID
      const userId = "f8087c1d-72ba-414b-aea9-f7a0bce9a48a";
      
      const response = await fetch(`${PRODUCTION_API_URL}/interview/create-interview/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title: interviewFormData.title,
          role: interviewFormData.role,
          candidateName: candidateData.candidate_name,
          candidateEmail: interviewFormData.candidateEmail,
          resume: interviewFormData.resume,
          jobDescription: interviewFormData.jobDescription,
          yearsOfExperience: parseInt(interviewFormData.yearsOfExperience.toString()),
          startTime: interviewFormData.startTime?.toISOString(),
          expiryTime: interviewFormData.expiryTime?.toISOString(),
          duration: parseInt(interviewFormData.duration.toString()),
          totalQuestion: parseInt(interviewFormData.totalQuestion.toString())
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Interview created successfully:', result);
      
      toast.success('🚀 AI Interview scheduled successfully! The candidate will receive instructions via email.');
      
      setShowInterviewForm(null);
      setInterviewFormData({
        title: '',
        role: '',
        jobDescription: '',
        candidateName: '',
        candidateEmail: '',
        resume: '',
        resumeText: 'Resume text',
        yearsOfExperience: 0,
        totalQuestion: 5,
        startTime: null,
        expiryTime: null,
        duration: 60,
      });
      setFormErrors({});
      
      loadInterviews();
      
    } catch (error: unknown) {
      console.error('❌ Error creating interview:', error);
      
      let errorMessage = 'Failed to schedule interview. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Unauthorized. Please check your authentication.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Interview creation endpoint not found. Please contact support.';
        } else if (error.message.includes('422')) {
          errorMessage = 'Invalid data provided. Please check all required fields.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
      
      setFormErrors(prev => ({
        ...prev,
        submit: errorMessage
      }));
    } finally {
      setIsSubmittingInterview(false);
    }
  };

  const handleUseJD = () => {
    if (jobDescription) {
      setInterviewFormData(prev => ({
        ...prev,
        title: jobDescription.title,
        role: jobDescription.title,
        jobDescription: jobDescription.description,
      }));
      toast.success('Job description applied to form');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={40} />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Error Loading Dashboard</Typography>
          <Typography>{error}</Typography>
        </Alert>
        <Button onClick={loadInterviews} variant="contained" startIcon={<Refresh />}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      {/* Compact Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 0.5 }}>
            Interview Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage completed interviews and schedule new ones
          </Typography>
        </Box>
        <Button
          onClick={loadInterviews}
          variant="outlined"
          startIcon={<Refresh />}
          size="small"
          sx={{ height: 'fit-content' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Compact Stats Card */}
      <Box sx={{ mb: 3 }}>
        <Card 
          sx={{ 
            background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)'
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {stats.completedInterviews}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Completed Interviews
                  </Typography>
                </Box>
              </Box>
              <TrendingUp sx={{ fontSize: 40, opacity: 0.3 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Search and Table Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Completed Interviews ({filteredInterviews.length})
          </Typography>
          <TextField
            placeholder="Search interviews..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>Interview ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>Candidate</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5 }}> Next Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInterviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                        <Person sx={{ fontSize: 48, mb: 1 }} />
                        <Typography color="text.secondary">
                          {searchTerm ? 'No interviews match your search' : 'No completed interviews found'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInterviews.map((interview) => (
                    <TableRow key={interview.interview_id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', py: 1.5 }}>
                        {interview.interview_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'medium', py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ width: 32, height: 32, mr: 1, fontSize: '0.8rem' }}>
                            {interview.candidate_name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          {interview.candidate_name}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>{interview.candidate_phone}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip
                          label={interview.status?.replace('_', ' ')}
                          color={getStatusColor(interview.status)}
                          size="small"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Button
                          onClick={() => {
                            setShowInterviewForm(interview.interview_id);
                            setInterviewFormData(prev => ({
                              ...prev,
                              candidateName: interview.candidate_name,
                            }));
                          }}
                          variant="contained"
                          size="small"
                          startIcon={<PlayArrow />}
                          sx={{ 
                            fontSize: '0.75rem',
                            py: 0.5,
                            px: 1.5,
                            borderRadius: 2
                          }}
                        >
                          Start Interview
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>

      {/* Interview Form Dialog */}
      <Dialog 
        open={!!showInterviewForm} 
        onClose={() => setShowInterviewForm(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">🚀 Start AI Interview</Typography>
              <Typography variant="body2" color="text.secondary">
                Configure interview settings for {interviewFormData.candidateName}
              </Typography>
            </Box>
            <IconButton onClick={() => setShowInterviewForm(null)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Job Description Section */}
          {jobDescription && (
            <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8fafc' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Assignment sx={{ mr: 1 }} />
                  📋 Current Job Description
                </Typography>
                <Button onClick={handleUseJD} variant="outlined" size="small">
                  Apply Current JD
                </Button>
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {jobDescription.title}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <Business sx={{ mr: 1, fontSize: 16 }} />
                at {jobDescription.company}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Required Skills:</strong> {jobDescription.required_skills}
              </Typography>
              <Typography variant="body2">
                <strong>Experience:</strong> {jobDescription.experience_required}
              </Typography>
            </Card>
          )}

          {/* Form Fields */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Interview Title*"
                name="title"
                value={interviewFormData.title}
                onChange={handleInterviewFormChange}
                error={!!formErrors.title}
                helperText={formErrors.title}
                placeholder="e.g., Senior Developer Interview"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Job Role*"
                name="role"
                value={interviewFormData.role}
                onChange={handleInterviewFormChange}
                error={!!formErrors.role}
                helperText={formErrors.role}
                placeholder="e.g., Senior Full Stack Developer"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Job Description*"
                name="jobDescription"
                value={interviewFormData.jobDescription}
                onChange={handleInterviewFormChange}
                error={!!formErrors.jobDescription}
                helperText={formErrors.jobDescription}
                placeholder="Enter detailed job description..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Candidate Email*"
                name="candidateEmail"
                type="email"
                value={interviewFormData.candidateEmail}
                onChange={handleInterviewFormChange}
                error={!!formErrors.candidateEmail}
                helperText={formErrors.candidateEmail}
                placeholder="candidate@email.com"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Years of Experience"
                name="yearsOfExperience"
                type="number"
                value={interviewFormData.yearsOfExperience}
                onChange={handleInterviewFormChange}
                error={!!formErrors.yearsOfExperience}
                helperText={formErrors.yearsOfExperience}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ border: '2px dashed #e0e0e0', borderRadius: 1, p: 2, textAlign: 'center' }}>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileUpload(e, showInterviewForm!)}
                  disabled={uploading}
                  style={{ display: 'none' }}
                  id="resume-upload"
                />
                <label htmlFor="resume-upload">
                  <Button
                    component="span"
                    variant="outlined"
                    startIcon={uploading ? <CircularProgress size={20} /> : <Upload />}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : interviewFormData.resume ? '✅ Resume Uploaded' : 'Upload Resume*'}
                  </Button>
                </label>
                {formErrors.resume && (
                  <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>
                    {formErrors.resume}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  PDF, DOC, DOCX files accepted
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Duration (minutes)*"
                name="duration"
                type="number"
                value={interviewFormData.duration}
                onChange={handleInterviewFormChange}
                error={!!formErrors.duration}
                helperText={formErrors.duration}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Total Questions*"
                name="totalQuestion"
                type="number"
                value={interviewFormData.totalQuestion}
                onChange={handleInterviewFormChange}
                error={!!formErrors.totalQuestion}
                helperText={formErrors.totalQuestion}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Time*"
                name="startTime"
                type="datetime-local"
                value={interviewFormData.startTime ? interviewFormData.startTime.toISOString().slice(0, 16) : ''}
                onChange={(e) => setInterviewFormData(prev => ({ 
                  ...prev, 
                  startTime: e.target.value ? new Date(e.target.value) : null 
                }))}
                error={!!formErrors.startTime}
                helperText={formErrors.startTime}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Expiry Time*"
                name="expiryTime"
                type="datetime-local"
                value={interviewFormData.expiryTime ? interviewFormData.expiryTime.toISOString().slice(0, 16) : ''}
                onChange={(e) => setInterviewFormData(prev => ({ 
                  ...prev, 
                  expiryTime: e.target.value ? new Date(e.target.value) : null 
                }))}
                error={!!formErrors.expiryTime}
                helperText={formErrors.expiryTime}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {formErrors.submit && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formErrors.submit}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowInterviewForm(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => handleStartInterview(filteredInterviews.find(i => i.interview_id === showInterviewForm)!)}
            disabled={isSubmittingInterview || uploading}
            variant="contained"
            startIcon={isSubmittingInterview ? <CircularProgress size={20} /> : <PlayArrow />}
          >
            {isSubmittingInterview ? 'Starting Interview...' : '🚀 Start AI Interview'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;