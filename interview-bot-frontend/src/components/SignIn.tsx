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
  Fade,
  useTheme
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
  const theme = useTheme();

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
      // Demo authentication
      if (credentials.email === 'admin@example.com' && credentials.password === 'admin123') {
        // Set token and user data
        localStorage.setItem('token', 'demo-token-' + Date.now());
        localStorage.setItem('user', JSON.stringify({
          email: credentials.email,
          name: 'Admin User',
          role: 'admin'
        }));
        
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
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box 
        sx={{ 
          width: '100%',
          maxWidth: '400px',
          px: 2,
        }}
      >
        <Fade in={true} timeout={800}>
          <Card 
            elevation={0}
            sx={{ 
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              backgroundColor: 'rgba(17, 17, 17, 0.7)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#f5f5f5', 
                    mb: 0.5,
                    fontSize: '1.5rem',
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#a3a3a3',
                    fontSize: '0.8125rem',
                  }}
                >
                  Sign in to AI Interview Platform
                </Typography>
              </Box>

              {/* Error Alert */}
              {error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2, 
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    backdropFilter: 'blur(10px)',
                    fontSize: '0.8125rem',
                    '& .MuiAlert-icon': { color: '#ef4444' }
                  }}
                >
                  {error}
                </Alert>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
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
                          <PersonOutline sx={{ color: '#a3a3a3' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(26, 26, 26, 0.5)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 1.5,
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                        '&:hover fieldset': { borderColor: '#6366f1' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                      },
                      '& .MuiInputLabel-root': { color: '#a3a3a3', fontSize: '0.875rem' },
                      '& .MuiOutlinedInput-input': { color: '#f5f5f5', py: 1.25, fontSize: '0.875rem' }
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
                          <LockOutlined sx={{ color: '#a3a3a3' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            sx={{ color: '#a3a3a3' }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(26, 26, 26, 0.5)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 1.5,
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                        '&:hover fieldset': { borderColor: '#6366f1' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                      },
                      '& .MuiInputLabel-root': { color: '#a3a3a3', fontSize: '0.875rem' },
                      '& .MuiOutlinedInput-input': { color: '#f5f5f5', py: 1.25, fontSize: '0.875rem' }
                    }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                      py: 1.25,
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: '0.01em',
                      backgroundColor: '#6366f1',
                      borderRadius: 1.5,
                      '&:hover': { backgroundColor: '#4f46e5' },
                      '&:disabled': { backgroundColor: 'rgba(64, 64, 64, 0.5)', color: '#525252' }
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
            </CardContent>
          </Card>
        </Fade>
      </Box>
    </Box>
  );
};

export default SignIn;
