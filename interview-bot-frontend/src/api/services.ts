import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`API endpoint ${endpoint} not found, using mock data`);
        return getMockData(endpoint);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    return getMockData(endpoint);
  }
};

const getMockData = (endpoint: string) => {
  switch (endpoint) {
    case '/interviews':
      return {
        interviews: []
      };
    case '/job-description':
      return {
        title: 'Software Developer',
        company: 'AI Interview Platform',
        description: 'Sample job description',
        required_skills: 'Python, JavaScript, React',
        experience_required: '2-5 years'
      };
    default:
      return {};
  }
};

export const getCallStats = async () => {
  const data = await apiRequest('/interviews');
  const interviews = data.interviews || [];
  const totalCalls = interviews.length;
  const successfulCalls = interviews.filter((i: any) => i.status === 'COMPLETED').length;
  const failedCalls = totalCalls - successfulCalls;
  const avgDuration = interviews.reduce((sum: number, i: any) => sum + (i.questionsAnswered || 0), 0) / totalCalls || 0;
  
  return {
    totalCalls,
    successfulCalls,
    failedCalls,
    avgDuration,
    completedCalls: successfulCalls
  };
};

export const getJobDescription = async () => {
  return apiRequest('/job-description');
};

export const updateJobDescription = async (jobData: any) => {
  return apiRequest('/update-job-description', {
    method: 'POST',
    body: JSON.stringify(jobData),
  });
};

export const getDetailedInterviews = async () => {
  return apiRequest('/all-interviews');
};

export const getInterviewDetails = async (interviewId: string) => {
  return apiRequest(`/interview-details/${interviewId}`);
};

export const initiateCall = async (phoneNumber: string) => {
  return apiRequest('/make-call', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
};

export const runJDAnalysis = async () => {
  return apiRequest('/run-jd-analysis', {
    method: 'POST',
  });
};

export const getJDReport = async (callId: string) => {
  return apiRequest(`/jd-report/${callId}`);
};

export const getAllInterviews = async () => {
  return apiRequest('/all-interviews'); // This matches your backend
};

export const testAWSServices = async () => {
  return apiRequest('/test-aws');
};

// Main API object with all methods
export const callsApi = {
  getInterviewDetails: async (interviewId: string) => {
    const data = await getInterviewDetails(interviewId);
    return { data };
  },
  
  getJDReport: async (callId: string) => {
    const data = await getJDReport(callId);
    return { data };
  },
  
  runJDAnalysis: async () => {
    const data = await runJDAnalysis();
    return { data };
  },
  
  getAllInterviewsDetailed: async () => {
    const data = await getAllInterviews();
    return { data };
  },
  
  updateJobDescription: async (jobData: any) => {
    const data = await updateJobDescription(jobData);
    return { data };
  },
  
  initiateCall: async (phoneNumber: string) => {
    const data = await initiateCall(phoneNumber);
    return { data };
  },
  
  // FIXED: Use apiClient instead of undefined reference
  saveBulkResults: async (bulkData: any) => {
    const response = await apiClient.post('/save-bulk-results', bulkData);
    return response;
  },
  
  getBulkResults: async (bulkCallId: string) => {
    const response = await apiClient.get(`/bulk-results/${bulkCallId}`);
    return response;
  },
  
  getAllBulkResults: async () => {
    const response = await apiClient.get('/bulk-results');
    return response;
  },

  // Add missing methods that the BulkCallDashboard needs
  makeBulkCalls: async (contacts: any[]) => {
    const response = await apiClient.post('/bulk-call', contacts);
    return response;
  },

  uploadCSV: async (formData: FormData) => {
    const response = await apiClient.post('/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },

  getContactMappings: async () => {
    const response = await fetch(`${API_BASE_URL}/contact-mappings`);
    return response.json();
  },

  getInterviewQuestions: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/interview-questions`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting interview questions:', error);
      return { success: false, questions: [] };
    }
  },

  updateInterviewQuestions: async (questions: any[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update-interview-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating interview questions:', error);
      return { success: false };
    }
  },
};

export default callsApi;