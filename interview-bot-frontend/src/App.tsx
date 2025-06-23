import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
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
  Dashboard,
  History,
  Assessment,
  GroupAdd,
  Menu
} from '@mui/icons-material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { CallDashboard } from './components/CallDashboard';
import { CallHistory } from './components/CallHistory';
import { InterviewDetails } from './components/InterviewDetails';
import { InterviewResults } from './components/InterviewResults';
import { BulkCallDashboard } from './components/BulkCallDashboard';

const drawerWidth = 280;

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

// Greenish blue theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2F8D8C',
      light: '#4FD0D7',
      dark: '#006B6B',
    },
    secondary: {
      main: '#319492',
      light: '#63E6E2',
      dark: '#00807A',
    },
    info: {
      main: '#17A2B8',
      light: '#5BC5D3',
      dark: '#0E7489',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
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
        backgroundColor: 'primary.main',
        color: 'white',
        py: 1,
        px: 2,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          Bulk Calling in Progress
        </Typography>
        <Chip
          label={`${bulkCallSession.completed_calls}/${bulkCallSession.total_contacts}`}
          size="small"
          sx={{ backgroundColor: 'white', color: 'primary.main', fontWeight: 'bold' }}
        />
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.3)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: 'white',
            borderRadius: 2
          }
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

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Call History', icon: <History />, path: '/history' },
    { text: 'Interview Results', icon: <Assessment />, path: '/results' },
    { text: 'Bulk Calling', icon: <GroupAdd />, path: '/bulk-call', showBadge: isCalling },
  ];

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section with Different Background */}
      <Box
        sx={{
          p: 3,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          minHeight: 80
        }}
      >
        <Box
          component="img"
          src="/dashboard-logo.svg"
          alt="AI Interview Bot Logo"
          sx={{
            height: '40px',
            width: 'auto',
            marginRight: '12px'
          }}
        />
        <Box>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 'bold', 
              color: '#2F8D8C',
              fontSize: '1.1rem',
              lineHeight: 1.2
            }}
          >
            AI Interview Bot
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#64748b',
              fontSize: '0.75rem'
            }}
          >
            Smart Recruitment
          </Typography>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <List sx={{ p: 2 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={isMobile ? onClose : undefined}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  backgroundColor: isActive(item.path) ? 'primary.main' : 'transparent',
                  color: isActive(item.path) ? 'white' : '#64748b',
                  '&:hover': {
                    backgroundColor: isActive(item.path) ? 'primary.dark' : 'rgba(47, 141, 140, 0.08)',
                    color: isActive(item.path) ? 'white' : 'primary.main',
                  },
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative'
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? 'white' : '#64748b',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 600 : 500,
                    fontSize: '0.95rem',
                  }}
                />
                {item.showBadge && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      animation: 'pulse 2s infinite'
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {/* Bulk Call Status in Sidebar */}
        {isCalling && bulkCallSession && (
          <Box sx={{ p: 2 }}>
            <Typography 
              variant="overline" 
              sx={{ 
                color: 'primary.main', 
                fontWeight: 600,
                fontSize: '0.75rem',
                letterSpacing: 1
              }}
            >
              Live Progress
            </Typography>
            <Box 
              sx={{ 
                mt: 1,
                p: 2,
                backgroundColor: 'white',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'primary.light'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Bulk Calling Active
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {bulkCallSession.completed_calls} of {bulkCallSession.total_contacts} completed
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(bulkCallSession.completed_calls / bulkCallSession.total_contacts) * 100}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#94a3b8',
            fontSize: '0.7rem',
            textAlign: 'center',
            display: 'block'
          }}
        >
          © 2025 AI Calling Interview Bot
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            border: 'none',
            boxShadow: '0 0 15px rgba(0, 0, 0, 0.1)',
          },
        }}
        open
      >
        {sidebarContent}
      </Drawer>

      {/* Mobile Drawer */}
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
    </>
  );
};

const TopBar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const { isCalling } = useBulkCall();

  return (
    <Box
      sx={{
        display: { xs: 'flex', md: 'none' },
        alignItems: 'center',
        p: 2,
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: isCalling ? '60px' : 0,
        zIndex: 1100,
        ml: { md: `${drawerWidth}px` },
      }}
    >
      <IconButton
        color="inherit"
        aria-label="open drawer"
        edge="start"
        onClick={onMenuClick}
        sx={{ mr: 2 }}
      >
        <Menu />
      </IconButton>
      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        AI Interview Bot
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
          <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* Top Progress Bar */}
            <TopProgressBar />

            {/* Sidebar */}
            <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />

            {/* Main Content */}
            <Box
              sx={{
                flexGrow: 1,
                ml: { md: `${drawerWidth}px` },
                backgroundColor: 'background.default',
                minHeight: '100vh',
                pt: isCalling ? '60px' : 0,
              }}
            >
              {/* Horizontal Upper Line */}
              <Box
                sx={{
                  height: '4px',
                  background: 'linear-gradient(90deg, #2F8D8C 0%, #319492 50%, #17A2B8 100%)',
                  width: '100%'
                }}
              />

              {/* Top Bar for Mobile */}
              <TopBar onMenuClick={handleDrawerToggle} />

              {/* Page Content */}
              <Box sx={{ p: { xs: 2, md: 4 } }}>
                <Routes>
                  <Route path="/" element={<CallDashboard />} />
                  <Route path="/history" element={<CallHistory />} />
                  <Route path="/interview/:interviewId" element={<InterviewDetails />} />
                  <Route path="/results" element={<InterviewResults />} />
                  <Route path="/bulk-call" element={<BulkCallDashboard />} />
                </Routes>
              </Box>
            </Box>

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
              theme="light"
            />
          </Box>
        </Router>
      </BulkCallContext.Provider>
    </ThemeProvider>
  );
}

export default App;