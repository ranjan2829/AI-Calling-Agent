import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Container,
  Paper,
  IconButton,
  InputAdornment,
  Fade,
  Slide
} from '@mui/material';
import {
  Phone,
  SmartToy,
  Visibility,
  VisibilityOff,
  PersonOutline,
  LockOutlined,
  BusinessCenter,
  TrendingUp,
  Analytics
} from '@mui/icons-material';

const SignIn = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const credentials = {
      email: formData.get('email') as string,
      password: formData.get('password') as string
    };

    try {
      // For now, let's use simple demo authentication
      // Replace this with your actual API call later
      if (credentials.email === 'admin@onelab.com' && credentials.password === 'admin123') {
        localStorage.setItem('token', 'demo-token-' + Date.now());
        console.log('Login successful, navigating to dashboard...');
        navigate('/dashboard');
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError('Invalid credentials. Please use: admin@onelab.com / admin123');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          animation: 'float 6s ease-in-out infinite'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '60%',
          right: '15%',
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          animation: 'float 8s ease-in-out infinite reverse'
        }}
      />

      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '100vh', py: 4 }}>
          
          {/* Left Side - Branding & Features */}
          <Slide direction="right" in={true} timeout={800}>
            <Box sx={{ flex: 1, pr: { md: 6 }, display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ color: 'white', mb: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <SmartToy sx={{ fontSize: 48, mr: 2, color: '#00e676' }} />
                  <Typography variant="h3" sx={{ fontWeight: 'bold', fontSize: '2.5rem' }}>
                    AI Calling Agent
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 4, fontSize: '1.25rem' }}>
                  Onelab Ventures - Intelligent Interview Management System
                </Typography>
                
                {/* Feature Cards */}
                <Stack spacing={3}>
                  <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Phone sx={{ color: '#00e676', mr: 2 }} />
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        AI-Powered Interviews
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      Automated phone interviews with real-time candidate evaluation
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Analytics sx={{ color: '#00e676', mr: 2 }} />
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        Smart Analytics
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      Detailed insights and performance tracking for better hiring decisions
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <TrendingUp sx={{ color: '#00e676', mr: 2 }} />
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        Scalable Solution
                      </Typography>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      Handle multiple interviews simultaneously with consistent quality
                    </Typography>
                  </Paper>
                </Stack>
              </Box>
            </Box>
          </Slide>

          {/* Right Side - Login Form */}
          <Fade in={true} timeout={1000}>
            <Box sx={{ flex: { xs: 1, md: '0 0 450px' } }}>
              <Card 
                elevation={24}
                sx={{ 
                  backdropFilter: 'blur(20px)',
                  bgcolor: 'rgba(255,255,255,0.95)',
                  borderRadius: 4,
                  overflow: 'visible'
                }}
              >
                <CardContent sx={{ p: 5 }}>
                  {/* Header */}
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
                      <BusinessCenter sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
                      <SmartToy sx={{ fontSize: 40, color: 'success.main' }} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
                      Welcome Back
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      Sign in to access your AI interview dashboard
                    </Typography>
                  </Box>

                  {/* Demo Credentials Card */}
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      mb: 3, 
                      bgcolor: 'primary.50', 
                      border: '1px solid',
                      borderColor: 'primary.200',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                      🚀 Demo Credentials
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Email: admin@onelab.com
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Password: admin123
                        </Typography>
                      </Box>
                      <SmartToy sx={{ color: 'primary.main', fontSize: 24 }} />
                    </Box>
                  </Paper>

                  {/* Error Alert */}
                  {error && (
                    <Fade in={true}>
                      <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                        {error}
                      </Alert>
                    </Fade>
                  )}

                  {/* Login Form */}
                  <form onSubmit={handleSubmit}>
                    <Stack spacing={3}>
                      <TextField
                        fullWidth
                        name="email"
                        type="email"
                        label="Email Address"
                        defaultValue="admin@onelab.com"
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonOutline sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover': {
                              '& > fieldset': { borderColor: 'primary.main' }
                            }
                          }
                        }}
                      />

                      <TextField
                        fullWidth
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        label="Password"
                        defaultValue="admin123"
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockOutlined sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                                size="small"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover': {
                              '& > fieldset': { borderColor: 'primary.main' }
                            }
                          }
                        }}
                      />

                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{
                          py: 1.5,
                          borderRadius: 2,
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #1976D2 30%, #1CB5E0 90%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 20px rgba(33, 150, 243, 0.3)'
                          },
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {loading ? (
                          <>
                            <CircularProgress size={24} sx={{ mr: 1, color: 'white' }} />
                            Signing In...
                          </>
                        ) : (
                          'Sign In to Dashboard'
                        )}
                      </Button>
                    </Stack>
                  </form>

                  <Divider sx={{ my: 3 }} />

                  {/* Footer */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Powered by AI Technology • Secure & Encrypted
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Fade>
        </Box>
      </Container>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
        `}
      </style>
    </Box>
  );
};

export default SignIn;