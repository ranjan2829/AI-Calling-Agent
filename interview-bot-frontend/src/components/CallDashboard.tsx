import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
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
  Divider,
  Tab,
  Tabs,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  IconButton
} from '@mui/material';
import {
  Phone,
  Assessment,
  Work,
  Save,
  CheckCircle,
  People,
  PlayArrow,
  Stop,
  Error,
  CloudUpload,
  PhoneInTalk,
  QuestionAnswer,
  Edit,
  Tag,
  Refresh,
  Search,
  Delete
} from '@mui/icons-material';
import { getCallStats, getJobDescription, getAllInterviews, callsApi } from '../api/services';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import BulkPdfProcessor from './BulkPdfProcessor';

interface CallStats {
  totalCalls: number;
  completedCalls: number;
  incompleteSilence?: number;
  terminated?: number;
  inProgress?: number;
  callbackRequested?: number;
}
interface JobDescription {
  title: string;
  company: string;
  description: string;
  required_skills: string;
  experience_required: string;
}
interface Contact {
  name: string;
  phone: string;
  email?: string;
  experience?: string;
  skills?: string;
  tag?: string;
  batch_name?: string;
}
interface CallResult {
  contact: Contact;
  status: 'SUCCESS' | 'FAILED';
  call_sid?: string;
  timestamp: string;
  message: string;
}
interface BulkCallSession {
  bulk_call_id: string;
  status: string;
  current_index: number;
  total_contacts: number;
  completed_calls: number;
  results: CallResult[];
  start_time: string;
}

interface TagSummary {
  tag_id: string;
  tag_name: string;
  total_candidates: number;
  total_batches: number;
  created_at?: string;
  last_updated?: string;
  folder_path?: string;
}

interface CandidateTag {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
}

const initiateCall = async (phoneNumber: string) => {
  try {
    const response = await fetch('http://13.204.76.229:8000/make-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error initiating call:', error);
    throw error;
  }
};

interface InterviewQuestion {
  id: number;
  question: string;
}

