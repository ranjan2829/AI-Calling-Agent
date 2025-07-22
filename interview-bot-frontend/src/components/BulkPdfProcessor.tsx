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
  Add
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
  tag?: string; // ✅ Add tag field
}

interface ProcessingStatus {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  candidateData?: CandidateData;
}

const API_BASE_URL = 'http://13.204.76.229:8000';

const BulkPdfProcessor: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingStatuses, setProcessingStatuses] = useState<ProcessingStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCandidates, setExtractedCandidates] = useState<CandidateData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Tag related state
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('General');
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#1976d2', description: '' });
  useEffect(() => {
    const savedTags = localStorage.getItem('candidateTags');
    if (savedTags) {
      try {
        const parsedTags = JSON.parse(savedTags);
        if (parsedTags && parsedTags.length > 0) {
          setCandidateTags(parsedTags);
          console.log('✅ BulkPdfProcessor - Loaded existing tags from localStorage:', parsedTags.length);
          return;
        }
      } catch (error) {
        console.error('Error parsing saved tags:', error);
      }
    }

    // Only create default tags if none exist
    console.log('🔧 BulkPdfProcessor - No existing tags found, creating defaults...');
    const defaultTags: CandidateTag[] = [
      {
        id: 'general',
        name: 'General',
        color: '#757575',
        description: 'General candidates',
        createdAt: new Date().toISOString()
      },
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
        description: 'Full stack developers',
        createdAt: new Date().toISOString()
      },
      {
        id: 'devops',
        name: 'DevOps Engineer',
        color: '#9c27b0',
        description: 'DevOps and Infrastructure engineers',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mobile',
        name: 'Mobile Developer',
        color: '#e91e63',
        description: 'iOS, Android, React Native developers',
        createdAt: new Date().toISOString()
      }
    ];
    setCandidateTags(defaultTags);
    localStorage.setItem('candidateTags', JSON.stringify(defaultTags));
    console.log('✅ BulkPdfProcessor - Created default tags:', defaultTags.length);
  }, []);

  // ✅ Handle tag creation - FIXED to prevent duplicates
  const handleCreateTag = () => {
    if (!newTag.name.trim()) {
      toast.error('Tag name is required');
      return;
    }

    // ✅ Check for duplicate tag names or IDs
    const tagId = newTag.name.toLowerCase().replace(/\s+/g, '-');
    const existingTag = candidateTags.find(tag => 
      tag.id === tagId || 
      tag.name.toLowerCase() === newTag.name.toLowerCase()
    );

    if (existingTag) {
      toast.error(`Tag "${newTag.name}" already exists!`);
      return;
    }

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
    
    setNewTag({ name: '', color: '#1976d2', description: '' });
    setShowTagDialog(false);
    toast.success(`Tag "${tag.name}" created successfully!`);
  };

  // ✅ Get tag by name
  const getTagByName = (tagName: string) => {
    return candidateTags.find(tag => tag.name === tagName || tag.id === tagName);
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      toast.warning('Only PDF files are supported. Non-PDF files were filtered out.');
    }
    
    setSelectedFiles(prev => [...prev, ...pdfFiles]);
    
    // Initialize processing statuses
    const newStatuses: ProcessingStatus[] = pdfFiles.map(file => ({
      fileName: file.name,
      status: 'pending'
    }));
    setProcessingStatuses(prev => [...prev, ...newStatuses]);
    
    // Clear the input
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
      
      // ✅ Include tag in candidate data
      return {
        name: result.name || 'Unknown',
        phone: result.phone || '',
        email: result.email || '',
        fileName: file.name,
        extractedAt: new Date().toISOString(),
        tag: selectedTag // ✅ Add selected tag
      };
    } catch (error) {
      throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ✅ Prevent duplicate candidate data uploads
  const uploadToLocal = async (candidatesData: CandidateData[]): Promise<string> => {
    try {
      // ✅ Generate unique folder name to prevent data conflicts
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const timeMs = Date.now().toString().slice(-6);
      const randomId = Math.random().toString(36).substr(2, 4); // Add random component
      const tagSlug = selectedTag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const autoFolderName = `${tagSlug}_${timestamp}_${timeMs}_${randomId}`; // More unique naming
      
      // ✅ Include comprehensive metadata for CallDashboard
      const jsonData = {
        candidates: candidatesData,
        processedAt: new Date().toISOString(),
        totalCount: candidatesData.length,
        folderName: autoFolderName,
        tag: selectedTag,
        tagDetails: getTagByName(selectedTag),
        // ✅ Enhanced metadata for better tag discovery
        metadata: {
          tag_id: tagSlug,
          tag_name: selectedTag,
          total_candidates: candidatesData.length,
          total_batches: 1,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          folder_path: `pdf-data/${autoFolderName}/candidates.json`,
          // ✅ Add search keywords for better matching
          search_keywords: [tagSlug, selectedTag.toLowerCase(), selectedTag],
          processor_version: "1.0.0",
          unique_id: autoFolderName // Add unique identifier
        }
      };
      
      const response = await fetch(`${API_BASE_URL}/upload-candidates-to-s3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: jsonData,
          folderName: autoFolderName,
          tag: selectedTag
        }),
      });
      
      if (!response.ok) {
        throw new Error('Local storage failed');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Local storage failed');
      }
      
      console.log('✅ Local Storage Success:', result);
      console.log('✅ Enhanced Metadata for CallDashboard:', jsonData.metadata);
      
      return result.localPath || `pdf-data/${autoFolderName}/candidates.json`;
    } catch (error) {
      throw new Error(`Local storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        
        // Update status to processing
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
          
          // Update status to completed
          setProcessingStatuses(prev => 
            prev.map(status => 
              status.fileName === file.name 
                ? { ...status, status: 'completed', candidateData }
                : status
            )
          );
          
          toast.success(`✅ Processed: ${file.name}`);
        } catch (error) {
          // Update status to error
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
        // Upload to local storage with auto-generated folder name
        toast.info('Saving candidate data locally...');
        const localPath = await uploadToLocal(processedCandidates); // ✅ No folder name parameter
        
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
    
    // ✅ Auto-generate file name based on tag and timestamp
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
    a.download = `candidates_${tagSlug}_${timestamp}.json`; // ✅ Simplified file name
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

  const completedCount = processingStatuses.filter(s => s.status === 'completed').length;
  const errorCount = processingStatuses.filter(s => s.status === 'error').length;
  const processingProgress = selectedFiles.length > 0 ? 
    ((completedCount + errorCount) / selectedFiles.length) * 100 : 0;

  // ✅ Handle tag deletion with backend cleanup
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
      `• Remove the tag from the system\n` +
      `• Delete all associated candidate data files\n` +
      `• This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      // 1. Delete from backend/server with associated data
      try {
        const deleteResponse = await fetch(`${API_BASE_URL}/delete-tag/${tagId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tagName: tagToDelete.name,
            deleteAssociatedData: true // Flag to delete JSON files too
          }),
        });

        if (deleteResponse.ok) {
          const result = await deleteResponse.json();
          if (result.success) {
            console.log('✅ Tag and data deleted from backend:', result);
            toast.success(`Tag "${tagToDelete.name}" and ${result.deletedFiles || 0} data files deleted`);
          } else {
            console.warn('⚠️ Backend deletion issues:', result.message);
            toast.warning('Tag deleted but some data files may remain on server');
          }
        } else {
          console.warn('⚠️ Backend deletion failed');
          toast.warning('Server deletion failed, deleting locally only');
        }
      } catch (backendError) {
        console.warn('⚠️ Backend not available for deletion:', backendError);
        toast.warning('Server not available, deleting locally only');
      }

      // 2. Remove from localStorage
      const updatedTags = candidateTags.filter(tag => tag.id !== tagId);
      setCandidateTags(updatedTags);
      localStorage.setItem('candidateTags', JSON.stringify(updatedTags));

      // 3. Reset selected tag if it was the deleted one
      if (selectedTag === tagToDelete.name) {
        setSelectedTag(updatedTags.length > 0 ? updatedTags[0].name : '');
      }

      // 4. Clear extracted candidates if they belong to deleted tag
      setExtractedCandidates(prev => 
        prev.filter(candidate => candidate.tag !== tagToDelete.name)
      );

      toast.success(`Tag "${tagToDelete.name}" deleted successfully`);
      
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag completely');
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            Bulk PDF Processor
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setShowTagDialog(true)}
            size="small"
          >
            Create Tag
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Extract candidate information from multiple PDFs and organize with tags
        </Typography>
      </Box>

      {/* ✅ Tag Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Label sx={{ mr: 1 }} />
            Tag Selection
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <FormControl fullWidth>
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
                        {/* ✅ Add delete button for each tag */}
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
                    onDelete={() => {
                      const tag = getTagByName(selectedTag);
                      if (tag) handleDeleteTag(tag.id);
                    }}
                    sx={{
                      backgroundColor: getTagByName(selectedTag)?.color || '#1976d2',
                      color: 'white',
                      fontWeight: 500,
                      '& .MuiChip-deleteIcon': {
                        color: 'white'
                      }
                    }}
                  />
                </Box>
              )}
            </Grid>
          </Grid>
          
          {/* ✅ Auto-folder info */}
          {selectedTag && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Files will be automatically organized in folder: <strong>{selectedTag.toLowerCase().replace(/\s+/g, '-')}_[timestamp]</strong>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ❌ Remove Folder Name Input Section */}
      {/* <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Folder Name"
            value={s3FolderName}
            onChange={(e) => setS3FolderName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
            placeholder="e.g., batch-2024-01"
            helperText="Enter a folder name for organizing candidates"
            InputProps={{
              startAdornment: <FolderOpen sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
        </CardContent>
      </Card> */}

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
                            {/* ✅ Show tag for processed candidates */}
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
          disabled={selectedFiles.length === 0 || isProcessing || !selectedTag} // ✅ Remove folder name validation
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

      {/* Tag Creation Dialog */}
      <Dialog
        open={showTagDialog}
        onClose={() => setShowTagDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Tag</DialogTitle>
        <DialogContent>
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
          <Button onClick={handleCreateTag} variant="contained">
            Create Tag
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkPdfProcessor;