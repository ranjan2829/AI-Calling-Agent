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
  InputAdornment,
  Avatar,
  Tooltip,
  useTheme,
  useMediaQuery,
  Divider,
  FormControl,
  Select,
  MenuItem
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
  StarRate,
  ContentCopy,
  Timeline,
  Email as EmailIcon,
  Link as LinkIcon,
  Add
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AssessmentDropdown from './AssessmentDropdown';

interface CandidateTag {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
}

interface InterviewDetails {
  interview_id: string;
  candidate_name: string;
  candidate_phone: string;
  candidate_email?: string;
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
  assessment_completed?: boolean;
  assessment_score?: number;
  assessment_test_taken?: 'taken' | 'not_given' | 'pending';
  email_sent?: boolean;
  email_sent_at?: string;
  tag?: string; // ✅ Add tag field
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

interface AssessmentData {
  id: string;
  testName: string;
  jobRole: string;
  candidateCount: number;
  createdAt: string;
  status: string;
  description: string;
  experience: number;
  duration: number;
  totalTopics: number;
  allowVideoRecording: boolean;
  createdBy: string;
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

const API_BASE_URL = 'http://13.204.76.229:8000';
const PRODUCTION_API_URL = 'https://onelabceo.com/api';
const ASSESSMENT_API_URL = 'https://api.onelabventur.us/node/api';

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

  // Assessment related state
  const [showCodingAssessmentForm, setShowCodingAssessmentForm] = useState<string | null>(null);
  const [createdAssessmentLink, setCreatedAssessmentLink] = useState<string | null>(null);
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
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [showAssessmentDropdown, setShowAssessmentDropdown] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentData | null>(null);
  const [assessmentSearchTerm, setAssessmentSearchTerm] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [candidateEmailInput, setCandidateEmailInput] = useState('');
  const [selectedAssessmentForEmail, setSelectedAssessmentForEmail] = useState<AssessmentData | null>(null);
  const [assessmentStatuses, setAssessmentStatuses] = useState<{
    [key: string]: {
      testTaken: 'taken' | 'not_given' | 'pending';
      score?: number;
      emailSent: boolean;
      emailSentAt?: string;
      candidateEmail?: string;
      completed?: boolean;
    };
  }>({});
  const [sendingEmails, setSendingEmails] = useState<{[key: string]: boolean}>({});
  const [sendingBulkEmails, setSendingBulkEmails] = useState(false);
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([]);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#1976d2', description: '' });
  const [selectedTag, setSelectedTag] = useState<CandidateTag | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');
  useEffect(() => {
    loadInterviews();
    loadJobDescription();
    fetchAssessments().catch(err => {
      console.log('Assessment loading failed, continuing without assessments:', err);
    });
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
  // Filter interviews by tag
    const filteredInterviewsByTag = filteredInterviews.filter(interview => {
    if (tagFilter === 'all') return true;
    if (tagFilter === 'untagged') return !interview.tag;
    return interview.tag === tagFilter;
  });
  const getStatusColor = (status: string): "success" | "warning" | "error" | "info" | "default" => {
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
      toast.success('AI Interview scheduled successfully!');
      
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
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    if (score >= 40) return '#ff5722';
    return '#f44336';
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
        {interviewData.fullScreenExitCount && interviewData.fullScreenExitCount > 0 && (
          <Typography variant="caption" color="error">
            Exits: {interviewData.fullScreenExitCount}
          </Typography>
        )}
      </Box>
    );
  };

  const renderAssessmentScore = (interview: InterviewDetails) => {
    const status = assessmentStatuses[interview.interview_id];
    
    if (!status) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            No assessment
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {status.completed && status.score ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StarRate sx={{ fontSize: 16, color: getScoreColor(status.score) }} />
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 'bold',
                color: getScoreColor(status.score)
              }}
            >
              {status.score}%
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {status.testTaken === 'taken' ? 'Completed' : 'Not taken'}
          </Typography>
        )}
      </Box>
    );
  };

  const renderEmailSent = (interview: InterviewDetails) => {
    const status = assessmentStatuses[interview.interview_id];
    const isSending = sendingEmails[interview.interview_id];
    
    if (isSending) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Sending...</Typography>
        </Box>
      );
    }
    
    if (!status || !status.emailSent) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Not sent
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => sendAssessmentEmail(interview.interview_id)}
            startIcon={<EmailIcon />}
            disabled={!selectedAssessment}
          >
            Send
          </Button>
        </Box>
      );
    }
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Chip
          label="Sent"
          size="small"
          color="success"
          sx={{ fontSize: '0.7rem' }}
        />
        {status.emailSentAt && (
          <Typography variant="caption" color="text.secondary">
            {new Date(status.emailSentAt).toLocaleDateString()}
          </Typography>
        )}
      </Box>
    );
  };

  const extractCandidateEmail = (interview: InterviewDetails): string => {
    return interview.candidate_email || assessmentStatuses[interview.interview_id]?.candidateEmail || 'No email';
  };

  const sendAssessmentEmail = async (interviewId: string) => {
    if (!selectedAssessment) {
      toast.error('Please select an assessment first');
      return;
    }
    
    const interview = interviews.find(i => i.interview_id === interviewId);
    if (!interview) {
      toast.error('Interview not found');
      return;
    }

    const candidateEmail = extractCandidateEmail(interview);
    if (!candidateEmail || candidateEmail === 'No email') {
      toast.error('Candidate email not found');
      return;
    }
    
    setSendingEmails(prev => ({ ...prev, [interviewId]: true }));
    
    try {
      const assessmentLink = await generateAssessmentLink(selectedAssessment.id);
      const response = await fetch(`${API_BASE_URL}/send-assessment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: candidateEmail,
          assessmentLink: assessmentLink,
          assessmentTitle: selectedAssessment.testName,
          jobRole: selectedAssessment.jobRole,
          candidateName: interview.candidate_name,
          experience: selectedAssessment.experience,
          duration: selectedAssessment.duration ? Math.floor(selectedAssessment.duration / 60) : 60,
          totalQuestions: selectedAssessment.totalTopics || 10,
          // ✅ Include tag information in email payload
          candidateTag: interview.tag,
          tagDetails: getTagByName(interview.tag || '')
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success('Assessment link sent successfully!');
        setAssessmentStatuses(prev => ({
          ...prev,
          [interviewId]: {
            ...prev[interviewId],
            emailSent: true,
            emailSentAt: new Date().toISOString(),
            candidateEmail: candidateEmail,
            testTaken: 'pending'
          }
        }));
      } else {
        toast.error(result.message || 'Failed to send assessment link');
      }
    } catch (error) {
      console.error('Error sending assessment link:', error);
      toast.error('Failed to send assessment link');
    } finally {
      setSendingEmails(prev => ({ ...prev, [interviewId]: false }));
    }
  };

  const sendBulkAssessmentEmails = async () => {
    if (!selectedAssessment) {
      toast.error('Please select an assessment first');
      return;
    }

    if (filteredInterviews.length === 0) {
      toast.error('No interviews found to send emails');
      return;
    }

    setSendingBulkEmails(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const interview of filteredInterviews) {
        const candidateEmail = extractCandidateEmail(interview);
        if (!candidateEmail || candidateEmail === 'No email') {
          failCount++;
          continue;
        }

        try {
          const assessmentLink = await generateAssessmentLink(selectedAssessment.id);
          const response = await fetch(`${API_BASE_URL}/send-assessment-link`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: candidateEmail,
              assessmentLink: assessmentLink,
              assessmentTitle: selectedAssessment.testName,
              jobRole: selectedAssessment.jobRole,
              candidateName: interview.candidate_name,
              experience: selectedAssessment.experience,
              duration: selectedAssessment.duration ? Math.floor(selectedAssessment.duration / 60) : 60,
              totalQuestions: selectedAssessment.totalTopics || 10
            }),
          });

          const result = await response.json();
          
          if (response.ok && result.success) {
            successCount++;
            setAssessmentStatuses(prev => ({
              ...prev,
              [interview.interview_id]: {
                ...prev[interview.interview_id],
                emailSent: true,
                emailSentAt: new Date().toISOString(),
                candidateEmail: candidateEmail,
                testTaken: 'pending'
              }
            }));
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }

        // Add delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} assessment links`);
      }
      if (failCount > 0) {
        toast.error(`Failed to send ${failCount} assessment links`);
      }
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast.error('Failed to send bulk emails');
    } finally {
      setSendingBulkEmails(false);
    }
  };

  const updateAssessmentStatuses = async () => {
    if (!selectedAssessment) {
      toast.error('Please select an assessment first');
      return;
    }
    
    try {
      const candidatesData = await getCandidatesForAssessment(selectedAssessment.id);
      
      if (candidatesData && candidatesData.result) {
        const newStatuses: typeof assessmentStatuses = {};
        
        candidatesData.result.forEach((candidate: any) => {
          const matchingInterview = interviews.find(
            interview => extractCandidateEmail(interview) === candidate.email
          );
          
          if (matchingInterview) {
            newStatuses[matchingInterview.interview_id] = {
              completed: candidate.status === 'completed',
              score: candidate.score || 0,
              emailSent: true,
              emailSentAt: candidate.createdAt,
              candidateEmail: candidate.email,
              testTaken: candidate.status === 'completed' ? 'taken' : 'pending'
            };
          }
        });
        
        setAssessmentStatuses(prev => ({ ...prev, ...newStatuses }));
        toast.success('Assessment statuses updated');
      }
    } catch (error) {
      console.error('Error updating assessment statuses:', error);
      toast.error('Failed to update assessment statuses');
    }
  };

  const handleAssignTagToInterview = async (interviewId: string, tagId: string) => {
    try {
      // Update local state
      setInterviews(prev => prev.map(interview => 
        interview.interview_id === interviewId 
          ? { ...interview, tag: tagId }
          : interview
      ));

      // Optionally persist to backend
      const response = await fetch(`${API_BASE_URL}/update-interview-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: interviewId,
          tag: tagId
        }),
      });

      if (response.ok) {
        const tagName = candidateTags.find(tag => tag.id === tagId)?.name || tagId;
        toast.success(`Tag "${tagName}" assigned successfully`);
      } else {
        toast.warning('Tag assigned locally but failed to sync with server');
      }
    } catch (error) {
      console.error('Error assigning tag:', error);
      toast.error('Failed to assign tag');
    }
  };

  const handleInterviewTagChange = (interviewId: string, tagId: string) => {
    setInterviews(prev => 
      prev.map(interview => 
        interview.interview_id === interviewId 
          ? { ...interview, tag: tagId }
          : interview
      )
    );
  };

  const filteredInterviewsByTagAndSearch = filteredInterviews.filter(interview => {
    const matchesSearch = interview.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interview.interview_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interview.candidate_phone?.includes(searchTerm);
    const hasValidStartTime = interview.start_time && interview.start_time !== 'N/A';
    const hasProgress = interview.questions_answered > 0;
    const matchesTag = tagFilter === 'all' || interview.tag === tagFilter;
    return matchesSearch && interview.status === 'COMPLETED' && hasValidStartTime && hasProgress && matchesTag;
  });

  // ✅ Add missing functions
  const refreshInterviewResults = async (interviewId: string) => {
    try {
      await fetchInterviewResults(interviewId);
      toast.success('Results refreshed successfully');
    } catch (error) {
      console.error('Error refreshing results:', error);
      toast.error('Failed to refresh results');
    }
  };

  // ✅ Add the missing handleCreateTag function
  const handleCreateTag = () => {
    if (!newTag.name.trim()) {
      toast.error('Tag name is required');
      return;
    }

    const tag: CandidateTag = {
      id: newTag.name.toLowerCase().replace(/\s+/g, '-'),
      name: newTag.name.trim(),
      color: newTag.color,
      description: newTag.description.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedTags = [...candidateTags, tag];
    setCandidateTags(updatedTags);
    localStorage.setItem('candidateTags', JSON.stringify(updatedTags));
    
    setNewTag({ name: '', color: '#1976d2', description: '' });
    setShowTagDialog(false);
    toast.success(`Tag "${tag.name}" created successfully!`);
  };

  // ✅ Add the missing getTagByName function
  const getTagByName = (tagName: string) => {
    return candidateTags.find(tag => tag.name === tagName || tag.id === tagName);
  };

  // ✅ Load tags from localStorage on component mount
  useEffect(() => {
    const savedTags = localStorage.getItem('candidateTags');
    if (savedTags) {
      try {
        const parsedTags = JSON.parse(savedTags);
        setCandidateTags(parsedTags);
      } catch (error) {
        console.error('Error parsing saved tags:', error);
        // Initialize with default tags if parsing fails
        const defaultTags: CandidateTag[] = [
          {
            id: 'general',
            name: 'General',
            color: '#1976d2',
            description: 'General candidates',
            createdAt: new Date().toISOString()
          }
        ];
        setCandidateTags(defaultTags);
        localStorage.setItem('candidateTags', JSON.stringify(defaultTags));
      }
    } else {
      // Initialize with default tags
      const defaultTags: CandidateTag[] = [
        {
          id: 'general',
          name: 'General',
          color: '#1976d2',
          description: 'General candidates',
          createdAt: new Date().toISOString()
        }
      ];
      setCandidateTags(defaultTags);
      localStorage.setItem('candidateTags', JSON.stringify(defaultTags));
    }
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoadingAssessments(true);
      const response = await fetch(`${ASSESSMENT_API_URL}/api/assessments`);
      if (response.ok) {
        const data = await response.json();
        setAssessments(data.assessments || []);
      }
    } catch (error) {
      console.error('Error fetching assessments:', error);
      setAssessments([]);
    } finally {
      setLoadingAssessments(false);
    }
  };

  const generateAssessmentLink = async (assessmentId: string): Promise<string> => {
    try {
      // Generate assessment link - you might need to adjust this based on your assessment system
      return `https://dev.d23pi31x94e0bg.amplifyapp.com/assessment/${assessmentId}`;
    } catch (error) {
      throw new Error('Failed to generate assessment link');
    }
  };

  const getCandidatesForAssessment = async (assessmentId: string) => {
    try {
      const response = await fetch(`${ASSESSMENT_API_URL}/report/${assessmentId}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error getting candidates for assessment:', error);
      return null;
    }
  };

  const handleSendEmailSubmit = async () => {
    if (!selectedAssessmentForEmail || !candidateEmailInput.trim()) {
      toast.error('Please select an assessment and enter an email');
      return;
    }

    try {
      const assessmentLink = await generateAssessmentLink(selectedAssessmentForEmail.id);
      
      const response = await fetch(`${API_BASE_URL}/send-assessment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: candidateEmailInput,
          assessmentLink: assessmentLink,
          assessmentTitle: selectedAssessmentForEmail.testName,
          jobRole: selectedAssessmentForEmail.jobRole,
          candidateName: 'Candidate',
          experience: selectedAssessmentForEmail.experience,
          duration: selectedAssessmentForEmail.duration,
          totalQuestions: selectedAssessmentForEmail.totalTopics
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success('Assessment link sent successfully!');
        setEmailDialogOpen(false);
        setCandidateEmailInput('');
      } else {
        toast.error(result.message || 'Failed to send assessment link');
      }
    } catch (error) {
      console.error('Error sending assessment link:', error);
      toast.error('Failed to send assessment link');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const updatedTags = candidateTags.filter(tag => tag.id !== tagId);
      setCandidateTags(updatedTags);
      localStorage.setItem('candidateTags', JSON.stringify(updatedTags));
      
      // Reset filter if deleted tag was selected
      if (tagFilter === tagId) {
        setTagFilter('all');
      }
      
      toast.success('Tag deleted successfully');
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  const renderCandidateTag = (interview: InterviewDetails) => {
    const currentTag = interview.tag;
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={currentTag || ''}
            onChange={(e) => handleInterviewTagChange(interview.interview_id, e.target.value)}
            displayEmpty
            size="small"
          >
            <MenuItem value="">
              <em>No tag</em>
            </MenuItem>
            {candidateTags.map((tag) => (
              <MenuItem key={tag.id} value={tag.name}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: tag.color
                    }}
                  />
                  {tag.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {currentTag && (
          <Chip
            label={currentTag}
            size="small"
            sx={{
              backgroundColor: candidateTags.find(t => t.name === currentTag)?.color || '#1976d2',
              color: 'white',
              fontWeight: 500
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      p: isMobile ? 1 : 3
    }}>
      {/* Header with Tag Management */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1 }}>
              Interview Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage AI interviews and coding assessments
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowTagDialog(true)}
            sx={{ 
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#1565c0' }
            }}
          >
            Create Tag
          </Button>
        </Box>

        {/* Tag Filter */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 'medium', mr: 1 }}>
            Filter by tag:
          </Typography>
          <Chip
            label="All"
            onClick={() => setTagFilter('all')}
            color={tagFilter === 'all' ? 'primary' : 'default'}
            size="small"
            clickable
          />
          <Chip
            label="Untagged"
            onClick={() => setTagFilter('untagged')}
            color={tagFilter === 'untagged' ? 'primary' : 'default'}
            size="small"
            clickable
          />
          {candidateTags.map((tag) => (
            <Chip
              key={tag.id}
              label={`${tag.name} (${interviews.filter(i => i.tag === tag.name).length})`}
              onClick={() => setTagFilter(tag.name)}
              onDelete={() => handleDeleteTag(tag.id)}
              color={tagFilter === tag.name ? 'primary' : 'default'}
              size="small"
              clickable
              sx={{
                backgroundColor: tagFilter === tag.name ? tag.color : undefined,
                color: tagFilter === tag.name ? 'white' : undefined,
                '& .MuiChip-deleteIcon': {
                  color: tagFilter === tag.name ? 'white' : undefined
                }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Search and Actions */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search by name, ID, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
        <Button
          variant="outlined"
          onClick={loadInterviews}
          startIcon={<Refresh />}
          disabled={loading}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          onClick={updateAssessmentStatuses}
          startIcon={<Timeline />}
          disabled={!selectedAssessment}
        >
          Refresh Assessment Status
        </Button>
        <Button
          variant="contained"
          onClick={sendBulkAssessmentEmails}
          startIcon={<EmailIcon />}
          disabled={!selectedAssessment || filteredInterviewsByTag.length === 0 || sendingBulkEmails}
          sx={{ 
            backgroundColor: '#4caf50',
            '&:hover': { backgroundColor: '#45a049' }
          }}
        >
          {sendingBulkEmails ? 'Sending...' : `Send Bulk Emails (${filteredInterviewsByTag.length})`}
        </Button>
      </Box>

      {/* Main Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Candidate</TableCell>
                    <TableCell>Tag</TableCell>
                    <TableCell>Assessment Score</TableCell>
                    <TableCell>Email Sent</TableCell>
                    <TableCell>AI Interview</TableCell>
                    <TableCell>Interview Score</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInterviewsByTag.map((interview) => (
                    <TableRow key={interview.interview_id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {interview.candidate_name?.charAt(0) || '?'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {interview.candidate_name || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {interview.candidate_phone || 'No phone'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {extractCandidateEmail(interview)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {renderCandidateTag(interview)}
                      </TableCell>
                      <TableCell>
                        {renderAssessmentScore(interview)}
                      </TableCell>
                      <TableCell>
                        {renderEmailSent(interview)}
                      </TableCell>
                      <TableCell>
                        {renderCurrentInterviewStatus(interview)}
                      </TableCell>
                      <TableCell>
                        {renderInterviewScore(interview)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setShowInterviewForm(interview.interview_id)}
                            startIcon={<PlayArrow />}
                          >
                            Start AI Interview
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Interview Form Dialog */}
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
                    size="small"
                    disabled={uploading}
                    sx={{ 
                      backgroundColor: '#1976d2',
                      '&:hover': { backgroundColor: '#1565c0' },
                      mr: 1
                    }}
                  >
                    {uploading ? <CircularProgress size={16} /> : 'Upload Resume'}
                  </Button>
                </label>
                {interviewFormData.resume && (
                  <Chip
                    label="Resume uploaded"
                    size="small"
                    color="success"
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Upload candidate's resume (PDF, DOC, DOCX)
                </Typography>
              </Box>
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
                InputProps={{
                  startAdornment: <InputAdornment position="start">👤</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Total Questions"
                name="totalQuestion"
                type="number"
                value={interviewFormData.totalQuestion}
                onChange={handleInterviewFormChange}
                error={!!formErrors.totalQuestion}
                helperText={formErrors.totalQuestion}
                InputProps={{
                  startAdornment: <InputAdornment position="start">❓</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Time"
                name="startTime"
                type="datetime-local"
                value={interviewFormData.startTime?.toISOString().slice(0, 16) || ''}
                onChange={handleInterviewFormChange}
                error={!!formErrors.startTime}
                helperText={formErrors.startTime}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Expiry Time"
                name="expiryTime"
                type="datetime-local"
                value={interviewFormData.expiryTime?.toISOString().slice(0, 16) || ''}
                onChange={handleInterviewFormChange}
                error={!!formErrors.expiryTime}
                helperText={formErrors.expiryTime}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                name="duration"
                type="number"
                value={interviewFormData.duration}
                onChange={handleInterviewFormChange}
                error={!!formErrors.duration}
                helperText={formErrors.duration}
                InputProps={{
                  startAdornment: <InputAdornment position="start">⏱️</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowInterviewForm(null)}>
            Cancel
          </Button>
          <Button
            onClick={handleStartInterview}
            variant="contained"
            disabled={isSubmittingInterview}
          >
            {isSubmittingInterview ? <CircularProgress size={16} /> : 'Start Interview'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Dialog */}
      <Dialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6">
            Send Assessment Link via Email
          </Typography>
        </DialogTitle>

        <DialogContent>
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
            disabled={!candidateEmailInput.trim() || !/\S+@\S+\.\S+/.test(candidateEmailInput)}
            startIcon={<EmailIcon />}
          >
            Send Assessment Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog 
        open={showTagDialog} 
        onClose={() => setShowTagDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Create New Tag
            </Typography>
            <IconButton onClick={() => setShowTagDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tag Name"
                value={newTag.name}
                onChange={(e) => setNewTag(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter tag name"
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newTag.description}
                onChange={(e) => setNewTag(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter tag description"
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Select a color for the tag:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['#1976d2', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#2196f3'].map(color => (
                  <Box
                    key={color}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      backgroundColor: color,
                      cursor: 'pointer',
                      border: newTag.color === color ? '2px solid #000' : '2px solid transparent'
                    }}
                    onClick={() => setNewTag(prev => ({ ...prev, color }))}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowTagDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTag}
            variant="contained"
            size="small"
          >
            Create Tag
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;