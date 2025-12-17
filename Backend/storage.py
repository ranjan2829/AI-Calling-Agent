"""File storage and data persistence - S3 only"""
import os
import json
from datetime import datetime
from typing import Optional

# Try to import S3 functions
try:
    from s3_storage import (
        save_interview_to_s3, load_interview_from_s3, list_all_interviews_from_s3,
        save_jd_analysis_to_s3, load_jd_analysis_from_s3, s3_client
    )
    USE_S3 = s3_client is not None
    if not USE_S3:
        raise ValueError("S3 client not initialized")
except Exception as e:
    USE_S3 = False
    print(f"❌ S3 storage not available: {e}")
    raise RuntimeError("S3 storage is required. Please configure AWS credentials.")

def ensure_directories():
    """Create necessary directories (for compatibility)"""
    folders = ["interviews", "archive/old_results"]
    for folder in folders:
        os.makedirs(folder, exist_ok=True)

def save_interview_session(call_sid: str, data: dict):
    """Save interview session (in-progress) - S3 only"""
    if not USE_S3:
        raise RuntimeError("S3 storage is required")
    
    try:
        session_data = data.copy()
        session_data['is_session'] = True
        save_interview_to_s3(f"session_{call_sid}", session_data)
        print(f"✅ Session saved to S3: session_{call_sid}")
    except Exception as e:
        print(f"❌ Error saving session {call_sid}: {e}")
        raise

def load_interview_session(call_sid: str) -> Optional[dict]:
    """Load interview session - S3 only"""
    if not USE_S3:
        return None
    
    try:
        data = load_interview_from_s3(f"session_{call_sid}")
        return data
    except Exception as e:
        print(f"❌ Error loading session {call_sid}: {e}")
        return None

def save_interview(call_sid: str, interview_data: dict):
    """Save completed interview - S3 only"""
    if not USE_S3:
        raise RuntimeError("S3 storage is required")
    
    try:
        interview_data.update({
            "status": interview_data.get("status", "COMPLETED"),
            "end_time": datetime.now().isoformat(),
            "completion_time": datetime.now().isoformat()
        })
        
        # Save to S3
        s3_key = save_interview_to_s3(call_sid, interview_data)
        if s3_key:
            print(f"✅ Interview saved to S3: {s3_key}")
            return s3_key
        else:
            raise RuntimeError("Failed to save interview to S3")
    except Exception as e:
        print(f"❌ Error saving interview: {e}")
        raise

def load_job_description() -> dict:
    """Load job description"""
    try:
        jd_files = ["current_jd.json", "config/job_description.json"]
        for jd_file in jd_files:
            if os.path.exists(jd_file):
                with open(jd_file, 'r') as f:
                    return json.load(f)
        return {
            "title": "Software Developer",
            "company": "AI Interview Platform",
            "description": "Software Developer position",
            "required_skills": ["python", "javascript", "react"],
            "experience_required": "2-5 years"
        }
    except Exception as e:
        print(f"Error loading JD: {e}")
        return {
            "title": "Software Developer",
            "company": "AI Interview Platform",
            "description": "Software Developer position",
            "required_skills": ["python", "javascript", "react"],
            "experience_required": "2-5 years"
        }

def save_job_description(jd_data: dict):
    """Save job description"""
    try:
        with open("current_jd.json", "w") as f:
            json.dump(jd_data, f, indent=2)
    except Exception as e:
        print(f"Error saving JD: {e}")

def get_all_interviews() -> list:
    """Get all interview files - from S3 only"""
    if not USE_S3:
        print("❌ S3 storage is required")
        return []
    
    interviews = []
    try:
        s3_interviews = list_all_interviews_from_s3()
        # Filter out session files and analysis files
        for interview in s3_interviews:
            call_sid = interview.get('call_sid') or interview.get('interview_id', '')
            # Handle session files - load them but mark as sessions
            if call_sid and call_sid.startswith('session_'):
                # Extract actual call_sid from session key
                actual_call_sid = call_sid.replace('session_', '')
                interview['call_sid'] = actual_call_sid
                interview['interview_id'] = actual_call_sid
            if call_sid and 'JD_ANALYSIS' not in str(interview):
                interviews.append(interview)
        
        print(f"✅ Loaded {len(interviews)} interviews from S3")
        return interviews
    except Exception as e:
        print(f"❌ Error loading from S3: {e}")
        return []
