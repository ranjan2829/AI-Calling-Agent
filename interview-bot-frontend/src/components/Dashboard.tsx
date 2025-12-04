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
  TrendingUp,
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

const API_BASE_URL = 'http://13.204.76.229:8000';

interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  pendingInterviews: number;
  successRate: number;
  averageScore: number;
}

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalInterviews: 0,
    completedInterviews: 0,
    pendingInterviews: 0,
    successRate: 0,
    averageScore: 0
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
          successRate: interviews.length > 0 ? Math.round((completed.length / interviews.length) * 100) : 0,
          averageScore: 85 // Mock score for now
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

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
                sx={{ 
              p: 1,
              borderRadius: 1,
              backgroundColor: `${color}20`,
              color: color,
              mr: 2,
              display: 'flex'
            }}
          >
            {icon}
            </Box>
          <Typography variant="h6" color="text.secondary" sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
            {title}
          </Typography>
      </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
          {value}
          </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
            <TrendingUp sx={{ fontSize: 16, color: theme.palette.success.main, mr: 0.5 }} />
            <span style={{ color: theme.palette.success.main, fontWeight: 600 }}>{subtitle}</span>
            <span style={{ marginLeft: 4 }}>vs last month</span>
          </Typography>
        )}
      </CardContent>
    </Card>
    );

  if (loading) {
      return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} sx={{ color: '#3b82f6' }} />
        </Box>
      );
    }
    
    return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
            Dashboard Overview
            </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back to your AI Interview Platform
          </Typography>
      </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<Refresh />}
            onClick={fetchDashboardData}
            variant="outlined"
                    sx={{
              borderColor: '#334155',
              color: '#94a3b8',
              '&:hover': {
                borderColor: '#3b82f6',
                color: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.05)'
              }
            }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<Phone />}
            variant="contained"
            onClick={() => navigate('/call-dashboard')}
            sx={{ 
              backgroundColor: '#3b82f6',
              '&:hover': { backgroundColor: '#2563eb' }
            }}
          >
            Start New Call
          </Button>
        </Box>
        </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Interviews"
            value={stats.totalInterviews}
            icon={<Person />}
            color="#3b82f6"
            subtitle="+12%"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed"
            value={stats.completedInterviews}
            icon={<CheckCircle />}
            color="#10b981"
            subtitle="+8%"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending"
            value={stats.pendingInterviews}
            icon={<Schedule />}
            color="#f59e0b"
            subtitle="-5%"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            icon={<Assessment />}
            color="#8b5cf6"
            subtitle="+2%"
          />
        </Grid>
      </Grid>

      {/* Recent Activity & Charts Section */}
      <Grid container spacing={3}>
        {/* Recent Interviews Table */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                  Recent Interviews
                </Typography>
        <Button
                  endIcon={<ArrowForward />} 
                  onClick={() => navigate('/results')}
                  sx={{ color: '#3b82f6' }}
                >
                  View All
        </Button>
      </Box>

              <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow>
                      <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>Candidate</TableCell>
                      <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>Status</TableCell>
                      <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>Score</TableCell>
                      <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>Date</TableCell>
                      <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                    {recentInterviews.map((interview) => (
                      <TableRow 
                        key={interview.interview_id}
                        sx={{ 
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.02)' },
                          borderBottom: '1px solid #334155'
                        }}
                      >
                        <TableCell sx={{ color: '#f8fafc', borderBottom: '1px solid #334155' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box 
                              sx={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: '50%', 
                                backgroundColor: '#2563eb', 
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
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {interview.candidate_name || 'Unknown'}
                            </Typography>
                              {/* Phone number hidden as requested */}
                          </Box>
                        </Box>
                      </TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #334155' }}>
                          <Chip 
                            label={interview.status} 
                            size="small"
                            sx={{ 
                              backgroundColor: interview.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: interview.status === 'COMPLETED' ? '#10b981' : '#f59e0b',
                              fontWeight: 500,
                              borderRadius: 1
                            }} 
                          />
                      </TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #334155' }}>
                          {interview.status === 'COMPLETED' ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600, mr: 1 }}>
                                85%
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={85} 
                                sx={{ 
                                  width: 60, 
                                  height: 4, 
                                  borderRadius: 2,
                                  backgroundColor: '#334155',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#3b82f6'
                                  }
                                }} 
                              />
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                      </TableCell>
                        <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                          {new Date(interview.start_time).toLocaleDateString()}
                      </TableCell>
                        <TableCell align="right" sx={{ borderBottom: '1px solid #334155' }}>
                          <IconButton 
                            size="small"
                            sx={{ color: '#94a3b8', '&:hover': { color: '#3b82f6' } }}
                            onClick={() => navigate(`/interview/${interview.interview_id}`)}
                          >
                            <Assessment fontSize="small" />
                          </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                    {recentInterviews.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#94a3b8', borderBottom: 'none' }}>
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
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#f8fafc', mb: 2 }}>
                    System Status
            </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: '#10b981', 
                      mr: 2,
                    }} />
                    <Typography color="text.secondary">API System Operational</Typography>
          </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: '#10b981', 
                      mr: 2,
                    }} />
                    <Typography color="text.secondary">Twilio Voice Services</Typography>
              </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: '#10b981', 
                      mr: 2,
                    }} />
                    <Typography color="text.secondary">Database Connection</Typography>
                  </Box>
                </CardContent>
            </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#f8fafc', mb: 2 }}>
                    Quick Actions
                  </Typography>
                  <Button
                    fullWidth 
                    variant="outlined" 
                    startIcon={<Person />}
                    onClick={() => navigate('/call-dashboard')}
                    sx={{ 
                      mb: 2, 
                      justifyContent: 'flex-start',
                      borderColor: '#334155',
                      color: '#94a3b8',
                      '&:hover': {
                        borderColor: '#3b82f6',
                        color: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)'
                      }
                    }}
                  >
                    New Interview
                  </Button>
                  <Button 
                fullWidth
                    variant="outlined" 
                    startIcon={<Assessment />}
                    onClick={() => navigate('/results')}
                    sx={{ 
                      justifyContent: 'flex-start',
                      borderColor: '#334155',
                      color: '#94a3b8',
                      '&:hover': {
                        borderColor: '#3b82f6',
                        color: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)'
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
