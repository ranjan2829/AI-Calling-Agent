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
  Divider,
  CssBaseline,
  useMediaQuery,
  useTheme,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assessment,
  GroupAdd,
  Menu,
  ExitToApp,
  Phone,
  PictureAsPdf
} from '@mui/icons-material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import components
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';
import { CallDashboard } from './components/CallDashboard';
import { InterviewDetails } from './components/InterviewDetails';
import { InterviewResults } from './components/InterviewResults';
import { BulkCallDashboard } from './components/BulkCallDashboard';
import BulkPdfProcessor from './components/BulkPdfProcessor';

const drawerWidth = 280;

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

// Modern Flat Dark Theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6', // Modern blue
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b', // Slate
      light: '#94a3b8',
      dark: '#475569',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0f172a', // Slate 900
      paper: '#1e293b',   // Slate 800
    },
    text: {
      primary: '#f8fafc', // Slate 50
      secondary: '#94a3b8', // Slate 400
      disabled: '#64748b', // Slate 500
    },
    divider: '#334155', // Slate 700
    error: {
      main: '#ef4444', // Red 500
    },
    warning: {
      main: '#f59e0b', // Amber 500
    },
    info: {
      main: '#3b82f6', // Blue 500
    },
    success: {
      main: '#10b981', // Emerald 500
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid #334155',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #334155',
          backgroundColor: '#0f172a',
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
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        py: 1.5,
        px: 3,
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
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            fontWeight: 600,
          }}
        />
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#ffffff',
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
};

const Sidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isCalling, bulkCallSession } = useBulkCall();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/signin';
  };

  const menuItems = [
    { text: 'Main Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Call Dashboard', icon: <Phone />, path: '/call-dashboard' },
    // Call History removed as requested
    { text: 'Interview Results', icon: <Assessment />, path: '/results' },
    { text: 'Bulk Calling', icon: <GroupAdd />, path: '/bulk-call', showBadge: isCalling },
    { text: 'Bulk PDF Processor', icon: <PictureAsPdf />, path: '/bulk-pdf-processor' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 3,
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          minHeight: 80,
        }}
      >
        <Box
          component="img"
          src="/dashboard-logo.svg"
          alt="Logo"
          sx={{
            height: '32px',
            width: 'auto',
            marginRight: '12px',
            filter: 'brightness(0) invert(1)',
          }}
        />
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            color: '#f8fafc',
          }}
        >
          AI Interview
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={isActive(item.path)}
                onClick={isMobile ? onClose : undefined}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#2563eb',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#ffffff',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? '#ffffff' : '#94a3b8',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 600 : 400,
                    fontSize: '0.9rem',
                  }}
                />
                {item.showBadge && (
                  <Chip
                    label="Active"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontWeight: 600,
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Logout Button */}
      <Box sx={{ p: 2, borderTop: '1px solid #334155' }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 1,
            color: '#ef4444',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            },
          }}
        >
          <ListItemIcon sx={{ color: '#ef4444', minWidth: 40 }}>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText primary="Logout" />
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

const TopBar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 2,
        borderBottom: '1px solid #334155',
        backgroundColor: '#0f172a',
      }}
    >
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
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
          color: '#f8fafc',
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
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                    <Box
                      sx={{
                        flexGrow: 1,
                        ml: { md: `${drawerWidth}px` },
                        backgroundColor: 'transparent',
                        minHeight: '100vh',
                        pt: isCalling ? '60px' : 0,
                      }}
                    >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 2, md: 4 } }}>
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
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                    <Box
                      sx={{
                        flexGrow: 1,
                        ml: { md: `${drawerWidth}px` },
                        backgroundColor: 'transparent',
                        minHeight: '100vh',
                        pt: isCalling ? '60px' : 0,
                      }}
                    >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 2, md: 4 } }}>
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
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                    <Box
                      sx={{
                        flexGrow: 1,
                        ml: { md: `${drawerWidth}px` },
                        backgroundColor: 'transparent',
                        minHeight: '100vh',
                        pt: isCalling ? '60px' : 0,
                      }}
                    >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 2, md: 4 } }}>
                        <InterviewResults />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            <Route
              path="/interview/:id"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                    <Box
                      sx={{
                        flexGrow: 1,
                        ml: { md: `${drawerWidth}px` },
                        backgroundColor: 'transparent',
                        minHeight: '100vh',
                        pt: isCalling ? '60px' : 0,
                      }}
                    >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 2, md: 4 } }}>
                        <InterviewDetails />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            <Route
              path="/bulk-call"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                    <Box
                      sx={{
                        flexGrow: 1,
                        ml: { md: `${drawerWidth}px` },
                        backgroundColor: 'transparent',
                        minHeight: '100vh',
                        pt: isCalling ? '60px' : 0,
                      }}
                    >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 2, md: 4 } }}>
                        <BulkCallDashboard />
                      </Box>
                    </Box>
                  </Box>
                </ProtectedRoute>
              }
            />

            <Route
              path="/bulk-pdf-processor"
              element={
                <ProtectedRoute>
                  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
                    <TopProgressBar />
                    <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
                    <Box
                      sx={{
                        flexGrow: 1,
                        ml: { md: `${drawerWidth}px` },
                        backgroundColor: 'transparent',
                        minHeight: '100vh',
                        pt: isCalling ? '60px' : 0,
                      }}
                    >
                      <TopBar onMenuClick={handleDrawerToggle} />
                      <Box sx={{ p: { xs: 2, md: 4 } }}>
                        <BulkPdfProcessor />
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
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
            }}
          />
        </Router>
      </BulkCallContext.Provider>
    </ThemeProvider>
  );
}

export default App;
