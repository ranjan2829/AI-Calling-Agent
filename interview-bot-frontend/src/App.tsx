import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  CssBaseline,
  useMediaQuery,
  useTheme,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assessment,
  Menu,
  ExitToApp,
  Phone
} from '@mui/icons-material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import components
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';
import { CallDashboard } from './components/CallDashboard';
import { InterviewDetails } from './components/InterviewDetails';
import { InterviewResults } from './components/InterviewResults';

const drawerWidth = 180;

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/signin" replace />;
  }
  
  return <>{children}</>;
};

// Bulk Call Context for state management across tabs
interface BulkCallContextType {
  bulkCallSession: any;
  setBulkCallSession: (session: any) => void;
  isCalling: boolean;
  setIsCalling: (calling: boolean) => void;
  contacts: any[];
  setContacts: (contacts: any[]) => void;
}

const BulkCallContext = createContext<BulkCallContextType | undefined>(undefined);

export const useBulkCall = () => {
  const context = useContext(BulkCallContext);
  if (!context) {
    throw new Error('useBulkCall must be used within BulkCallProvider');
  }
  return context;
};

// Modern Dark Theme - Sharp & Clean
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo accent
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b5cf6', // Purple accent
      light: '#a78bfa',
      dark: '#7c3aed',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0a0a0a', // Deep black
      paper: '#111111',   // Slightly lighter for cards
    },
    text: {
      primary: '#f5f5f5', // Off-white
      secondary: '#a3a3a3', // Medium grey
      disabled: '#525252',
    },
    divider: '#262626', // Subtle divider
    error: {
      main: '#ef4444', // Modern red
    },
    warning: {
      main: '#f59e0b',
    },
    info: {
      main: '#3b82f6',
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: { fontWeight: 700, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, letterSpacing: '-0.015em' },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
  },
  shape: {
    borderRadius: 8, // Modern rounded corners
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(17, 17, 17, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          '&:hover': {
            borderColor: 'rgba(99, 102, 241, 0.3)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 20px',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          },
        },
        contained: {
          backgroundColor: '#6366f1',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#4f46e5',
          },
        },
        outlined: {
          borderColor: '#404040',
          color: '#f5f5f5',
          '&:hover': {
            backgroundColor: '#1a1a1a',
            borderColor: '#6366f1',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(17, 17, 17, 0.7)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(20px)',
          color: '#f5f5f5',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          backgroundColor: '#1a1a1a',
          color: '#f5f5f5',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #262626',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#111111',
          color: '#a3a3a3',
        },
      },
    },
  },
});

const TopProgressBar: React.FC = () => {
  const { bulkCallSession, isCalling } = useBulkCall();

  if (!isCalling || !bulkCallSession) return null;

  const progress = (bulkCallSession.completed_calls / bulkCallSession.total_contacts) * 100;

  return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          backgroundColor: 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(20px)',
          color: '#f5f5f5',
          py: 1,
          px: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Bulk Calling in Progress
          </Typography>
          <Chip
            label={`${bulkCallSession.completed_calls}/${bulkCallSession.total_contacts}`}
            size="small"
            sx={{ 
              backgroundColor: '#1a1a1a',
              color: '#6366f1',
              fontWeight: 600,
              border: '1px solid #404040',
            }}
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 4,
            backgroundColor: '#1a1a1a',
            borderRadius: 2,
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#6366f1',
            },
          }}
        />
      </Box>
  );
};

const Sidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/signin';
  };

  const menuItems = [
    { text: 'Main Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Call Dashboard', icon: <Phone />, path: '/call-dashboard' },
    { text: 'Interview Results', icon: <Assessment />, path: '/results' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          minHeight: 45,
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            color: '#f5f5f5',
            letterSpacing: '-0.02em',
          }}
        >
          AI Interview
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        <List sx={{ px: 0.75 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={isActive(item.path)}
                onClick={isMobile ? onClose : undefined}
                sx={{
                  py: 0.75,
                  px: 1.25,
                  borderRadius: 1.5,
                  border: isActive(item.path) ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  backgroundColor: isActive(item.path) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  backdropFilter: 'blur(10px)',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: '#6366f1',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#6366f1',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? '#6366f1' : '#a3a3a3',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 600 : 500,
                    fontSize: '0.9375rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Logout Button */}
      <Box sx={{ p: 1, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            color: '#ef4444',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            },
          }}
        >
          <ListItemIcon sx={{ color: '#ef4444', minWidth: 40 }}>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText 
            primary="Logout" 
            primaryTypographyProps={{
              fontWeight: 500,
            }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {sidebarContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
        open
      >
        {sidebarContent}
      </Drawer>
    </Box>
  );
};

const TopBar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 1,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(10, 10, 10, 0.8)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, color: '#f5f5f5' }}
        >
          <Menu />
        </IconButton>
      )}
      <Typography
        variant="h6"
        noWrap
        component="div"
        sx={{
          fontWeight: 600,
          color: '#f5f5f5',
        }}
      >
        AI Interview Platform
      </Typography>
    </Box>
  );
};

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Global bulk call state
  const [bulkCallSession, setBulkCallSession] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const bulkCallContextValue = {
    bulkCallSession,
    setBulkCallSession,
    isCalling,
    setIsCalling,
    contacts,
    setContacts
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BulkCallContext.Provider value={bulkCallContextValue}>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/" element={<Navigate to="/signin" replace />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                      <Box
                        sx={{
                          flexGrow: 1,
                          ml: { md: `${drawerWidth}px` },
                          backgroundColor: 'transparent',
                          minHeight: '100vh',
                          pt: isCalling ? '50px' : 0,
                        }}
                      >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 0.75, md: 1 } }}>
                        <Dashboard />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            <Route
              path="/call-dashboard"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                      <Box
                        sx={{
                          flexGrow: 1,
                          ml: { md: `${drawerWidth}px` },
                          backgroundColor: 'transparent',
                          minHeight: '100vh',
                          pt: isCalling ? '50px' : 0,
                        }}
                      >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 0.75, md: 1 } }}>
                        <CallDashboard />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            <Route
              path="/results"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                      <Box
                        sx={{
                          flexGrow: 1,
                          ml: { md: `${drawerWidth}px` },
                          backgroundColor: 'transparent',
                          minHeight: '100vh',
                          pt: isCalling ? '50px' : 0,
                        }}
                      >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 0.75, md: 1 } }}>
                        <InterviewResults />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            <Route
              path="/interview/:interviewId"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                      <Box
                        sx={{
                          flexGrow: 1,
                          ml: { md: `${drawerWidth}px` },
                          backgroundColor: 'transparent',
                          minHeight: '100vh',
                          pt: isCalling ? '50px' : 0,
                        }}
                      >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 0.75, md: 1 } }}>
                        <InterviewDetails />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>

          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
            toastStyle={{
              backgroundColor: '#111111',
              color: '#f5f5f5',
              border: '1px solid #262626',
            }}
          />
        </Router>
      </BulkCallContext.Provider>
    </ThemeProvider>
  );
}

export default App;
