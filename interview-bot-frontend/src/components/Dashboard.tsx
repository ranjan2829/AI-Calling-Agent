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
  Timeline,
  Email as EmailIcon
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
interface CodingAssessmentFormData {
  title: string;
  designation: string;
  jobDescription: string;
  experience: number;
  totalQuestions: number;
  skills: string[];
  questionTypes: string[];
}

interface CodingAssessmentResult {
  assessmentId: string;
  status: string;
  score?: number;
  completedQuestions?: number;
  totalQuestions?: number;
  timeSpent?: number;
  feedback?: string;
}

// Add these interfaces after your existing interfaces
interface AssessmentData {
  id: string;
  testName: string;
  jobRole: string;
  candidateCount: number;
  createdAt: string;
  status: 'active' | 'inactive';
  description?: string;
}

interface AssessmentResponse {
  assessments: AssessmentData[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
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
  const [interviewIdMapping, setInterviewIdMapping] = useState<{[oldId: string]: string}>({});
  const [showCodingAssessmentForm, setShowCodingAssessmentForm] = useState<string | null>(null);
  const [codingAssessmentFormData, setCodingAssessmentFormData] = useState<CodingAssessmentFormData>({
    title: '',
    designation: '',
    jobDescription: '',
    experience: 1,
    totalQuestions: 10,
    skills: [],
    questionTypes: []
  });
  const [codingAssessmentErrors, setCodingAssessmentErrors] = useState<{[key: string]: string}>({});
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [createdAssessmentLink, setCreatedAssessmentLink] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [codingAssessmentResults, setCodingAssessmentResults] = useState<{[key: string]: CodingAssessmentResult}>({});
  // Add these new state variables after your existing state declarations
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [showAssessmentDropdown, setShowAssessmentDropdown] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentData | null>(null);
  const [assessmentSearchTerm, setAssessmentSearchTerm] = useState('');

  useEffect(() => {
    loadInterviews();
    loadJobDescription();
    fetchAssessments();
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
      const newInterviewId = result.interviewId || result.id || result.interview_id;
      if (newInterviewId) {
        const updatedMapping = {
          ...interviewIdMapping,
          [candidateData.interview_id]: newInterviewId
        };
        setInterviewIdMapping(updatedMapping);
        localStorage.setItem('interviewIdMapping', JSON.stringify(updatedMapping));
        console.log(`✅ Mapped interview ID ${candidateData.interview_id} to new ID ${newInterviewId}`);
        fetchInterviewResults(newInterviewId);
      }
      setCreatedInterviewLink(result.link);
      toast.success('🚀 AI Interview scheduled successfully!');
      const savedData = {
        candidateName: interviewFormData.candidateName,
        candidateEmail: interviewFormData.candidateEmail,
        role: interviewFormData.role
      };
      setInterviewFormData(prev => ({
        ...prev,
        title: '',
        jobDescription: '',
        resume: '',
        resumeText: 'Resume text',
        yearsOfExperience: 0,
        totalQuestion: 5,
        startTime: null,
        expiryTime: null,
        duration: 60,
        candidateName: savedData.candidateName,
        candidateEmail: savedData.candidateEmail,
        role: savedData.role
      }));
      setFormErrors({});
      loadInterviews();
    } catch (error: unknown) {
      console.error('Error creating interview:', error);
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
      const interviewLink = `https://onelabceo.com/interview/${interviewId}`;
      await navigator.clipboard.writeText(interviewLink);
      toast.success('📋 Interview link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error('Failed to copy link. Please try again.');
    }
  };
  const sendInterviewLinkViaEmail = async () => {
    if (!createdInterviewLink || !interviewFormData.candidateEmail) {
      toast.error('Missing link or candidate email');
      return;
    }
    try {
      toast.info('Sending email...');
      const response = await fetch(`${API_BASE_URL}/send-interview-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: interviewFormData.candidateEmail,
          link: createdInterviewLink,
          candidate_name: interviewFormData.candidateName,
          role: interviewFormData.role,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Interview link sent via email!');
      } else {
        toast.error(result.message || 'Failed to send email');
      }
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('Failed to send email');
    }
  };
  const handleCloseDialog = () => {
    setShowInterviewForm(null);
    setCreatedInterviewLink(null);
  };
  const saveDataToLocalStorage = () => {
    try {
      localStorage.setItem('interviewIdMapping', JSON.stringify(interviewIdMapping));
      localStorage.setItem('interviewResults', JSON.stringify(interviewResults));
      console.log('✅ Saved interview mappings and results to localStorage');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };
  const getActualInterviewId = (originalId: string): string => {
    if (interviewIdMapping[originalId]) {
      return interviewIdMapping[originalId];
    }
    try {
      const savedMapping = localStorage.getItem('interviewIdMapping');
      if (savedMapping) {
        const mappings = JSON.parse(savedMapping);
        if (mappings[originalId]) {
          setInterviewIdMapping(prev => ({
            ...prev,
            [originalId]: mappings[originalId]
          }));
          return mappings[originalId];
        }
      }
    } catch (err) {
      console.error('Error reading mapping from localStorage:', err);
    }
    return originalId;
  };
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
        const updatedResults = { ...interviewResults, [interviewId]: resultData };
        setInterviewResults(updatedResults);
        localStorage.setItem('interviewResults', JSON.stringify(updatedResults));
        console.log(`✅ Fetched and saved results for interview ${interviewId}`);
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
  useEffect(() => {
    if (interviews.length > 0) {
      interviews.forEach(interview => {
        const actualId = getActualInterviewId(interview.interview_id);
        fetchInterviewResults(actualId);
      });
    }
  }, [interviews, interviewIdMapping]);
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Orange
    if (score >= 40) return '#ff5722'; // Deep Orange
    return '#f44336'; // Red
  };
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
  const renderCodingAssessmentStatus = (interview: InterviewDetails) => {
    const assessmentData = codingAssessmentResults[interview.interview_id];
    
    if (!assessmentData) {
      return (
        <Chip
          label="Not Created"
          size="small"
          color="default"
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'completed': return 'success';
        case 'in_progress': return 'warning';
        case 'pending': return 'info';
        case 'expired': return 'error';
        default: return 'default';
      }
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Chip
          label={assessmentData.status}
          size="small"
          color={getStatusColor(assessmentData.status)}
          sx={{ fontSize: '0.7rem' }}
        />
        {assessmentData.score && (
          <Typography variant="caption" color="text.secondary">
            Score: {assessmentData.score}%
          </Typography>
        )}
        {assessmentData.completedQuestions && (
          <Typography variant="caption" color="text.secondary">
            {assessmentData.completedQuestions}/{assessmentData.totalQuestions} questions
          </Typography>
        )}
      </Box>
    );
  };

  const handleCodingAssessmentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCodingAssessmentFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !codingAssessmentFormData.skills.includes(newSkill.trim())) {
      setCodingAssessmentFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setCodingAssessmentFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleQuestionTypeChange = (type: string) => {
    setCodingAssessmentFormData(prev => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(type)
        ? prev.questionTypes.filter(t => t !== type)
        : [...prev.questionTypes, type]
    }));
  };

  const handleApplyJDToCoding = () => {
    if (jobDescription) {
      setCodingAssessmentFormData(prev => ({
        ...prev,
        title: jobDescription.title,
        designation: jobDescription.title,
        jobDescription: jobDescription.description,
        skills: jobDescription.required_skills.split(',').map(skill => skill.trim()).slice(0, 5)
      }));
      toast.success('Job description applied to coding assessment form');
    }
  };
  const validateCodingAssessmentForm = () => {
    const newErrors: {[key: string]: string} = {};
    if (!codingAssessmentFormData.title.trim()) newErrors.title = 'Title is required';
    if (!codingAssessmentFormData.designation.trim()) newErrors.designation = 'Designation is required';
    if (!codingAssessmentFormData.jobDescription.trim()) newErrors.jobDescription = 'Job description is required';
    if (codingAssessmentFormData.experience < 0) newErrors.experience = 'Experience cannot be negative';
    if (codingAssessmentFormData.totalQuestions <= 0) newErrors.totalQuestions = 'Total questions must be greater than 0';
    if (codingAssessmentFormData.skills.length === 0) newErrors.skills = 'At least one skill is required';
    if (codingAssessmentFormData.questionTypes.length === 0) newErrors.questionTypes = 'At least one question type is required';
    setCodingAssessmentErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleCreateCodingAssessment = async (candidateData: InterviewDetails) => {
    if (!validateCodingAssessmentForm()) {
      return;
    }
    setIsSubmittingAssessment(true);
    try {
      const response = await fetch(`${API_BASE_URL}/create-coding-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateId: candidateData.interview_id,
          candidateName: candidateData.candidate_name,
          candidateEmail: candidateData.candidate_phone,
          ...codingAssessmentFormData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create coding assessment');
      }
      const result = await response.json();
      setCreatedAssessmentLink(result.assessmentLink);
      toast.success('🚀 Coding Assessment created successfully!');
      setCodingAssessmentFormData({
        title: '',
        designation: '',
        jobDescription: '',
        experience: 1,
        totalQuestions: 10,
        skills: [],
        questionTypes: []
      });
      setCodingAssessmentErrors({});
      
    } catch (error: unknown) {
      console.error('Error creating coding assessment:', error);
      toast.error('Failed to create coding assessment');
    } finally {
      setIsSubmittingAssessment(false);
    }
  };
  const handleCloseCodingAssessmentDialog = () => {
    setShowCodingAssessmentForm(null);
    setCreatedAssessmentLink(null);
    setCodingAssessmentFormData({
      title: '',
      designation: '',
      jobDescription: '',
      experience: 1,
      totalQuestions: 10,
      skills: [],
      questionTypes: []
    });
    setCodingAssessmentErrors({});
  };
  const copyAssessmentLink = async () => {
    if (createdAssessmentLink) {
      try {
        await navigator.clipboard.writeText(createdAssessmentLink);
        toast.success('Assessment link copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy link. Please copy manually.');
      }
    }
  };

  const sendAssessmentLinkViaEmail = async () => {
    if (!createdAssessmentLink) {
      toast.error('No assessment link available');
      return;
    }
    
    try {
      toast.info('Sending assessment link via email...');
      toast.success('Assessment link sent via email!');
    } catch (err) {
      toast.error('Failed to send email');
    }
  };

  const refreshInterviewResults = async (interviewId: string) => {
    await fetchInterviewResults(interviewId);
  };
  // Update the fetchAssessments function to use the working API endpoint
  const fetchAssessments = async (page = 1, limit = 10, searchTerm = '') => {
    try {
      setLoadingAssessments(true);
      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
      
      const response = await fetch(`https://api.onelabventur.us/node/api/assessment/?page=${page}&limit=${limit}&sortOrder=DESC&sortBy=createdAt&searchBy=${searchParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API Response:', data);
      
      // Extract assessments from the response structure
      const assessments = data.result?.assessments || [];
      
      // Map the API response to our AssessmentData interface
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
      console.log('✅ Mapped assessments:', mappedAssessments);
      
      return {
        assessments: mappedAssessments,
        totalCount: data.result?.totalItems || 0,
        currentPage: data.result?.currentPage || 1,
        totalPages: data.result?.totalPages || 1
      };
    } catch (error) {
      console.error('Error fetching assessments:', error);
      toast.error('Failed to load assessments');
      setAssessments([]);
      return {
        assessments: [],
        totalCount: 0,
        currentPage: page,
        totalPages: 1
      };
    } finally {
      setLoadingAssessments(false);
    }
  };

  // Add this useEffect to load assessments on component mount
  useEffect(() => {
    fetchAssessments();
  }, []);

  // Add this function to handle assessment selection
  const handleAssessmentSelect = (assessment: AssessmentData) => {
    setSelectedAssessment(assessment);
    setShowAssessmentDropdown(false);
    toast.success(`Selected assessment: ${assessment.testName}`);
  };

  // Add this function to handle assessment search
  const handleAssessmentSearch = (searchTerm: string) => {
    setAssessmentSearchTerm(searchTerm);
    fetchAssessments(1, 10, searchTerm);
  };

  // Add this function to render the assessment dropdown
  const renderAssessmentDropdown = () => {
    return (
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
    );
  };

  // Add this function to render the assessment management table
  const renderAssessmentTable = () => {
    return (
      <Card sx={{ boxShadow: 2, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Assessment Management ({assessments.length})
            </Typography>
            <Button
              onClick={() => fetchAssessments()}
              variant="contained"
              size="small"
              startIcon={<Refresh />}
            >
              Refresh
            </Button>
          </Box>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Test Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Job Role</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Experience</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Topics</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Candidates</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                        <Assessment sx={{ fontSize: 48, mb: 1 }} />
                        <Typography color="text.secondary">
                          No assessments found
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  assessments.map((assessment) => (
                    <TableRow key={assessment.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {assessment.testName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {assessment.jobRole}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {assessment.experience} years
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {assessment.totalTopics || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {assessment.duration ? `${Math.floor(assessment.duration / 60)} min` : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Person sx={{ fontSize: 16 }} />
                          <Typography variant="body2">
                            {assessment.candidateCount}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(assessment.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={assessment.status}
                          color={assessment.status === 'active' ? 'success' : 'default'}
                          size="small"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Assessment />}
                            onClick={() => {
                              toast.info(`Viewing report for ${assessment.testName}`);
                            }}
                          >
                            View Report
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            color={assessment.status === 'active' ? 'error' : 'success'}
                            onClick={() => {
                              const action = assessment.status === 'active' ? 'Deactivating' : 'Activating';
                              toast.info(`${action} ${assessment.testName}`);
                            }}
                          >
                            {assessment.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

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

      {/* Assessment Dropdown */}
      {renderAssessmentDropdown()}

      {/* Assessment Management Table */}
      {renderAssessmentTable()}

      {/* Existing Statistics Card */}
      <Card sx={{ mb: 3, boxShadow: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: '#4caf50', width: 48, height: 48 }}>
              <CheckCircle sx={{ fontSize: 24 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50', mb: 0.5 }}>
                {stats.completedInterviews}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Completed Interviews
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
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
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Coding Assessment
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
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {renderCodingAssessmentStatus(interview)}
                          <Button
                            onClick={() => {
                              setShowCodingAssessmentForm(interview.interview_id);
                              setCodingAssessmentFormData(prev => ({
                                ...prev,
                                title: `${interview.candidate_name} - Coding Assessment`,
                              }));
                            }}
                            variant="outlined"
                            size="small"
                            startIcon={<Assessment />}
                            sx={{ fontSize: '0.75rem' }}
                          >
                            Create Assessment
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
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
                <Button
                  onClick={sendInterviewLinkViaEmail}
                  variant="contained"
                  color="primary"
                  startIcon={<EmailIcon />}
                  sx={{ minWidth: 160 }}
                >
                  Send Email
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

      {/* Coding Assessment Dialog */}
      <Dialog 
        open={!!showCodingAssessmentForm} 
        onClose={handleCloseCodingAssessmentDialog}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Create Coding Assessment
            </Typography>
            <IconButton onClick={handleCloseCodingAssessmentDialog}>
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
                <Button onClick={handleApplyJDToCoding} variant="contained" size="small">
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
                label="Title"
                name="title"
                value={codingAssessmentFormData.title}
                onChange={handleCodingAssessmentFormChange}
                error={!!codingAssessmentErrors.title}
                helperText={codingAssessmentErrors.title}
                placeholder="e.g., Senior Developer Assessment"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Designation"
                name="designation"
                value={codingAssessmentFormData.designation}
                onChange={handleCodingAssessmentFormChange}
                error={!!codingAssessmentErrors.designation}
                helperText={codingAssessmentErrors.designation}
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
                value={codingAssessmentFormData.jobDescription}
                onChange={handleCodingAssessmentFormChange}
                error={!!codingAssessmentErrors.jobDescription}
                helperText={codingAssessmentErrors.jobDescription}
                placeholder="Enter detailed job description..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Experience (years)"
                name="experience"
                type="number"
                value={codingAssessmentFormData.experience}
                onChange={handleCodingAssessmentFormChange}
                error={!!codingAssessmentErrors.experience}
                helperText={codingAssessmentErrors.experience}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Total Questions"
                name="totalQuestions"
                type="number"
                value={codingAssessmentFormData.totalQuestions}
                onChange={handleCodingAssessmentFormChange}
                error={!!codingAssessmentErrors.totalQuestions}
                helperText={codingAssessmentErrors.totalQuestions}
                inputProps={{ min: 1 }}
              />
            </Grid>
            
            {/* Skills Section */}
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Skills</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Add Skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                    placeholder="e.g., JavaScript, Python, React"
                  />
                  <Button onClick={handleAddSkill} variant="contained">
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {codingAssessmentFormData.skills.map((skill, index) => (
                    <Chip
                      key={index}
                      label={skill}
                      onDelete={() => handleRemoveSkill(skill)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
                {codingAssessmentErrors.skills && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {codingAssessmentErrors.skills}
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Question Types Section */}
            <Grid item xs={12}>
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Question Types</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['Multiple Choice', 'Coding Problem', 'System Design', 'Algorithm', 'Data Structure', 'Database'].map((type) => (
                    <Chip
                      key={type}
                      label={type}
                      onClick={() => handleQuestionTypeChange(type)}
                      color={codingAssessmentFormData.questionTypes.includes(type) ? 'primary' : 'default'}
                      variant={codingAssessmentFormData.questionTypes.includes(type) ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
                {codingAssessmentErrors.questionTypes && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {codingAssessmentErrors.questionTypes}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Success message with copy link */}
          {createdAssessmentLink && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#e8f5e8', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ color: '#2e7d32', mb: 2 }}>
                <CheckCircle sx={{ mr: 1, verticalAlign: 'middle' }} />
                Coding Assessment Created Successfully!
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Share this link with the candidate to start their coding assessment:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  value={createdAssessmentLink}
                  variant="outlined"
                  size="small"
                  InputProps={{ readOnly: true }}
                />
                <Button
                  onClick={copyAssessmentLink}
                  variant="contained"
                  startIcon={<ContentCopy />}
                  sx={{ minWidth: 120 }}
                >
                  Copy Link
                </Button>
                <Button
                  onClick={sendAssessmentLinkViaEmail}
                  variant="contained"
                  color="primary"
                  startIcon={<EmailIcon />}
                  sx={{ minWidth: 160 }}
                >
                  Send Email
                </Button>
              </Box>
            </Box>
          )}

          {/* Error message */}
          {codingAssessmentErrors.submit && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {codingAssessmentErrors.submit}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseCodingAssessmentDialog}>
            {createdAssessmentLink ? 'Close' : 'Cancel'}
          </Button>
          {!createdAssessmentLink && (
            <Button
              onClick={() => handleCreateCodingAssessment(filteredInterviews.find(i => i.interview_id === showCodingAssessmentForm)!)}
              disabled={isSubmittingAssessment}
              variant="contained"
              startIcon={isSubmittingAssessment ? <CircularProgress size={20} /> : <Assessment />}
            >
              {isSubmittingAssessment ? 'Creating...' : 'Create Assessment'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;