import { useState, useEffect } from 'react';
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
  Stack,
  IconButton,
  InputAdornment,
  Fade
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonOutline,
  LockOutlined
} from '@mui/icons-material';

const SignIn = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('User already logged in, redirecting...');
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

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
      console.log('Attempting login with:', credentials.email);
      
      // Demo authentication
      if (credentials.email === 'admin@onelab.com' && credentials.password === 'admin123') {
        console.log('Login successful, setting token...');
        
        // Set token and user data
        localStorage.setItem('token', 'demo-token-' + Date.now());
        localStorage.setItem('user', JSON.stringify({
          email: credentials.email,
          name: 'Admin User',
          role: 'admin'
        }));
        
        console.log('Token set, navigating to dashboard...');
        
        // Navigate to dashboard
        navigate('/dashboard', { replace: true });
        
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc !important',
        color: '#1e293b !important',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Top Color Bar */}
      <Box
        sx={{
          height: '4px',
          background: 'linear-gradient(90deg, #2F8D8C 0%, #319492 50%, #17A2B8 100%)',
          width: '100%'
        }}
      />

      {/* Main Content */}
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          px: 2,
          py: 4 
        }}
      >
        <Fade in={true} timeout={800}>
          <Card 
            className="login-card"
            elevation={0}
            sx={{ 
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              background: 'white !important',
              color: '#1e293b !important',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              width: '400px !important',
              maxWidth: '400px !important',
              minWidth: 'auto !important'
            }}
          >
            <CardContent sx={{ p: 4 }}>
              {/* Logo and Header */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                {/* Onelab Logo */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <Box
                    component="img"
                    src="/dashboard-logo.svg"
                    alt="Onelab Ventures Logo"
                    sx={{
                      height: '50px',
                      width: 'auto'
                    }}
                  />
                </Box>
                
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: '#1e293b !important', 
                    mb: 1,
                    fontSize: '1.5rem'
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: '#64748b !important',
                    fontSize: '0.9rem'
                  }}
                >
                  Sign in to your account
                </Typography>
              </Box>

              {/* Error Alert */}
              {error && (
                <Fade in={true}>
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 3, 
                      borderRadius: 2,
                      border: '1px solid #fecaca',
                      backgroundColor: '#fef2f2 !important',
                      color: '#dc2626 !important'
                    }}
                  >
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
                    required
                    autoComplete="email"
                    autoFocus
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutline sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white !important',
                        color: '#1e293b !important',
                        '& fieldset': {
                          borderColor: '#e2e8f0',
                        },
                        '&:hover fieldset': {
                          borderColor: '#2F8D8C',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#2F8D8C',
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: '#64748b !important',
                        '&.Mui-focused': {
                          color: '#2F8D8C !important',
                        }
                      },
                      '& .MuiOutlinedInput-input': {
                        color: '#1e293b !important'
                      }
                    }}
                  />

                  <TextField
                    fullWidth
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    required
                    autoComplete="current-password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            aria-label="toggle password visibility"
                            sx={{ color: '#64748b !important' }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white !important',
                        color: '#1e293b !important',
                        '& fieldset': {
                          borderColor: '#e2e8f0',
                        },
                        '&:hover fieldset': {
                          borderColor: '#2F8D8C',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#2F8D8C',
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: '#64748b !important',
                        '&.Mui-focused': {
                          color: '#2F8D8C !important',
                        }
                      },
                      '& .MuiOutlinedInput-input': {
                        color: '#1e293b !important'
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
                      fontSize: '1rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      background: 'linear-gradient(135deg, #2F8D8C 0%, #319492 100%) !important',
                      color: 'white !important',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #256B6A 0%, #2A7D7B 100%) !important',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 24px rgba(47, 141, 140, 0.3)'
                      },
                      '&:disabled': {
                        background: '#94a3b8 !important',
                        color: 'white !important',
                        transform: 'none',
                        boxShadow: 'none'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </Stack>
              </form>

              {/* Footer */}
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#94a3b8 !important',
                    fontSize: '0.75rem'
                  }}
                >
                  Powered by Onelab Ventures
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Box>
    </Box>
  );
};

export default SignIn;