export const CallDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [savingJD, setSavingJD] = useState(false);
  const [jdSaved, setJdSaved] = useState(false);
  // FIX: Initialize as empty array
  const [interviews, setInterviews] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<CallStats>({
    totalCalls: 0,
    completedCalls: 0,
    incompleteSilence: 0,
    terminated: 0,
    inProgress: 0,
    callbackRequested: 0
  });
  const [jobDescription, setJobDescription] = useState<JobDescription>({
    title: '',
    company: '',
    description: '',
    required_skills: '',
    experience_required: ''
  });
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  
  // Single call states
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Bulk calling states
  const [tabValue, setTabValue] = useState(0);
  // FIX: Initialize as empty array
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isBulkCalling, setIsBulkCalling] = useState(false);
  const [bulkCallSession, setBulkCallSession] = useState<BulkCallSession | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Add new state for questions
  const [questions, setQuestions] = useState<InterviewQuestion[]>([
    { id: 0, question: "Is this a good time to speak for a 3-4 minute interview?" },
    { id: 1, question: "Introduce yourself." },
    { id: 2, question: "What are your key skills for this role?" },
    { id: 3, question: "What is your current notice period?" },
    { id: 4, question: "What is your current CTC and expected salary?" },
    { id: 5, question: "Tell us about your experience with APIs." },
    { id: 6, question: "What is your understanding of cloud platforms? Have you worked with AWS, Azure, or GCP?" },
    { id: 7, question: "Describe your experience with deployments, including the use of Docker and Kubernetes." },
    { id: 8, question: "What is your experience with AI and machine learning? Mention any GenAI, deep learning technologies, or frameworks you've used." }
  ]);
  const [savingQuestions, setSavingQuestions] = useState(false);

  // Add new state for Twilio balance
  const [twilioBalance, setTwilioBalance] = useState<{
    balance: string;
    currency: string;
    loading: boolean;
  }>({
    balance: '0.00',
    currency: 'USD',
    loading: false
  });

  // NEW: Tag-based states
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [tagCandidates, setTagCandidates] = useState<Contact[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ NEW: Add candidateTags state to match other components
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadCallStats();
    loadJobDescription();
    loadInterviews();
    loadQuestions(); 
    loadTwilioBalance();
    loadTagsSummary(); // NEW: Load tags on mount
    loadCandidateTagsFromStorage(); // ✅ NEW: Load candidate tags from localStorage
  }, []);

  // ✅ FIXED: Add the missing loadCallStats function
  const loadCallStats = async () => {
    try {
      // 🔥 FIX: Use getAllInterviewsDetailed instead of getCallStats
      const response = await callsApi.getAllInterviewsDetailed();
      const allInterviews = response.data.interviews || [];
      
      console.log('📊 CallDashboard - Raw interviews loaded:', allInterviews.length);
      
      // 🔥 Include ALL interviews (same logic as CallHistory)
      const validInterviews = allInterviews.filter(interview => {
        const hasBasicData = interview.interview_id || interview.call_sid;
        
        // Don't exclude INCOMPLETE_SILENCE - keep them!
        if (!hasBasicData) {
          return false;
        }
        
        // Keep INCOMPLETE_SILENCE interviews
        if (interview.status === 'INCOMPLETE_SILENCE') {
          return true;
        }
        
        // Check for invalid time fields
        const completionTime = interview.completion_time;
        const endTime = interview.end_time;
        const startTime = interview.start_time;
        
        if (completionTime === "N/A" || endTime === "N/A" || startTime === "N/A") {
          return false;
        }
        
        if ((!completionTime || !endTime || !startTime) && 
            (!interview.responses || interview.responses.length === 0)) {
          return false;
        }
        
        return true;
      });
      
      console.log('📊 CallDashboard - Valid interviews after filtering:', validInterviews.length);
      
      // 🔥 Calculate comprehensive stats
      const totalCalls = validInterviews.length;
      const completedCalls = validInterviews.filter(i => i.status === 'COMPLETED').length;
      const incompleteSilence = validInterviews.filter(i => i.status === 'INCOMPLETE_SILENCE').length;
      const terminated = validInterviews.filter(i => i.status === 'TERMINATED').length;
      const inProgress = validInterviews.filter(i => i.status === 'IN_PROGRESS').length;
      const callbackRequested = validInterviews.filter(i => i.status === 'CALLBACK_REQUESTED').length;
      
      console.log('📊 CallDashboard - Stats breakdown:', {
        totalCalls,
        completedCalls,
        incompleteSilence,
        terminated,
        inProgress,
        callbackRequested
      });
      
      setCallStats({ 
        totalCalls, 
        completedCalls,
        incompleteSilence,
        terminated,
        inProgress,
        callbackRequested
      });
      
      // Also set the interviews for display
      setInterviews(validInterviews);
      
    } catch (error) {
      console.error('Error loading call stats:', error);
      setCallStats({ 
        totalCalls: 0, 
        completedCalls: 0,
        incompleteSilence: 0,
        terminated: 0,
        inProgress: 0,
        callbackRequested: 0
      });
      setInterviews([]);
    }
  };

  const loadJobDescription = async () => {
    try {
      const jd = await getJobDescription();
      setJobDescription(jd || {
        title: '',
        company: '',
        description: '',
        required_skills: '',
        experience_required: ''
      });
    } catch (error) {
      console.error('Error loading job description:', error);
      // FIX: Set default values on error
      setJobDescription({
        title: '',
        company: '',
        description: '',
        required_skills: '',
        experience_required: ''
      });
    }
  };

  const loadInterviews = async () => {
    try {
      const data = await getAllInterviews();
      // FIX: Always ensure interviews is an array
      setInterviews(data?.interviews || []);
    } catch (error) {
      console.error('Error loading interviews:', error);
      // FIX: Set empty array on error
      setInterviews([]);
    }
  };

  // ✅ NEW: Load candidate tags from localStorage (same as other components)
  const loadCandidateTagsFromStorage = () => {
    const savedTags = localStorage.getItem('candidateTags');
    if (savedTags) {
      try {
        const parsedTags = JSON.parse(savedTags);
        setCandidateTags(parsedTags);
        console.log('✅ Loaded candidate tags from localStorage:', parsedTags);
        
        // Convert to TagSummary format for compatibility
        const tagSummaries: TagSummary[] = parsedTags.map((tag: CandidateTag) => ({
          tag_id: tag.id,
          tag_name: tag.name,
          total_candidates: 0, // Will be updated when candidates are loaded
          total_batches: 0,
          created_at: tag.createdAt,
          last_updated: tag.createdAt,
          folder_path: `local-data/${tag.id}`
        }));
        
        setTags(tagSummaries);
        
      } catch (error) {
        console.error('Error parsing saved tags:', error);
        // Don't initialize default tags - just set empty arrays
        setCandidateTags([]);
        setTags([]);
      }
    } else {
      // No saved tags - just set empty arrays
      setCandidateTags([]);
      setTags([]);
    }
  };

  // Add this function
  const loadQuestions = async () => {
    try {
      const response = await callsApi.getInterviewQuestions();
      if (response.success && response.questions) {
        setQuestions(response.questions);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  // Add this function to load Twilio balance
  const loadTwilioBalance = async () => {
    try {
      setTwilioBalance(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('http://13.204.76.229:8000/twilio-balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setTwilioBalance({
          balance: result.balance,
          currency: result.currency || 'USD',
          loading: false
        });
      } else {
        // ✅ Fix the error handling here
        const errorMessage = typeof result.error === 'object' ? JSON.stringify(result.error) : (result.error || 'Failed to fetch balance');
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error loading Twilio balance:', error);
      setTwilioBalance({
        balance: 'Error',
        currency: 'USD',
        loading: false
      });
    }
  };

  const handleSaveJD = async () => {
    try {
      setSavingJD(true);
      const response = await callsApi.updateJobDescription(jobDescription);
      
      if (response.data.success) {
        toast.success('Job Description updated successfully!');
        setJdSaved(true);
        setTimeout(() => setJdSaved(false), 3000);
      } else {
        toast.error(`Failed to update JD: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error("Error updating JD:", error);
      toast.error(`Failed to update JD: ${error.message}`);
    } finally {
      setSavingJD(false);
    }
  };

  const handleRunAnalysis = async () => {
    try {
      setLoading(true);
      const response = await callsApi.runJDAnalysis();
      
      if (response.data && !response.data.error) {
        toast.success('JD Analysis completed successfully!');
      } else {
        toast.error('Analysis failed: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (error: any) {
      toast.error('Failed to run analysis: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeCall = async (customPhone?: string) => {
    if (isCallInProgress) {
      toast.warning('A call is already in progress');
      return;
    }

    const targetPhone = customPhone || phoneNumber;
    if (!targetPhone) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsCallInProgress(true);
    setCallResult(null);

    try {
      const result = await initiateCall(targetPhone); // Now it's defined!
      
      if (result.success) {
        setCallResult(result);
        toast.success(`Call initiated successfully to ${targetPhone}`);
      } else {
        throw new Error(result.error || 'Call failed');
      }
    } catch (error: any) {
      console.error('Call failed:', error);
      toast.error(`Call failed: ${error.message}`);
      setCallResult({ error: error.message });
    } finally {
      setIsCallInProgress(false);
    }
  };

  // Bulk calling functions
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://13.204.76.229:8000/upload-csv', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        // FIX: Always ensure contacts is an array
        const processedContacts = result.contacts || [];
        
        const validContacts = processedContacts.map((contact: any) => ({
          name: contact.name || contact.Name || `Contact_${Math.random().toString(36).substr(2, 4)}`,
          phone: contact.phone || contact.Phone || contact.mobile || contact.Mobile,
          data: contact.data || ''
        })).filter((contact: any) => contact.phone);
        
        setContacts(validContacts);
        toast.success(`${validContacts.length} contacts loaded successfully!`);
      } else {
        setContacts([]);
        toast.error(result.error || 'Failed to process CSV file');
      }
    } catch (error: any) {
      setContacts([]);
      toast.error('Failed to upload CSV: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const startBulkCalling = async () => {
    if (contacts.length === 0) return;
    
    setIsBulkCalling(true);
    
    try {
      const response = await fetch('http://13.204.76.229:8000/bulk-call', {
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
        
        pollBulkCallStatus(result.bulk_call_id);
        toast.success('Sequential bulk calling started!');
      } else {
        toast.error(result.error);
        setIsBulkCalling(false);
      }
    } catch (error: any) {
      toast.error('Failed to start bulk calling: ' + error.message);
      setIsBulkCalling(false);
    }
  };

  const pollBulkCallStatus = async (bulkCallId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://13.204.76.229:8000/bulk-call-status/${bulkCallId}`);
        
        if (!response.ok) {
          console.warn(`Bulk call status endpoint returned ${response.status} for ${bulkCallId}`);
          return;
        }
        
        const status = await response.json();
        
        if (!status.error) {
          setBulkCallSession(status);
          
          if (status.status === 'COMPLETED' || status.status === 'STOPPED' || status.status === 'ERROR') {
            clearInterval(pollInterval);
            setIsBulkCalling(false);
            
            if (status.status === 'COMPLETED') {
              toast.success('Bulk calling completed!');
              loadCallStats();
            }
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
        // Don't clear interval on network errors, keep trying
      }
    }, 2000);
    
    // Auto-clear interval after 10 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsBulkCalling(false);
    }, 600000);
  };
  const stopBulkCalling = async () => {
    if (!bulkCallSession) return;
    try {
      const response = await fetch(`http://13.204.76.229:8000/stop-bulk-call/${bulkCallSession.bulk_call_id}`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        toast.info('Bulk calling stopped');
      }
    } catch (error: any) {
      toast.error('Failed to stop bulk calling: ' + error.message);
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
  const isValidPhoneNumber = (phone: string) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };
  
  // Add this function
  const saveQuestions = async () => {
    try {
      setSavingQuestions(true);
      const response = await callsApi.updateInterviewQuestions(questions);
      if (response.success) {
        toast.success('Questions updated successfully!');
      } else {
        toast.error('Failed to update questions');
      }
    } catch (error: any) {
      toast.error('Failed to update questions: ' + error.message);
    } finally {
      setSavingQuestions(false);
    }
  };

  // Add this function
  const updateQuestion = (id: number, newText: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, question: newText } : q
    ));
  };

  // NEW: Load tags summary from local JSON files
  const loadTagsSummary = async () => {
    try {
      setLoadingTags(true);
      console.log('🔍 Loading tags with case-sensitive matching...');
      
      // Load from localStorage first
      const savedTags = localStorage.getItem('candidateTags');
      let localTags: TagSummary[] = [];
      
      if (savedTags) {
        try {
          const parsedTags = JSON.parse(savedTags);
          if (parsedTags && parsedTags.length > 0) {
            localTags = parsedTags.map((tag: CandidateTag) => ({
              tag_id: tag.id,
              tag_name: tag.name, // Keep EXACT case
              total_candidates: 0,
              total_batches: 1,
              created_at: tag.createdAt,
              last_updated: tag.createdAt,
              folder_path: `local-data/${tag.id}`,
              color: tag.color,
              description: tag.description
            }));
            
            console.log('✅ Loaded case-sensitive tags from localStorage:', localTags);
          }
        } catch (error) {
          console.error('Error parsing localStorage tags:', error);
        }
      }
      
      // 🔥 Get candidate counts with EXACT case-sensitive matching
      try {
        const response = await fetch('http://13.204.76.229:8000/local-tags-summary-exact');
        
        if (response.ok) {
          const result = await response.json();
          console.log('📊 Case-sensitive backend tags result:', result);
          
          if (result.success && result.tags?.length > 0) {
            const backendTags = result.tags;
            
            // Update local tags with exact name matching
            localTags = localTags.map(localTag => {
              const backendTag = backendTags.find((bt: any) => 
                bt.tag_name === localTag.tag_name // EXACT case-sensitive match
              );
              
              if (backendTag) {
                return {
                  ...localTag,
                  total_candidates: backendTag.total_candidates || 0,
                  total_batches: backendTag.total_batches || 1,
                  last_updated: backendTag.last_updated || localTag.last_updated
                };
              }
              return localTag;
            });
            
            console.log('✅ Enhanced with case-sensitive backend data:', localTags);
          }
        }
      } catch (backendError) {
        console.log('⚠️ Backend not available, using localStorage tags only');
      }
      
      setTags(localTags);
      
      // Update candidateTags state
      if (savedTags) {
        try {
          const parsedTags = JSON.parse(savedTags);
          setCandidateTags(parsedTags);
        } catch (error) {
          console.error('Error setting candidate tags:', error);
        }
      }
      
      if (localTags.length === 0) {
        toast.info('No tags found. Create some tags first using the Bulk PDF Processor.');
      } else {
        toast.success(`✅ Loaded ${localTags.length} case-sensitive tags successfully!`);
      }
      
    } catch (error: any) {
      console.error('❌ Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setLoadingTags(false);
    }
  };

  // NEW: Load candidates from local JSON file for selected tag
  const loadCandidatesForTag = async (tagId: string) => {
    if (!tagId) {
      setTagCandidates([]);
      return;
    }

    try {
      setLoadingCandidates(true);
      console.log(`🔍 Loading candidates for EXACT tag: "${tagId}"`);
      
      // 🔥 FIX: Get the EXACT tag name from the tags array
      const selectedTagData = tags.find(t => t.tag_id === tagId);
      const exactTagName = selectedTagData?.tag_name || tagId;
      
      console.log(`🔥 Using EXACT tag name: "${exactTagName}" for search`);
      
      // 🔥 First attempt: Try with EXACT tag name (case sensitive)
      try {
        const response = await fetch(`http://13.204.76.229:8000/candidates-by-tag-exact/${encodeURIComponent(exactTagName)}`);
        
        if (response.ok) {
          const result = await response.json();
          console.log(`📊 Exact tag search result for "${exactTagName}":`, result);
          
          if (result.success && result.candidates?.length > 0) {
            const candidates = result.candidates;
            console.log(`✅ Found ${candidates.length} candidates for EXACT tag "${exactTagName}"`);
            
            const formattedCandidates = candidates.map((candidate: any) => ({
              name: candidate.name || `Candidate_${Math.random().toString(36).substr(2, 4)}`,
              phone: candidate.phone || '',
              email: candidate.email || '',
              experience: candidate.experience || candidate.skills || '',
              skills: candidate.skills || candidate.experience || '',
              tag: candidate.tag || exactTagName,
              batch_name: candidate.batch_name || candidate.fileName || 'Exact Match'
            }));
            
            setTagCandidates(formattedCandidates);
            setContacts(formattedCandidates);
            
            toast.success(`✅ Loaded ${candidates.length} candidates for "${exactTagName}"`);
            return;
          }
        }
      } catch (exactError) {
        console.log(`⚠️ Exact tag endpoint failed for "${exactTagName}":`, exactError);
      }
      
      // 🔥 Second attempt: Try with tag ID (folder-safe version)
      try {
        const response = await fetch(`http://13.204.76.229:8000/local-candidates-by-tag/${encodeURIComponent(tagId)}`);
        
        if (response.ok) {
          const result = await response.json();
          console.log(`📊 Local candidates result for tag ID "${tagId}":`, result);
          
          if (result.success && result.candidates?.length > 0) {
            const candidates = result.candidates;
            console.log(`✅ Found ${candidates.length} candidates via tag ID "${tagId}"`);
            
            const formattedCandidates = candidates.map((candidate: any) => ({
              name: candidate.name || `Candidate_${Math.random().toString(36).substr(2, 4)}`,
              phone: candidate.phone || '',
              email: candidate.email || '',
              experience: candidate.experience || candidate.skills || '',
              skills: candidate.skills || candidate.experience || '',
              tag: candidate.tag || exactTagName,
              batch_name: candidate.batch_name || candidate.fileName || 'Local Data'
            }));
            
            setTagCandidates(formattedCandidates);
            setContacts(formattedCandidates);
            
            toast.success(`✅ Loaded ${candidates.length} candidates for "${exactTagName}"`);
            return;
          }
        }
      } catch (localError) {
        console.log(`⚠️ Local endpoint failed for tag ID "${tagId}":`, localError);
      }
      
      // 🔥 Third attempt: Search in all folders for EXACT tag name match
      try {
        const response = await fetch(`http://13.204.76.229:8000/search-candidates-exact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            tag_name: exactTagName, // EXACT case-sensitive search
            case_sensitive: true 
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`📊 Exact search result for "${exactTagName}":`, result);
          
          if (result.success && result.candidates?.length > 0) {
            const candidates = result.candidates;
            console.log(`✅ Found ${candidates.length} candidates via exact search for "${exactTagName}"`);
            
            const formattedCandidates = candidates.map((candidate: any) => ({
              name: candidate.name || `Candidate_${Math.random().toString(36).substr(2, 4)}`,
              phone: candidate.phone || '',
              email: candidate.email || '',
              experience: candidate.experience || candidate.skills || '',
              skills: candidate.skills || candidate.experience || '',
              tag: candidate.tag || exactTagName,
              batch_name: candidate.batch_name || candidate.fileName || 'Search Data'
            }));
            
            setTagCandidates(formattedCandidates);
            setContacts(formattedCandidates);
            
            toast.success(`✅ Found ${candidates.length} candidates via exact search`);
            return;
          }
        }
      } catch (searchError) {
        console.log(`⚠️ Exact search failed for "${exactTagName}":`, searchError);
      }
      
      // If all attempts fail
      console.log(`❌ No candidates found for EXACT tag "${exactTagName}"`);
      setTagCandidates([]);
      setContacts([]);
      toast.warning(`No candidates found for tag "${exactTagName}". Make sure you've processed PDFs with this EXACT tag name (case-sensitive).`);
      
    } catch (error: any) {
      console.error('Error loading candidates:', error);
      setTagCandidates([]);
      setContacts([]);
      toast.error(`Error loading candidates: ${error.message}`);
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Handle tag selection
  const handleTagSelection = (tagId: string) => {
    setSelectedTagId(tagId);
    loadCandidatesForTag(tagId);
  };

  // NEW: Start bulk calling from tag candidates
  const startBulkCallingFromTag = async () => {
    if (tagCandidates.length === 0) {
      toast.error('No candidates available for calling');
      return;
    }
    
    setIsBulkCalling(true);
    
    try {
      // Format candidates for bulk calling API
      const formattedContacts = tagCandidates
        .filter(candidate => candidate.phone) // Only candidates with phone numbers
        .map(candidate => ({
          name: candidate.name,
          phone: candidate.phone,
          email: candidate.email,
          experience: candidate.experience || '',
          skills: candidate.skills || ''
        }));

      console.log(`🚀 Starting bulk calling for ${formattedContacts.length} candidates from tag ${selectedTagId}`);
      
      const response = await fetch('http://13.204.76.229:8000/bulk-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedContacts),
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
        
        const selectedTag = tags.find(t => t.tag_id === selectedTagId);
        toast.success(`Bulk calling started for ${formattedContacts.length} candidates from tag "${selectedTag?.tag_name}"`);
        pollBulkCallStatus(result.bulk_call_id);
      } else {
        toast.error(result.error);
        setIsBulkCalling(false);
      }
    } catch (error: any) {
      toast.error('Failed to start bulk calling: ' + error.message);
      setIsBulkCalling(false);
    }
  };

  // Filter candidates based on search
  const filteredCandidates = tagCandidates.filter(candidate => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      candidate.name?.toLowerCase().includes(searchLower) ||
      candidate.phone?.toLowerCase().includes(searchLower) ||
      candidate.email?.toLowerCase().includes(searchLower) ||
      candidate.skills?.toLowerCase().includes(searchLower)
    );
  });

  // ✅ Add tag deletion function
  const handleDeleteTag = async (tagId: string) => {
    const tagToDelete = candidateTags.find(tag => tag.id === tagId);
    if (!tagToDelete) {
      toast.error('Tag not found');
      return;
    }

    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the tag "${tagToDelete.name}"?\n\n` +
      `This will:\n` +
      `• Remove the tag from all candidates\n` +
      `• Delete associated candidate data files\n` +
      `• Clear this tag from call dashboard\n` +
      `• This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      // 1. Delete from backend
      try {
        const deleteResponse = await fetch(`http://13.204.76.229:8000/delete-tag/${tagId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tagName: tagToDelete.name,
            deleteAssociatedData: true
          }),
        });

        if (deleteResponse.ok) {
          const result = await deleteResponse.json();
          console.log('✅ Tag deleted from backend:', result);
          toast.success('Tag and associated data deleted from server');
        } else {
          console.warn('⚠️ Backend deletion failed');
          toast.warning('Server deletion failed, deleting locally');
        }
      } catch (backendError) {
        console.warn('⚠️ Backend not available:', backendError);
        toast.warning('Server not available, deleting locally only');
      }

      // 2. Remove from localStorage
      const updatedTags = candidateTags.filter(tag => tag.id !== tagId);
      setCandidateTags(updatedTags);
      localStorage.setItem('candidateTags', JSON.stringify(updatedTags));

      // 3. Update tags state
      setTags(prev => prev.filter(tag => tag.tag_id !== tagId));

      // 4. Reset selected tag if it was the deleted one
      if (selectedTagId === tagId) {
        setSelectedTagId('');
        setTagCandidates([]);
        setContacts([]);
      }

      toast.success(`Tag "${tagToDelete.name}" deleted successfully`);
      
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Logo - FIX: Correct logo path */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <img
          src="/title-logo.svg"
          alt="Logo"
          style={{
            height: '48px',
            width: 'auto',
            marginRight: '16px'
          }}
          onError={(e) => {
            console.warn('Logo not found, hiding image');
            e.currentTarget.style.display = 'none';
          }}
        />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
            AI Interview Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage job descriptions, make calls, and monitor interview performance
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ color: 'primary.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {callStats.totalCalls}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Total Interviews
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ color: 'success.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main', fontSize: '1.25rem' }}>
                    {callStats.completedCalls}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Completed
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ color: 'warning.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.main', fontSize: '1.25rem' }}>
                    {callStats.incompleteSilence || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    No Response
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Error sx={{ color: 'error.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '1.25rem' }}>
                    {callStats.terminated || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Terminated
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tag sx={{ color: 'info.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'info.main', fontSize: '1.25rem' }}>
                    {tags.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Data Tags
                  </Typography>
                </Box>
              </Box>
              <Button 
                size="small" 
                variant="text"
                onClick={loadTagsSummary}
                disabled={loadingTags}
                sx={{ 
                  fontSize: '0.6rem', 
                  minWidth: 'auto', 
                  p: 0.5,
                  mt: 0.5
                }}
              >
                Refresh
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ height: '100px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ color: 'primary.main', fontSize: 24, mr: 1 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.25rem' }}>
                    {selectedTagId ? tagCandidates.length : contacts.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Ready to Call
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Single Call" />
            <Tab label="Tag-Based Bulk Calling" />
            <Tab label="CSV Upload" />
            <Tab label="Job Description" />
          </Tabs>
          {tabValue === 0 && (
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                  AI Interview Call
                </Typography>
                
                {/* Phone Number Input */}
                <Box sx={{ mb: 3, width: '100%', maxWidth: 400 }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isCallInProgress}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneInTalk />
                        </InputAdornment>
                      ),
                    }}
                    helperText="Enter phone number (e.g., +1234567890) or leave empty for default"
                    error={!!(phoneNumber && !isValidPhoneNumber(phoneNumber))}
                  />
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={() => handleMakeCall()}
                  disabled={isCallInProgress || (phoneNumber && !isValidPhoneNumber(phoneNumber))}
                  startIcon={isCallInProgress ? <CircularProgress size={24} /> : <Phone />}
                  sx={{ 
                    px: 4, 
                    py: 1.5, 
                    fontSize: '1.1rem',
                    minWidth: 250
                  }}
                >
                  {isCallInProgress ? 'Calling...' : 'Make AI Interview Call'}
                </Button>

                {callResult && (
                  <Alert 
                    severity={callResult.success ? 'success' : 'error'}
                    sx={{ mt: 3, width: '100%', maxWidth: 600 }}
                  >
                    {callResult.success ? (
                      <>
                        Call initiated successfully! Call SID: {callResult.call_sid}
                      </>
                    ) : (
                      <>
                        Call failed: {callResult.error}
                      </>
                    )}
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 4 }} />

              {/* NEW: Interview Questions Section - Moved Here */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <QuestionAnswer sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      Configure Interview Questions
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={savingQuestions ? <CircularProgress size={20} /> : <Save />}
                    onClick={saveQuestions}
                    disabled={savingQuestions}
                  >
                    {savingQuestions ? 'Saving...' : 'Save Questions'}
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    🎯 These questions will be asked during the AI interview. Question 0 is critical for availability checking.
                  </Typography>
                </Alert>

                <Grid container spacing={2}>
                  {questions.map((question) => (
                    <Grid item xs={12} key={question.id}>
                      <Card variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Chip 
                            label={`Q${question.id}`} 
                            color="primary" 
                            size="small"
                            sx={{ mr: 2, minWidth: 45 }}
                          />
                          <Typography variant="body2" color="textSecondary">
                            Question {question.id}
                            {question.id === 0 && " (Availability Check - Critical)"}
                            {question.id === 2 && " (Skills Assessment)"}
                            {(question.id === 0 || question.id === 3 || question.id === 4) && " - Non-Editable"}
                          </Typography>
                        </Box>
                        
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, e.target.value)}
                          variant="outlined"
                          placeholder={`Enter question ${question.id}...`}
                          disabled={question.id === 0 || question.id === 3 || question.id === 4} // Disable editing for Q0, Q3, Q4
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Edit sx={{ color: (question.id === 0 || question.id === 3 || question.id === 4) ? 'text.disabled' : 'text.secondary' }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)', // Make disabled text more visible
                              backgroundColor: 'rgba(0, 0, 0, 0.04)' // Light grey background for disabled fields
                            }
                          }}
                        />
                        
                        {question.id === 0 && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                              ⚠️ This question determines if the interview continues or not as per the candidate's availability.
                            </Typography>
                          </Alert>
                        )}

                        {question.id === 2 && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                              🎯 This question is used for JD matching.
                            </Typography>
                          </Alert>
                        )}
                        {(question.id === 3 || question.id === 4) && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                               This is a standard question and cannot be modified.
                            </Typography>
                          </Alert>
                        )}
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {/* REMOVED: Interview Configuration Summary Card */}
              </Box>
            </Box>
          )}

          {/* NEW: Tag-Based Bulk Calling Tab */}
          {tabValue === 1 && (
            <Box sx={{ minHeight: '70vh' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                Tag-Based Bulk Calling Dashboard
              </Typography>
              
              {/* Tag Selection Section */}
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Select Data Tag for Bulk Calling
                    </Typography>
                    <Button
                      startIcon={loadingTags ? <CircularProgress size={20} /> : <Refresh />}
                      onClick={loadTagsSummary}
                      disabled={loadingTags}
                    >
                      Refresh Tags
                    </Button>
                  </Box>

                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Select Tag</InputLabel>
                        <Select
                          value={selectedTagId}
                          label="Select Tag"
                          onChange={(e) => handleTagSelection(e.target.value)}
                          disabled={loadingTags || isBulkCalling}
                        >
                          <MenuItem value="">
                            <em>Choose a tag...</em>
                          </MenuItem>
                          {/* ✅ FIX: Add null check for tags array */}
                          {(tags || []).map((tag) => (
                            <MenuItem key={tag.tag_id} value={tag.tag_id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Tag sx={{ mr: 1, color: 'primary.main' }} />
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                    {tag.tag_name}
                                  </Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    {tag.total_candidates} candidates • {tag.total_batches} batches
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      {selectedTagId && (
                        <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Selected Tag: {(tags || []).find(t => t.tag_id === selectedTagId)?.tag_name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {tagCandidates.length} candidates ready for calling
                          </Typography>
                          {tagCandidates.length > 0 && (
                            <Button
                              variant="contained"
                              size="large"
                              startIcon={isBulkCalling ? <CircularProgress size={20} /> : <PlayArrow />}
                              onClick={startBulkCallingFromTag}
                              disabled={isBulkCalling || tagCandidates.length === 0}
                              sx={{ mt: 2 }}
                            >
                              {isBulkCalling ? 'Calling in Progress...' : `Start Calling ${tagCandidates.length} Candidates`}
                            </Button>
                          )}
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Candidates List Section */}
              {selectedTagId && (
                <Grid container spacing={4}>
                  <Grid item xs={12} md={8}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Candidates from "{(tags || []).find(t => t.tag_id === selectedTagId)?.tag_name}" ({filteredCandidates.length})
                          </Typography>
                          
                          <TextField
                            size="small"
                            placeholder="Search candidates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Search />
                                </InputAdornment>
                              ),
                            }}
                            sx={{ width: 250 }}
                          />
                        </Box>

                        {loadingCandidates ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                          </Box>
                        ) : filteredCandidates.length === 0 ? (
                          <Alert severity="info">
                            <Typography variant="body1">
                              No candidates found for this tag. Please upload PDF data using the Bulk PDF Processor.
                            </Typography>
                          </Alert>
                        ) : (
                          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                            <Table stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Phone</TableCell>
                                  <TableCell>Email</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {filteredCandidates.map((candidate, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{candidate.name}</TableCell>
                                    <TableCell>{candidate.phone}</TableCell>
                                    <TableCell>{candidate.email || 'N/A'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Bulk Calling Status
                        </Typography>

                        {isBulkCalling && bulkCallSession ? (
                          <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                              <Typography variant="body2">
                                📞 Bulk calling in progress...
                              </Typography>
                            </Alert>
                            
                            <Box sx={{ mb: 3 }}>
                              <Typography variant="body2" color="textSecondary">
                                Progress: {bulkCallSession.completed_calls} / {bulkCallSession.total_contacts}
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={(bulkCallSession.completed_calls / bulkCallSession.total_contacts) * 100}
                                sx={{ mt: 1 }}
                              />
                            </Box>

                            <Button
                              variant="outlined"
                              color="warning"
                              startIcon={<Stop />}
                              onClick={stopBulkCalling}
                              fullWidth
                            >
                              Stop Calling
                            </Button>
                          </Box>
                        ) : (
                          <Box>
                            <Alert severity="success" sx={{ mb: 3 }}>
                              <Typography variant="body2">
                                🎯 Select a tag to view candidates and start bulk calling
                              </Typography>
                            </Alert>
                            
                            <Typography variant="h6" sx={{ mb: 2 }}>
                              Available Tags: {(tags || []).length}
                            </Typography>
                            
                            {/* ✅ Available tags with delete option */}
                            <List dense>
                              {(tags || []).slice(0, 5).map((tag) => (
                                <ListItem key={tag.tag_id}>
                                  <ListItemText
                                    primary={tag.tag_name}
                                    secondary={`${tag.total_candidates} candidates`}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteTag(tag.tag_id)}
                                    color="error"
                                    title={`Delete ${tag.tag_name} tag`}
                                  >
                                    <Delete sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </ListItem>
                              ))}
                              {(tags || []).length > 5 && (
                                <ListItem>
                                  <ListItemText
                                    secondary={`... and ${(tags || []).length - 5} more tags`}
                                  />
                                </ListItem>
                              )}
                            </List>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* CSV Upload Tab */}
          {tabValue === 2 && (
            <Box sx={{ minHeight: '70vh' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                CSV Upload Bulk Calling
              </Typography>
              
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                    Upload Contact List
                  </Typography>
                  
                  <Box
                    sx={{
                      border: '2px dashed #ccc',
                      borderRadius: 2,
                      p: 6,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' },
                      minHeight: 200
                    }}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="csv-upload"
                      disabled={isUploading || isBulkCalling}
                    />
                    <label htmlFor="csv-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                      <CloudUpload sx={{ fontSize: 72, color: 'text.secondary', mb: 3 }} />
                      <Typography variant="h5" sx={{ mb: 2 }}>
                        {isUploading ? 'Processing CSV...' : 'Drop CSV File Here or Click to Upload'}
                      </Typography>
                      <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
                        CSV should contain: name, phone, email, experience, skills
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Calls will be made sequentially with proper spacing
                      </Typography>
                    </label>
                  </Box>
                  
                  {contacts.length > 0 && (
                    <Alert severity="success" sx={{ mt: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <People sx={{ mr: 1 }} />
                        <Typography variant="h6">
                          {contacts.length} contacts loaded successfully - Ready for sequential calling!
                        </Typography>
                      </Box>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Bulk Calling Controls */}
              {contacts.length > 0 && (
                <Grid container spacing={4}>
                  <Grid item xs={12} md={8}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Contact List ({contacts.length} contacts)
                        </Typography>
                        
                        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Skills</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {contacts.map((contact, index) => (
                                <TableRow key={index}>
                                  <TableCell>{contact.name}</TableCell>
                                  <TableCell>{contact.phone}</TableCell>
                                  <TableCell>{contact.email || 'N/A'}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                                      {contact.skills || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                          Bulk Calling Controls
                        </Typography>

                        {!isBulkCalling ? (
                          <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            startIcon={<PlayArrow />}
                            onClick={startBulkCalling}
                            disabled={contacts.length === 0}
                            sx={{ mb: 2 }}
                          >
                            Start Sequential Calling ({contacts.length} contacts)
                          </Button>
                        ) : (
                          <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                              <Typography variant="body2">
                                📞 Bulk calling in progress...
                              </Typography>
                            </Alert>
                            
                            {bulkCallSession && (
                              <Box sx={{ mb: 3 }}>
                                <Typography variant="body2" color="textSecondary">
                                  Progress: {bulkCallSession.completed_calls} / {bulkCallSession.total_contacts}
                                </Typography>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={(bulkCallSession.completed_calls / bulkCallSession.total_contacts) * 100}
                                  sx={{ mt: 1 }}
                                />
                              </Box>
                            )}

                            <Button
                              variant="outlined"
                              color="warning"
                              startIcon={<Stop />}
                              onClick={stopBulkCalling}
                              fullWidth
                            >
                              Stop Calling
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* Job Description Tab */}
          {tabValue === 3 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Job Description
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveJD}
                  disabled={savingJD}
                  startIcon={savingJD ? <CircularProgress size={16} /> : <Save />}
                >
                  {savingJD ? 'Saving...' : 'Save Job Description'}
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={jobDescription.title}
                    onChange={(e) => setJobDescription({...jobDescription, title: e.target.value})}
                    sx={{ mb: 2 }}
                    placeholder="e.g., Senior Software Engineer"
                  />
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={jobDescription.company}
                    onChange={(e) => setJobDescription({...jobDescription, company: e.target.value})}
                    sx={{ mb: 2 }}
                    placeholder="e.g., Tech Innovations Inc."
                  />
                  <TextField
                    fullWidth
                    label="Experience Required"
                    value={jobDescription.experience_required}
                    onChange={(e) => setJobDescription({...jobDescription, experience_required: e.target.value})}
                    placeholder="e.g., 2-5 years experience in software development"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Job Description"
                    value={jobDescription.description}
                    onChange={(e) => setJobDescription({...jobDescription, description: e.target.value})}
                    sx={{ mb: 2 }}
                    placeholder="Brief description of the role..."
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Required Skills (comma-separated)"
                    value={jobDescription.required_skills}
                    onChange={(e) => setJobDescription({...jobDescription, required_skills: e.target.value})}
                    placeholder="python, javascript, react, node.js, sql, aws, docker"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="lg" fullWidth>
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
                    <TableCell>Call ID</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bulkCallSession.results.map((result, index) => (
                    <TableRow 
                      key={index} 
                      sx={{ backgroundColor: result.status === 'SUCCESS' ? 'success.50' : 'inherit' }}
                    >
                      <TableCell>#{index + 1}</TableCell>
                      <TableCell>{result.contact.name}</TableCell>
                      <TableCell>{result.contact.phone}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(result.status)}
                          label={result.status}
                          color={getStatusColor(result.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{result.call_sid || 'N/A'}</TableCell>
                      <TableCell>
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>{result.message}</TableCell>
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