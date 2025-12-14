import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  useTheme,
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
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Person,
  CheckCircle,
  Schedule,
  ArrowForward,
  Refresh,
  Phone,
  Assessment
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/services';

interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  pendingInterviews: number;
  successRate: number;
}

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalInterviews: 0,
    completedInterviews: 0,
    pendingInterviews: 0,
    successRate: 0
  });
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/interviews-detailed`);
      const data = await response.json();

      if (data.success) {
        const interviews = data.interviews || [];
        const completed = interviews.filter((i: any) => i.status === 'COMPLETED');
        
        setStats({
          totalInterviews: interviews.length,
          completedInterviews: completed.length,
          pendingInterviews: interviews.length - completed.length,
          successRate: interviews.length > 0 ? Math.round((completed.length / interviews.length) * 100) : 0
        });
        
        setRecentInterviews(interviews.slice(0, 5));
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const StatCard = ({ title, value, icon, color }: any) => (
    <Card sx={{ 
      height: '100%', 
      border: '1px solid rgba(255, 255, 255, 0.1)', 
      backgroundColor: 'rgba(17, 17, 17, 0.7)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box
            sx={{ 
              p: 0.75,
              color: '#6366f1',
              mr: 1,
              display: 'flex',
              borderRadius: 1.5,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#f5f5f5', fontSize: '1.5rem' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} sx={{ color: '#6366f1' }} />
      </Box>
    );
  }
    
    return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#f5f5f5', mb: 0.25, fontSize: '1.125rem' }}>
            Dashboard Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            Welcome back to your AI Interview Platform
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            startIcon={<Refresh />}
            onClick={fetchDashboardData}
            variant="outlined"
            size="small"
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#f5f5f5',
              py: 0.75,
              px: 1.5,
              '&:hover': {
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)'
              }
            }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<Phone />}
            variant="contained"
            size="small"
            onClick={() => navigate('/call-dashboard')}
            sx={{ 
              backgroundColor: '#6366f1',
              color: '#ffffff',
              py: 0.75,
              px: 1.5,
              '&:hover': { backgroundColor: '#4f46e5' }
            }}
          >
            Start New Call
          </Button>
        </Box>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Interviews"
            value={stats.totalInterviews}
            icon={<Person />}
            color="#000000"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed"
            value={stats.completedInterviews}
            icon={<CheckCircle />}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending"
            value={stats.pendingInterviews}
            icon={<Schedule />}
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            icon={<Assessment />}
            color="#000000"
          />
        </Grid>
      </Grid>

      {/* Recent Activity & Charts Section */}
      <Grid container spacing={3}>
        {/* Recent Interviews Table */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ 
            height: '100%', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            backgroundColor: 'rgba(17, 17, 17, 0.7)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#f5f5f5', fontSize: '1rem' }}>
                  Recent Interviews
                </Typography>
                <Button
                  endIcon={<ArrowForward />} 
                  onClick={() => navigate('/results')}
                  size="small"
                  sx={{ color: '#6366f1', fontSize: '0.8125rem', '&:hover': { color: '#818cf8' } }}
                >
                  View All
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}>Candidate</TableCell>
                      <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}>Status</TableCell>
                      <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}>Score</TableCell>
                      <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem', py: 0.75 }}>Date</TableCell>
                      <TableCell sx={{ color: '#a3a3a3', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.8125rem', py: 1 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentInterviews.map((interview) => (
                      <TableRow 
                        key={interview.interview_id}
                        sx={{ 
                          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <TableCell sx={{ color: '#f5f5f5', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', py: 1, fontSize: '0.75rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box 
                              sx={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 2, 
                                backgroundColor: '#6366f1', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                mr: 2,
                                color: '#fff',
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }}
                            >
                              {interview.candidate_name?.charAt(0) || 'C'}
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {interview.candidate_name || 'Unknown'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1, fontSize: '0.75rem' }}>
                          <Chip 
                            label={interview.status} 
                            size="small"
                            sx={{ 
                              backgroundColor: interview.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: interview.status === 'COMPLETED' ? '#10b981' : '#f59e0b',
                              fontWeight: 600,
                              borderRadius: 1.5,
                              height: 20,
                              fontSize: '0.7rem',
                              border: `1px solid ${interview.status === 'COMPLETED' ? '#10b981' : '#f59e0b'}`
                            }} 
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1, fontSize: '0.75rem' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>-</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#a3a3a3', py: 1.5, fontSize: '0.8125rem' }}>
                          {new Date(interview.start_time).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                          <IconButton 
                            size="small"
                            sx={{ color: '#a3a3a3', '&:hover': { color: '#6366f1' }, p: 0.5 }}
                            onClick={() => navigate(`/interview/${interview.interview_id}`)}
                          >
                            <Assessment fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentInterviews.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 2, color: '#a3a3a3', fontSize: '0.75rem' }}>
                          No recent interviews found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} lg={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                backgroundColor: 'rgba(17, 17, 17, 0.7)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#f5f5f5', mb: 1, fontSize: '0.875rem' }}>
                    System Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      bgcolor: '#10b981', 
                      mr: 1.5,
                    }} />
                    <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>API System Operational</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      bgcolor: '#10b981', 
                      mr: 1.5,
                    }} />
                    <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>Twilio Voice Services</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      bgcolor: '#10b981', 
                      mr: 1.5,
                    }} />
                    <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>Database Connection</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                backgroundColor: 'rgba(17, 17, 17, 0.7)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#f5f5f5', mb: 1, fontSize: '0.875rem' }}>
                    Quick Actions
                  </Typography>
                  <Button
                    fullWidth 
                    variant="outlined" 
                    size="small"
                    startIcon={<Person />}
                    onClick={() => navigate('/call-dashboard')}
                    sx={{ 
                      mb: 1, 
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#f5f5f5',
                      py: 0.5,
                      fontSize: '0.75rem',
                      '&:hover': {
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)'
                      }
                    }}
                  >
                    New Interview
                  </Button>
                  <Button 
                    fullWidth
                    variant="outlined" 
                    size="small"
                    startIcon={<Assessment />}
                    onClick={() => navigate('/results')}
                    sx={{ 
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#f5f5f5',
                      py: 0.5,
                      fontSize: '0.75rem',
                      '&:hover': {
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)'
                      }
                    }}
                  >
                    View Reports
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            </Grid>
            </Grid>
          </Grid>
    </Box>
  );
};

export default Dashboard;
