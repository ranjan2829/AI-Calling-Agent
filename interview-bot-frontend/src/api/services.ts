import axios from 'axios';
const API_BASE_URL = 'http://13.204.76.229:8000';
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
        company: 'Onelab Ventures',
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
  return apiRequest('/all-interviews');
};
export const testAWSServices = async () => {
  return apiRequest('/test-aws');
};
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
  }
};