import React, { useState, useRef } from 'react';
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
  DialogActions
} from '@mui/material';
import {
  Upload,
  Delete,
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Visibility,
  Download,
  FolderOpen
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface CandidateData {
  name: string;
  phone: string;
  email: string;
  fileName: string;
  extractedAt: string;
}

interface ProcessingStatus {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  candidateData?: CandidateData;
}

const API_BASE_URL = 'http://13.204.76.229:8000';
const S3_BUCKET_URL = 's3://calling-agent-ai/pdf-data/';

const BulkPdfProcessor: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingStatuses, setProcessingStatuses] = useState<ProcessingStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCandidates, setExtractedCandidates] = useState<CandidateData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [s3FolderName, setS3FolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      return {
        name: result.name || 'Unknown',
        phone: result.phone || '',
        email: result.email || '',
        fileName: file.name,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const uploadToS3 = async (candidatesData: CandidateData[], folderName: string): Promise<string> => {
    try {
      const jsonData = {
        candidates: candidatesData,
        processedAt: new Date().toISOString(),
        totalCount: candidatesData.length,
        folderName: folderName
      };
      
      const response = await fetch(`${API_BASE_URL}/upload-candidates-to-s3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: jsonData,
          folderName: folderName
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload to S3');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'S3 upload failed');
      }
      
      console.log('✅ S3 Upload Success:', result);
      
      return result.s3Url || `s3://calling-agent-ai/pdf-data/${folderName}/candidates.json`;
    } catch (error) {
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const processPDFs = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select PDF files to process');
      return;
    }
    
    if (!s3FolderName.trim()) {
      toast.error('Please enter a folder name for S3 storage');
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
        // Upload to S3
        toast.info('Uploading candidate data to S3...');
        const s3Url = await uploadToS3(processedCandidates, s3FolderName);
        
        setExtractedCandidates(processedCandidates);
        toast.success(`🎉 Successfully processed ${processedCandidates.length} candidates and uploaded to S3!`);
        
        console.log('S3 URL:', s3Url);
        console.log('Processed candidates:', processedCandidates);
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
    
    const jsonData = {
      candidates: extractedCandidates,
      processedAt: new Date().toISOString(),
      totalCount: extractedCandidates.length,
      folderName: s3FolderName
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates_${s3FolderName}_${new Date().toISOString().split('T')[0]}.json`;
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

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1 }}>
          Bulk PDF Processor
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Extract candidate information from multiple PDFs and store in S3
        </Typography>
      </Box>

      {/* S3 Folder Name Input */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="S3 Folder Name"
            value={s3FolderName}
            onChange={(e) => setS3FolderName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
            placeholder="e.g., batch-2024-01"
            helperText="Enter a folder name for organizing candidates in S3"
            InputProps={{
              startAdornment: <FolderOpen sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
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
                      status.status === 'error' ? status.error :
                      status.candidateData ? 
                        `${status.candidateData.name} • ${status.candidateData.email}` :
                        'Waiting to process...'
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
          disabled={selectedFiles.length === 0 || isProcessing || !s3FolderName.trim()}
          startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudUpload />}
          sx={{ flex: 1 }}
        >
          {isProcessing ? 'Processing...' : `Process ${selectedFiles.length} PDFs`}
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
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip 
                label={`${extractedCandidates.length} Candidates Extracted`}
                color="success"
              />
              <Chip 
                label={`Stored in: ${S3_BUCKET_URL}${s3FolderName}/`}
                color="info"
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Candidate data has been successfully uploaded to S3 and is ready for the calling agent process.
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
    </Box>
  );
};

export default BulkPdfProcessor;