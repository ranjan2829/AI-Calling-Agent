import React, { useState, useEffect, useRef } from 'react';
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
  Avatar,
  Tooltip,
  useTheme,
  useMediaQuery
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
  Person,
  Assessment,
  StarRate,
  ContentCopy,
  Timeline
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
  // Add new fields for interview results
  current_status?: string;
  score?: number;
  interview_result?: any;
  last_updated?: string;
}

interface InterviewResult {
  interview: {
    id: string;
    status: string;
    result?: {
      score?: number;
      feedback?: string;
      overall_rating?: string;
      strengths?: string[];
      weaknesses?: string[];
    };
    isCompleted: boolean;
    endedAt?: string;
    timeRemaining?: number;
    fullScreenExitCount?: number;
  };
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
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
  const [createdInterviewLink, setCreatedInterviewLink] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [interviewResults, setInterviewResults] = useState<{[key: string]: InterviewResult}>({});
  const [loadingResults, setLoadingResults] = useState<{[key: string]: boolean}>({});
  // Add mapping state to track old ID -> new ID
  const [interviewIdMapping, setInterviewIdMapping] = useState<{[oldId: string]: string}>({});

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
      
      // Extract the new interview ID from the response
      const newInterviewId = result.interviewId || result.id || result.interview_id;
      
      if (newInterviewId) {
        // Map old ID to new ID
        setInterviewIdMapping(prev => ({
          ...prev,
          [candidateData.interview_id]: newInterviewId
        }));
        
        // Immediately fetch results for the new interview
        fetchInterviewResults(newInterviewId);
        
        console.log(`🔗 Mapped old ID ${candidateData.interview_id} to new ID ${newInterviewId}`);
      }
      
      setCreatedInterviewLink(result.link);
      toast.success('🚀 AI Interview scheduled successfully!');
      
      // Don't close the dialog immediately - let user copy the link first
      // Reset form data
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

  const copyInterviewLink = async () => {
    if (createdInterviewLink) {
      try {
        await navigator.clipboard.writeText(createdInterviewLink);
        toast.success('📋 Interview link copied to clipboard!');
      } catch (err) {
        // Fallback: select and copy manually
        if (linkInputRef.current) {
          linkInputRef.current.select();
          document.execCommand('copy');
          toast.success('📋 Interview link copied (fallback)!');
        } else {
          toast.error('Failed to copy link. Please copy manually.');
        }
      }
    }
  };

  const copyInterviewLinkDirect = async (interviewId: string) => {
    try {
      // Create the interview link using the same format as the backend
      const interviewLink = `https://onelabceo.com/interview/${interviewId}`;
      
      await navigator.clipboard.writeText(interviewLink);
      toast.success('📋 Interview link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error('Failed to copy link. Please try again.');
    }
  };

  const handleCloseDialog = () => {
    setShowInterviewForm(null);
    setCreatedInterviewLink(null); // Reset the link when closing
  };

  // Add the missing getActualInterviewId function
  const getActualInterviewId = (originalId: string): string => {
    return interviewIdMapping[originalId] || originalId;
  };

  // Function to fetch interview results from the other server
  const fetchInterviewResults = async (interviewId: string) => {
    try {
      setLoadingResults(prev => ({ ...prev, [interviewId]: true }));
      
      const response = await fetch(`${PRODUCTION_API_URL}/interview/get-interview-results/${interviewId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const resultData: InterviewResult = await response.json();
        setInterviewResults(prev => ({ ...prev, [interviewId]: resultData }));
        return resultData;
      } else {
        console.log(`No results found for interview ${interviewId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching results for interview ${interviewId}:`, error);
      return null;
    } finally {
      setLoadingResults(prev => ({ ...prev, [interviewId]: false }));
    }
  };

  // Function to refresh interview results
  const refreshInterviewResults = async (interviewId: string) => {
    await fetchInterviewResults(interviewId);
  };

  // Load interview results on component mount
  useEffect(() => {
    if (interviews.length > 0) {
      interviews.forEach(interview => {
        const actualId = getActualInterviewId(interview.interview_id);
        fetchInterviewResults(actualId);
      });
    }
  }, [interviews, interviewIdMapping]);

  // Function to get score color based on score value
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Orange
    if (score >= 40) return '#ff5722'; // Deep Orange
    return '#f44336'; // Red
  };

  // Function to render interview score
  const renderInterviewScore = (interview: InterviewDetails) => {
    const actualInterviewId = getActualInterviewId(interview.interview_id);
    const resultData = interviewResults[actualInterviewId];
    const isLoading = loadingResults[actualInterviewId];

    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Loading...</Typography>
        </Box>
      );
    }

    if (!resultData || !resultData.interview) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {interviewIdMapping[interview.interview_id] ? 'No results' : 'Not scheduled'}
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => refreshInterviewResults(actualInterviewId)}
            title="Refresh results"
          >
            <Refresh sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      );
    }

    const { interview: interviewData } = resultData;
    const score = interviewData.result?.score || 0;
    const feedback = interviewData.result?.feedback || '';
    const overallRating = interviewData.result?.overall_rating || '';

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={`Score: ${score}%`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StarRate sx={{ fontSize: 16, color: getScoreColor(score) }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold',
                  color: getScoreColor(score)
                }}
              >
                {score}%
              </Typography>
            </Box>
          </Tooltip>
          <IconButton 
            size="small" 
            onClick={() => refreshInterviewResults(actualInterviewId)}
            title="Refresh results"
          >
            <Refresh sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        
        {overallRating && (
          <Typography variant="caption" color="text.secondary">
            Rating: {overallRating}
          </Typography>
        )}
        
        {feedback && (
          <Tooltip title={feedback}>
            <Typography variant="caption" color="text.secondary" sx={{ 
              maxWidth: 150,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {feedback.substring(0, 30)}...
            </Typography>
          </Tooltip>
        )}
        
        {interviewData.endedAt && (
          <Typography variant="caption" color="text.secondary">
            Completed: {new Date(interviewData.endedAt).toLocaleDateString()}
          </Typography>
        )}
      </Box>
    );
  };

  // Function to render current interview status
  const renderCurrentInterviewStatus = (interview: InterviewDetails) => {
    const actualInterviewId = getActualInterviewId(interview.interview_id);
    const resultData = interviewResults[actualInterviewId];
    const isLoading = loadingResults[actualInterviewId];

    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Loading...</Typography>
        </Box>
      );
    }

    if (!resultData || !resultData.interview) {
      return (
        <Chip
          label={interviewIdMapping[interview.interview_id] ? "No Status" : "Not Scheduled"}
          size="small"
          color="default"
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    const { interview: interviewData } = resultData;
    const status = interviewData.status;
    const isCompleted = interviewData.isCompleted;

    const getStatusChip = () => {
      if (isCompleted || status === 'COMPLETED') {
        return (
          <Chip
            label="Completed"
            size="small"
            color="success"
            sx={{ fontSize: '0.7rem' }}
          />
        );
      }

      switch (status?.toLowerCase()) {
        case 'not_started':
          return (
            <Chip
              label="Not Started"
              size="small"
              color="default"
              sx={{ fontSize: '0.7rem' }}
            />
          );
        case 'in_progress':
        case 'ongoing':
          return (
            <Chip
              label="In Progress"
              size="small"
              color="warning"
              sx={{ fontSize: '0.7rem' }}
            />
          );
        case 'scheduled':
        case 'pending':
          return (
            <Chip
              label="Scheduled"
              size="small"
              color="info"
              sx={{ fontSize: '0.7rem' }}
            />
          );
        case 'terminated':
        case 'cancelled':
          return (
            <Chip
              label="Terminated"
              size="small"
              color="error"
              sx={{ fontSize: '0.7rem' }}
            />
          );
        default:
          return (
            <Chip
              label={status || 'Unknown'}
              size="small"
              color="default"
              sx={{ fontSize: '0.7rem' }}
            />
          );
      }
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {getStatusChip()}
        {interviewData.timeRemaining && (
          <Typography variant="caption" color="text.secondary">
            Time Left: {Math.floor(interviewData.timeRemaining / 60)}min
          </Typography>
        )}
        {interviewData.fullScreenExitCount > 0 && (
          <Typography variant="caption" color="error">
            Exits: {interviewData.fullScreenExitCount}
          </Typography>
        )}
      </Box>
    );
  };

  // Add a function to save mapping to localStorage for persistence
  useEffect(() => {
    const savedMapping = localStorage.getItem('interviewIdMapping');
    if (savedMapping) {
      try {
        setInterviewIdMapping(JSON.parse(savedMapping));
      } catch (error) {
        console.error('Error parsing saved mapping:', error);
        localStorage.removeItem('interviewIdMapping');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('interviewIdMapping', JSON.stringify(interviewIdMapping));
  }, [interviewIdMapping]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, maxWidth: '800px', mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 3 }}>
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
    <Box sx={{ p: 3, maxWidth: '1400px', mx: 'auto', minHeight: '100vh', backgroundColor: '#f9f9f9' }}>
      {/* Simple Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1 }}>
            AI Interview Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage completed interviews and schedule new ones
          </Typography>
        </Box>
        <Button
          onClick={loadInterviews}
          variant="contained"
          startIcon={<Refresh />}
          sx={{ borderRadius: 2 }}
        >
          Refresh Data
        </Button>
      </Box>
      <Card sx={{ mb: 3, boxShadow: 2 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#4caf50', width: 56, height: 56 }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {stats.completedInterviews}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    Completed Interviews
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.totalInterviews}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.inProgressInterviews}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    In Progress
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {stats.terminatedInterviews}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Terminated
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Search and Table Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Interview Results ({filteredInterviews.length})
          </Typography>
          <TextField
            placeholder="Search interviews..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ width: { xs: '100%', md: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Card sx={{ boxShadow: 2 }}>
          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Interview ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Candidate
                  </TableCell>
                  {!isMobile && (
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                      Phone
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Current Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Score & Results
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInterviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 6 : 7} sx={{ textAlign: 'center', py: 4 }}>
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
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        <Box sx={{ 
                          maxWidth: isMobile ? 80 : 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {interview.interview_id}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                            {interview.candidate_name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {interview.candidate_name}
                            </Typography>
                            {isMobile && (
                              <Typography variant="caption" color="text.secondary">
                                {interview.candidate_phone}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <Typography variant="body2">
                            {interview.candidate_phone}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={interview.status?.replace('_', ' ')}
                          color={getStatusColor(interview.status)}
                          size="small"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ minWidth: 100 }}>
                          {renderCurrentInterviewStatus(interview)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ minWidth: 120 }}>
                          {renderInterviewScore(interview)}
                        </Box>
                      </TableCell>
                      <TableCell>
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
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {isMobile ? 'Schedule' : 'Schedule Interview'}
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

      {/* Simple Interview Form Dialog */}
      <Dialog 
        open={!!showInterviewForm} 
        onClose={() => setShowInterviewForm(null)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Start AI Interview
            </Typography>
            <IconButton onClick={() => setShowInterviewForm(null)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Job Description Section */}
          {jobDescription && (
            <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Assignment sx={{ mr: 1 }} />
                  Current Job Description
                </Typography>
                <Button onClick={handleUseJD} variant="contained" size="small">
                  Apply Current JD
                </Button>
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {jobDescription.title}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <Business sx={{ mr: 1, fontSize: 16, verticalAlign: 'middle' }} />
                {jobDescription.company}
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
                label="Interview Title"
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
                label="Job Role"
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
                rows={3}
                label="Job Description"
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
                label="Candidate Email"
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
              <Box sx={{ 
                border: '2px dashed #ccc', 
                borderRadius: 1, 
                p: 2, 
                textAlign: 'center',
                backgroundColor: '#fafafa'
              }}>
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
                    variant="contained"
                    startIcon={uploading ? <CircularProgress size={20} /> : <Upload />}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 
                     interviewFormData.resume ? 'Resume Uploaded' : 
                     'Upload Resume'}
                  </Button>
                </label>
                {formErrors.resume && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
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
                label="Duration (minutes)"
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
                label="Total Questions"
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
                label="Start Time"
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
                label="Expiry Time"
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

          {/* Success message with copy link */}
          {createdInterviewLink && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#e8f5e8', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ color: '#2e7d32', mb: 2 }}>
                <CheckCircle sx={{ mr: 1, verticalAlign: 'middle' }} />
                Interview Created Successfully!
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Share this link with the candidate to start their interview:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  value={createdInterviewLink}
                  inputRef={linkInputRef}
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                />
                <Button
                  onClick={copyInterviewLink}
                  variant="contained"
                  startIcon={<ContentCopy />}
                  sx={{ minWidth: 120 }}
                >
                  Copy Link
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The candidate will also receive this link via email.
              </Typography>
            </Box>
          )}

          {/* Error message */}
          {formErrors.submit && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formErrors.submit}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog}>
            {createdInterviewLink ? 'Close' : 'Cancel'}
          </Button>
          {!createdInterviewLink && (
            <Button
              onClick={() => handleStartInterview(filteredInterviews.find(i => i.interview_id === showInterviewForm)!)}
              disabled={isSubmittingInterview || uploading}
              variant="contained"
              startIcon={isSubmittingInterview ? <CircularProgress size={20} /> : <PlayArrow />}
            >
              {isSubmittingInterview ? 'Starting...' : 'Start Interview'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;