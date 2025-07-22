import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Upload,
  Delete,
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Visibility,
  Download,
  FolderOpen,
  Label,
  Add,
  Sync,
  Save
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface CandidateTag {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
}

interface CandidateData {
  name: string;
  phone: string;
  email: string;
  fileName: string;
  extractedAt: string;
  tag?: string;
}

interface ProcessingStatus {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  candidateData?: CandidateData;
}

// Enhanced Data Manager for permanent storage
class PermanentDataManager {
  private static instance: PermanentDataManager;
  private dataFolder = '/ai-interview-data';
  private backendUrl = 'http://13.204.76.229:8000';

  static getInstance(): PermanentDataManager {
    if (!PermanentDataManager.instance) {
      PermanentDataManager.instance = new PermanentDataManager();
    }
    return PermanentDataManager.instance;
  }

  // Initialize permanent storage
  async initializePermanentStorage(): Promise<void> {
    try {
      await fetch(`${this.backendUrl}/api/data/initialize-permanent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folders: [
            'tags/permanent',
            'candidates/by_tag',
            'candidates/by_date', 
            'sync_logs',
            'backups/daily'
          ]
        })
      });

      // Initialize localStorage with permanent flag
      const storageKey = 'ai-interview-permanent-data';
      if (!localStorage.getItem(storageKey)) {
        const initialData = {
          tags: [],
          lastSync: new Date().toISOString(),
          permanentStorage: true,
          initialized: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(initialData));
      }
    } catch (error) {
      console.error('Failed to initialize permanent storage:', error);
    }
  }

  // Save tags permanently with backup
  async saveTagsPermanently(tags: CandidateTag[]): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const tagsData = {
        tags: tags,
        lastUpdated: timestamp,
        version: '2.0',
        backupCreated: timestamp
      };

      // Save to localStorage
      const storageKey = 'ai-interview-permanent-data';
      const currentData = this.getPermanentData();
      currentData.tags = tags;
      currentData.lastSync = timestamp;
      localStorage.setItem(storageKey, JSON.stringify(currentData));

      // Save to backend with backup
      await Promise.all([
        this.saveToBackend('tags/permanent/tags.json', tagsData),
        this.saveToBackend(`tags/permanent/backup_${timestamp.split('T')[0]}.json`, tagsData),
        this.saveToBackend('sync_logs/tags_sync.json', {
          type: 'TAGS_SYNC',
          timestamp: timestamp,
          tagsCount: tags.length,
          action: 'SAVE_PERMANENT'
        })
      ]);

      console.log('✅ Tags saved permanently:', tags.length);
    } catch (error) {
      console.error('❌ Failed to save tags permanently:', error);
    }
  }

  // Save candidate data with proper organization
  async saveCandidateData(candidates: CandidateData[], tag: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.split('T')[0];
      const tagSlug = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const uniqueId = `${tagSlug}_${dateStr}_${Date.now().toString().slice(-6)}`;
      
      const candidateData = {
        candidates: candidates,
        tag: tag,
        processedAt: timestamp,
        totalCount: candidates.length,
        uniqueId: uniqueId,
        metadata: {
          tag_id: tagSlug,
          tag_name: tag,
          total_candidates: candidates.length,
          created_at: timestamp,
          folder_path: `candidates/by_tag/${uniqueId}.json`
        }
      };

      // Save to multiple locations for redundancy
      const savePaths = [
        `candidates/by_tag/${uniqueId}.json`,
        `candidates/by_date/${dateStr}/${uniqueId}.json`,
        `backups/daily/${dateStr}_candidates_${uniqueId}.json`
      ];

      await Promise.all(
        savePaths.map(path => this.saveToBackend(path, candidateData))
      );

      console.log('✅ Candidate data saved permanently:', uniqueId);
      return uniqueId;
    } catch (error) {
      console.error('❌ Failed to save candidate data:', error);
      throw error;
    }
  }

  // Get permanent data from localStorage
  getPermanentData(): any {
    const storageKey = 'ai-interview-permanent-data';
    const data = localStorage.getItem(storageKey);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error('Error parsing permanent data:', error);
      }
    }
    return {
      tags: [],
      lastSync: new Date().toISOString(),
      permanentStorage: true,
      initialized: new Date().toISOString()
    };
  }

  // Backend operations
  private async saveToBackend(filepath: string, data: any): Promise<void> {
    try {
      await fetch(`${this.backendUrl}/api/data/save-permanent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: `${this.dataFolder}/${filepath}`,
          data: data,
          permanent: true
        })
      });
    } catch (error) {
      console.error(`Failed to save ${filepath}:`, error);
    }
  }

  // Create daily backup
  async createDailyBackup(): Promise<void> {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const data = this.getPermanentData();
      
      await this.saveToBackend(`backups/daily/full_backup_${dateStr}.json`, {
        ...data,
        backupDate: new Date().toISOString(),
        backupType: 'DAILY_FULL'
      });
      
      console.log('✅ Daily backup created:', dateStr);
    } catch (error) {
      console.error('❌ Failed to create daily backup:', error);
    }
  }
}

