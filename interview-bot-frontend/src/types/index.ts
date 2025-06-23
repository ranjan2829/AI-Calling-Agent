export interface Call {
  id: number;
  callSid: string;
  phoneNumber: string;
  status: 'active' | 'completed' | 'terminated';
  startTime: string;
  duration?: string;
  questionsAnswered: number;
  totalQuestions?: number;
  validationPassed?: boolean;
  terminationReason?: string;
  currentQuestion?: number;
}

export interface Interview {
  id: number;
  callSid: string;
  candidateName?: string;
  phoneNumber: string;
  status: 'COMPLETED' | 'TERMINATED' | 'IN_PROGRESS';
  completionTime: string;
  questionsAnswered: number;
  totalQuestions: number;
  completionRate: string;
  validationsPassed: number;
  overallScore: number;
  terminationReason?: string;
  responses?: InterviewResponse[];
}

export interface InterviewResponse {
  question: string;
  answer: string;
  validation: {
    passed: boolean;
    confidence: number;
    reason?: string;
  };
}

export interface ServerStatus {
  status: 'ready' | 'offline';
  message?: string;
  company?: string;
}

export interface CallStats {
  totalCalls: number;
  completedInterviews: number;
  activeCall: boolean;
  successRate: number;
}

export interface TranscriptEntry {
  timestamp: string;
  speaker: 'AI' | 'Candidate';
  text: string;
}

export interface ValidationResult {
  passed: boolean;
  confidence: number;
  reason: string;
}