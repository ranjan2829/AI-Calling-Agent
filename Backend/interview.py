"""Interview logic and validation"""
import re
from datetime import datetime
from typing import Tuple
from config import INTERVIEW_QUESTIONS
from storage import load_interview_session, save_interview_session

def check_time_availability(transcript_text: str) -> Tuple[bool, str]:
    """Check if candidate is available for interview"""
    text_lower = transcript_text.lower()
    
    positive_indicators = [
        "yes", "sure", "okay", "ok", "fine", "good time", "available",
        "ready", "go ahead", "proceed", "comfortable", "convenient"
    ]
    
    negative_indicators = [
        "no", "not now", "busy", "not a good time", "later", "call back",
        "not available", "inconvenient", "reschedule", "can't talk"
    ]
    
    call_later_indicators = [
        "later", "call back", "reschedule", "call later", "not now",
        "after", "evening", "tomorrow", "next week"
    ]
    
    for indicator in positive_indicators:
        if indicator in text_lower:
            return True, "available"
    
    for indicator in call_later_indicators:
        if indicator in text_lower:
            return False, "call_later"
    
    for indicator in negative_indicators:
        if indicator in text_lower:
            return False, "not_available"
    
    return True, "unclear"

def validate_response(call_sid: str, step: int, transcription: str) -> Tuple[bool, str, str]:
    """Validate interview response"""
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return True, "continue", "No state found"
        
        validation_result = {"step": step, "passed": True, "reason": ""}
        
        # Only validate availability (step 0) during interview
        if step == 0:
            is_available, availability_status = check_time_availability(transcription)
            validation_result["time_available"] = is_available
            validation_result["availability_status"] = availability_status
            
            if not is_available:
                validation_result["passed"] = False
                
                if availability_status == "call_later":
                    validation_result["reason"] = "Candidate requested to call later"
                    interview_data["callback_requested"] = True
                    interview_data["callback_response"] = transcription
                    interview_data["callback_request_time"] = datetime.now().isoformat()
                else:
                    validation_result["reason"] = "Candidate not available for interview"
                
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, availability_status, validation_result["reason"]
        
        # For all other steps, just store response
        if "validation_results" not in interview_data:
            interview_data["validation_results"] = {}
        interview_data["validation_results"][str(step)] = validation_result
        save_interview_session(call_sid, interview_data)
        return True, "continue", "Validation passed"
        
    except Exception as e:
        print(f"Validation error for {call_sid}, step {step}: {e}")
        return True, "continue", "Validation error - continuing"

def extract_candidate_name(responses: list, call_sid: str) -> str:
    """Extract candidate name from responses"""
    if not responses:
        return f"Candidate_{call_sid[-8:]}"
    
    first_answer = responses[0].get('answer', '').strip()
    if not first_answer:
        return f"Candidate_{call_sid[-8:]}"
    
    name_patterns = [
        r"(?:i'?m|my name is|i am|this is)\s+([a-zA-Z][a-zA-Z\s]{1,25})",
        r"^([a-zA-Z][a-zA-Z\s]{1,25}?)(?:\s+speaking|\s+here|\s*$)",
        r"myself\s+([a-zA-Z][a-zA-Z\s]{1,25})"
    ]
    
    for pattern in name_patterns:
        match = re.search(pattern, first_answer, re.IGNORECASE)
        if match:
            extracted_name = match.group(1).strip()
            if (len(extracted_name) > 2 and 
                not any(word in extracted_name.lower() for word in ['from', 'calling', 'speaking', 'here', 'hello', 'hi'])):
                return extracted_name.title()
    
    return f"Candidate_{call_sid[-8:]}"