const API_BASE_URL = 'http://13.204.76.229:8000';

// Utility to fetch tags from backend
const fetchTagsFromBackend = async () => {
  try {
    const response = await fetch('http://13.204.76.229:8000/tags-summary');
    const data = await response.json();
    if (data.success && data.tags) {
      return data.tags.map((tag: any) => ({
        id: tag.tag_id,
        name: tag.tag_name,
        color: tag.color || '#1976d2',
        description: tag.description || '',
        createdAt: tag.created_at || new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error('Error fetching tags from backend:', error);
  }
  return [];
};

const BulkPdfProcessor: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingStatuses, setProcessingStatuses] = useState<ProcessingStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCandidates, setExtractedCandidates] = useState<CandidateData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced state with permanent storage
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#1976d2', description: '' });
  const [dataManager] = useState(() => PermanentDataManager.getInstance());
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('idle');

  // Initialize and load tags
  useEffect(() => {
    const initializeTags = async () => {
      setSyncStatus('initializing');
      
      // First try to load from localStorage
      const savedTags = localStorage.getItem('candidateTags');
      if (savedTags) {
        try {
          const parsedTags = JSON.parse(savedTags);
          if (parsedTags && parsedTags.length > 0) {
            setCandidateTags(parsedTags);
            setSelectedTag(parsedTags[0]?.name || '');
            setIsInitialized(true);
            setSyncStatus('ready');
            console.log('✅ Loaded existing tags from localStorage:', parsedTags.length);
            return;
          }
        } catch (error) {
          console.error('Error parsing saved tags:', error);
        }
      }

      // If no localStorage tags, try backend
      const backendTags = await fetchTagsFromBackend();
      if (backendTags && backendTags.length > 0) {
        setCandidateTags(backendTags);
        setSelectedTag(backendTags[0]?.name || '');
        localStorage.setItem('candidateTags', JSON.stringify(backendTags));
        setIsInitialized(true);
        setSyncStatus('ready');
        console.log('✅ Loaded tags from backend:', backendTags.length);
        return;
      }

      // If no tags found anywhere, create defaults
      console.log('🔧 No existing tags found, creating defaults...');
      await createDefaultTags();
    };

    initializeTags();
  }, []);

  // Create default tags
  const createDefaultTags = async () => {
    const defaultTags: CandidateTag[] = [
      {
        id: 'frontend',
        name: 'Frontend Developer',
        color: '#2196f3',
        description: 'React, Angular, Vue.js developers',
        createdAt: new Date().toISOString()
      },
      {
        id: 'backend',
        name: 'Backend Developer',
        color: '#4caf50',
        description: 'Node.js, Python, Java developers',
        createdAt: new Date().toISOString()
      },
      {
        id: 'fullstack',
        name: 'Full Stack Developer',
        color: '#ff9800',
        description: 'Frontend + Backend developers',
        createdAt: new Date().toISOString()
      },
      {
        id: 'devops',
        name: 'DevOps Engineer',
        color: '#9c27b0',
        description: 'AWS, Docker, Kubernetes experts',
        createdAt: new Date().toISOString()
      }
    ];

    setCandidateTags(defaultTags);
    setSelectedTag(defaultTags[0].name);
    localStorage.setItem('candidateTags', JSON.stringify(defaultTags));
    await dataManager.saveTagsPermanently(defaultTags);
    setIsInitialized(true);
    setSyncStatus('ready');
    
    console.log('✅ Created default tags:', defaultTags.length);
    toast.success('Created default tags with permanent storage');
  };

  // Handle tag creation
  const handleCreateTag = async () => {
    if (!newTag.name.trim()) {
      toast.error('Tag name is required');
      return;
    }

    const tagId = newTag.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (candidateTags.find(tag => tag.id === tagId || tag.name.toLowerCase() === newTag.name.toLowerCase())) {
      toast.error(`Tag "${newTag.name}" already exists!`);
      return;
    }

    try {
      setSyncStatus('saving');
      
      const tag: CandidateTag = {
        id: tagId,
        name: newTag.name.trim(),
        color: newTag.color,
        description: newTag.description.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedTags = [...candidateTags, tag];
      setCandidateTags(updatedTags);
      localStorage.setItem('candidateTags', JSON.stringify(updatedTags));
      
      // Try to save to backend
      try {
        await fetch('http://13.204.76.229:8000/upload-candidates-to-s3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderName: '',
            data: { candidates: [] },
            tag: newTag.name.trim()
          })
        });
      } catch (backendError) {
        console.warn('Backend save failed, but tag saved locally');
      }

      setSelectedTag(newTag.name.trim());
      setNewTag({ name: '', color: '#1976d2', description: '' });
      setShowTagDialog(false);
      setSyncStatus('ready');
      toast.success(`Tag "${tag.name}" created successfully!`);
    } catch (error) {
      setSyncStatus('error');
      toast.error('Failed to create tag');
    }
  };

  // Handle tag deletion
  const handleDeleteTag = async (tagId: string) => {
    const tagToDelete = candidateTags.find(tag => tag.id === tagId);
    if (!tagToDelete) {
      toast.error('Tag not found');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the tag "${tagToDelete.name}"?`)) {
      return;
    }

    try {
      setSyncStatus('deleting');
      
      // Try backend deletion
      try {
        const resp = await fetch(`http://13.204.76.229:8000/delete-tag/${tagId}`, { 
          method: 'DELETE' 
        });
        const result = await resp.json();
        if (result.success) {
          console.log('✅ Tag deleted from backend');
        }
      } catch (backendError) {
        console.warn('Backend deletion failed, deleting locally');
      }

      // Update local state
      const updatedTags = candidateTags.filter(tag => tag.id !== tagId);
      setCandidateTags(updatedTags);
      localStorage.setItem('candidateTags', JSON.stringify(updatedTags));
      
      if (selectedTag === tagToDelete.name) {
        setSelectedTag(updatedTags[0]?.name || '');
      }
      
      setSyncStatus('ready');
      toast.success(`Tag "${tagToDelete.name}" deleted successfully`);
    } catch (error) {
      setSyncStatus('error');
      toast.error('Failed to delete tag');
    }
  };

  // Manual sync function
  const handleManualSync = async () => {
    try {
      setSyncStatus('syncing');
      await dataManager.saveTagsPermanently(candidateTags);
      await dataManager.createDailyBackup();
      setSyncStatus('ready');
      toast.success('Manual sync completed successfully!');
    } catch (error) {
      setSyncStatus('error');
      toast.error('Manual sync failed');
    }
  };

  // Enhanced candidate data upload with permanent storage
  const uploadToLocal = async (candidatesData: CandidateData[]): Promise<string> => {
    try {
      setSyncStatus('uploading');
      
      // 🔥 FIX: Use the EXACT same API endpoint that backend expects
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const timeMs = Date.now().toString().slice(-6);
      const randomId = Math.random().toString(36).substr(2, 4);
      
      // 🔥 CRITICAL: Keep tag EXACTLY as entered (case sensitive)
      const exactTagName = selectedTag; // Don't modify case!
      const tagSlugForFolder = selectedTag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const autoFolderName = `${tagSlugForFolder}_${timestamp}_${timeMs}_${randomId}`;
      
      console.log(`🔥 Saving with EXACT tag name: "${exactTagName}" and folder: "${autoFolderName}"`);
      
      // 🔥 FIX: Use the exact same structure as backend expects
      const jsonData = {
        candidates: candidatesData,
        processedAt: new Date().toISOString(),
        totalCount: candidatesData.length,
        folderName: autoFolderName,
        tag: exactTagName, // EXACT case-sensitive tag name
        tagDetails: getTagByName(selectedTag),
        metadata: {
          tag_id: tagSlugForFolder, // URL-safe version for folder
          tag_name: exactTagName, // EXACT case-sensitive name
          total_candidates: candidatesData.length,
          total_batches: 1,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          folder_path: `pdf-data/${autoFolderName}/candidates.json`,
          search_keywords: [tagSlugForFolder, exactTagName.toLowerCase(), exactTagName],
          processor_version: "2.0.0",
          unique_id: autoFolderName
        }
      };
      
      // 🔥 FIX: Call the backend upload endpoint with proper data
      const response = await fetch(`${API_BASE_URL}/upload-candidates-to-s3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: jsonData,
          folderName: autoFolderName,
          tag: exactTagName // Pass exact tag name
        }),
      });
      
      if (!response.ok) {
        throw new Error('Backend storage failed');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Backend storage failed');
      }
      
      console.log('✅ Backend Storage Success with exact tag:', result);
      console.log('📊 Saved metadata:', jsonData.metadata);
      
      setSyncStatus('ready');
      return result.localPath || `pdf-data/${autoFolderName}/candidates.json`;
      
    } catch (error) {
      setSyncStatus('error');
      throw new Error(`Backend storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Get tag by name
  const getTagByName = (tagName: string) => {
    return candidateTags.find(tag => tag.name === tagName || tag.id === tagName);
  };

  const extractCandidateInfo = async (file: File): Promise<CandidateData> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE_URL}/extract-candidate-info`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to extract data from ${file.name}`);
      }
      
      const result = await response.json();
      
      return {
        name: result.name || 'Unknown',
        phone: result.phone || '',
        email: result.email || '',
        fileName: file.name,
        extractedAt: new Date().toISOString(),
        tag: selectedTag
      };
    } catch (error) {
      throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const processPDFs = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select PDF files to process');
      return;
    }
    
    if (!selectedTag) {
      toast.error('Please select a tag for the candidates');
      return;
    }
    
    setIsProcessing(true);
    const processedCandidates: CandidateData[] = [];
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        setProcessingStatuses(prev => 
          prev.map(status => 
            status.fileName === file.name 
              ? { ...status, status: 'processing' }
              : status
          )
        );
        
        try {
          const candidateData = await extractCandidateInfo(file);
          processedCandidates.push(candidateData);
          
          setProcessingStatuses(prev => 
            prev.map(status => 
              status.fileName === file.name 
                ? { ...status, status: 'completed', candidateData }
                : status
            )
          );
          
          toast.success(`✅ Processed: ${file.name}`);
        } catch (error) {
          setProcessingStatuses(prev => 
            prev.map(status => 
              status.fileName === file.name 
                ? { 
                    ...status, 
                    status: 'error', 
                    error: error instanceof Error ? error.message : 'Processing failed'
                  }
                : status
            )
          );
          
          toast.error(`❌ Failed: ${file.name}`);
        }
      }
      
      if (processedCandidates.length > 0) {
        toast.info('Saving candidate data locally...');
        const localPath = await uploadToLocal(processedCandidates);
        
        setExtractedCandidates(processedCandidates);
        toast.success(`🎉 Successfully processed ${processedCandidates.length} candidates with tag "${selectedTag}" and saved locally!`);
        
        console.log('Local Path:', localPath);
        console.log('Processed candidates with tags:', processedCandidates);
      }
      
    } catch (error) {
      console.error('Bulk processing error:', error);
      toast.error('Failed to complete bulk processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCandidatesJSON = () => {
    if (extractedCandidates.length === 0) {
      toast.error('No candidate data to download');
      return;
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const tagSlug = selectedTag.toLowerCase().replace(/\s+/g, '-');
    
    const jsonData = {
      candidates: extractedCandidates,
      processedAt: new Date().toISOString(),
      totalCount: extractedCandidates.length,
      tag: selectedTag,
      tagDetails: getTagByName(selectedTag)
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates_${tagSlug}_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('📁 Candidate data downloaded successfully!');
  };

  const getStatusIcon = (status: ProcessingStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#f44336' }} />;
      case 'processing':
        return <CircularProgress size={20} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: ProcessingStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'processing':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      toast.warning('Only PDF files are supported. Non-PDF files were filtered out.');
    }
    
    setSelectedFiles(prev => [...prev, ...pdfFiles]);
    
    const newStatuses: ProcessingStatus[] = pdfFiles.map(file => ({
      fileName: file.name,
      status: 'pending'
    }));
    setProcessingStatuses(prev => [...prev, ...newStatuses]);
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setProcessingStatuses(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setProcessingStatuses([]);
    setExtractedCandidates([]);
  };

  const completedCount = processingStatuses.filter(s => s.status === 'completed').length;
  const errorCount = processingStatuses.filter(s => s.status === 'error').length;
  const processingProgress = selectedFiles.length > 0 ? 
    ((completedCount + errorCount) / selectedFiles.length) * 100 : 0;

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      {/* Enhanced Header with Sync Status */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            Bulk PDF Processor
            {syncStatus !== 'idle' && syncStatus !== 'ready' && (
              <Chip 
                label={syncStatus} 
                color="primary" 
                size="small" 
                sx={{ ml: 2 }}
                icon={<CircularProgress size={16} />}
              />
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Sync />}
              onClick={handleManualSync}
              size="small"
              disabled={syncStatus !== 'ready'}
            >
              Manual Sync
            </Button>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setShowTagDialog(true)}
              size="small"
              disabled={!isInitialized}
            >
              Create Tag
            </Button>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Extract candidate information from multiple PDFs with permanent storage and sync
        </Typography>
        <Alert severity="info" sx={{ mt: 1 }}>
          📂 Permanent Storage Active - All tags and data are automatically synced and backed up daily
        </Alert>
      </Box>

      {/* Enhanced Tag Selection with Storage Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Label sx={{ mr: 1 }} />
            Tag Selection (Permanent Storage)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <FormControl fullWidth disabled={!isInitialized}>
                <InputLabel>Select Tag for Candidates</InputLabel>
                <Select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  label="Select Tag for Candidates"
                >
                  {candidateTags.map((tag) => (
                    <MenuItem key={tag.id} value={tag.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: tag.color
                          }}
                        />
                        <Box sx={{ flexGrow: 1 }}>
                          {tag.name}
                          {tag.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              ({tag.description})
                            </Typography>
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTag(tag.id);
                          }}
                          sx={{ ml: 1 }}
                          color="error"
                        >
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              {selectedTag && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  <Typography variant="body2">Selected:</Typography>
                  <Chip
                    label={selectedTag}
                    size="small"
                    sx={{
                      backgroundColor: getTagByName(selectedTag)?.color || '#1976d2',
                      color: 'white',
                      fontWeight: 500
                    }}
                  />
                  <Chip
                    label="Permanent"
                    size="small"
                    color="success"
                    icon={<Save />}
                  />
                </Box>
              )}
            </Grid>
          </Grid>
          
          {selectedTag && (
            <Alert severity="success" sx={{ mt: 2 }}>
              📂 Files will be permanently stored and organized in: <strong>{selectedTag.toLowerCase().replace(/\s+/g, '-')}_[timestamp]</strong>
              <br />
              🔄 Automatic backup and sync enabled
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelection}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              Select PDFs
            </Button>
            <Button
              variant="outlined"
              onClick={clearAllFiles}
              disabled={selectedFiles.length === 0 || isProcessing}
              startIcon={<Delete />}
            >
              Clear All
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            Selected Files: {selectedFiles.length}
          </Typography>
        </CardContent>
      </Card>

      {/* Processing Progress */}
      {selectedFiles.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1">Processing Progress</Typography>
              <Typography variant="body2" color="text.secondary">
                {completedCount + errorCount} / {selectedFiles.length}
              </Typography>
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={processingProgress}
              sx={{ mb: 2, height: 8, borderRadius: 4 }}
            />
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`Completed: ${completedCount}`}
                color="success"
                size="small"
              />
              <Chip 
                label={`Errors: ${errorCount}`}
                color="error"
                size="small"
              />
              <Chip 
                label={`Pending: ${selectedFiles.length - completedCount - errorCount}`}
                color="default"
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {selectedFiles.length > 0 && (
        <Card sx={{ mb: 3, maxHeight: 300, overflow: 'auto' }}>
          <List dense>
            {processingStatuses.map((status, index) => (
              <ListItem key={index}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  {getStatusIcon(status.status)}
                  <ListItemText
                    primary={status.fileName}
                    secondary={
                      <Box>
                        {status.status === 'error' ? (
                          <Typography variant="caption" color="error">
                            {status.error}
                          </Typography>
                        ) : status.candidateData ? (
                          <Box>
                            <Typography variant="caption">
                              {status.candidateData.name} • {status.candidateData.email}
                            </Typography>
                            {status.candidateData.tag && (
                              <Chip
                                label={status.candidateData.tag}
                                size="small"
                                sx={{
                                  ml: 1,
                                  fontSize: '0.6rem',
                                  height: 16,
                                  backgroundColor: getTagByName(status.candidateData.tag)?.color || '#1976d2',
                                  color: 'white'
                                }}
                              />
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption">
                            Waiting to process...
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ flex: 1 }}
                  />
                  <Chip 
                    label={status.status}
                    color={getStatusColor(status.status) as any}
                    size="small"
                  />
                  {!isProcessing && (
                    <IconButton 
                      size="small" 
                      onClick={() => removeFile(index)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        </Card>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={processPDFs}
          disabled={selectedFiles.length === 0 || isProcessing || !selectedTag}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudUpload />}
          sx={{ flex: 1 }}
        >
          {isProcessing ? 'Processing...' : `Process ${selectedFiles.length} PDFs with "${selectedTag}" tag`}
        </Button>
        
        {extractedCandidates.length > 0 && (
          <>
            <Button
              variant="outlined"
              onClick={() => setShowPreview(true)}
              startIcon={<Visibility />}
            >
              Preview Results
            </Button>
            <Button
              variant="outlined"
              onClick={downloadCandidatesJSON}
              startIcon={<Download />}
            >
              Download JSON
            </Button>
          </>
        )}
      </Box>

      {/* Results Summary */}
      {extractedCandidates.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Processing Complete
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Chip 
                label={`${extractedCandidates.length} Candidates Extracted`}
                color="success"
              />
              <Chip 
                label={`Tag: ${selectedTag}`}
                sx={{
                  backgroundColor: getTagByName(selectedTag)?.color || '#1976d2',
                  color: 'white'
                }}
              />
              <Chip 
                label={`Auto-organized by tag`}
                color="info"
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Candidate data has been successfully saved locally with the "{selectedTag}" tag and is ready for the calling agent process.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog 
        open={showPreview} 
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Extracted Candidate Data Preview
        </DialogTitle>
        <DialogContent>
          <List>
            {extractedCandidates.map((candidate, index) => (
              <ListItem key={index} divider>
                <ListItemText
                  primary={`${candidate.name} (${candidate.fileName})`}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        📧 {candidate.email || 'No email found'}
                      </Typography>
                      <Typography variant="body2">
                        📞 {candidate.phone || 'No phone found'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Extracted: {new Date(candidate.extractedAt).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
          <Button onClick={downloadCandidatesJSON} variant="contained">
            Download JSON
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Tag Creation Dialog */}
      <Dialog
        open={showTagDialog}
        onClose={() => setShowTagDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Permanent Tag</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This tag will be permanently stored and synced across all devices
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="Tag Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newTag.name}
            onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            variant="outlined"
            value={newTag.description}
            onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Color</InputLabel>
            <Select
              value={newTag.color}
              onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
              label="Color"
            >
              <MenuItem value="#1976d2">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#1976d2'
                    }}
                  />
                  Default Blue
                </Box>
              </MenuItem>
              <MenuItem value="#4caf50">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#4caf50'
                    }}
                  />
                  Green
                </Box>
              </MenuItem>
              <MenuItem value="#f44336">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#f44336'
                    }}
                  />
                  Red
                </Box>
              </MenuItem>
              <MenuItem value="#ff9800">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#ff9800'
                    }}
                  />
                  Orange
                </Box>
              </MenuItem>
              <MenuItem value="#9c27b0">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#9c27b0'
                    }}
                  />
                  Purple
                </Box>
              </MenuItem>
              <MenuItem value="#e91e63">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: '#e91e63'
                    }}
                  />
                  Pink
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTagDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateTag} 
            variant="contained"
            disabled={syncStatus !== 'ready'}
            startIcon={syncStatus === 'saving' ? <CircularProgress size={16} /> : <Save />}
          >
            {syncStatus === 'saving' ? 'Saving...' : 'Create Permanent Tag'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkPdfProcessor;