export interface InterviewResponse {
  question_number: number;
  question: string;
  answer: string;
  timestamp: string;
}

export interface Interview {
  call_sid: string;
  phone_number: string;
  status: string;
  questions_answered: number;
  total_questions: number;
  completion_time: string;
  validations_passed: boolean;
  termination_reason?: string;
  responses: InterviewResponse[];
}

export interface InterviewsApiResponse {
  interviews: Interview[];
  message?: string;
  error?: string;
}

export interface MakeCallResponse {
  success: boolean;
  call_sid?: string;
  error?: string;
  message?: string;
}

export interface JDReportResponse {
  call_id: string;
  candidate_analysis: {
    job_title: string;
    company: string;
    skill_match_percentage: number;
    found_skills: string[];
    recommendation: string;
    missing_skills: string[];
  };
  interview_summary: {
    questions_answered: number;
    total_questions: number;
    completion_rate: string;
  };
}