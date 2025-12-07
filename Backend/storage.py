"""File storage and data persistence - S3 and local fallback"""
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
except:
    USE_S3 = False
    print("⚠️ S3 storage not available, using local storage")

def ensure_directories():
    """Create necessary directories (for local fallback)"""
    folders = ["interviews", "archive/old_results"]
    for folder in folders:
        os.makedirs(folder, exist_ok=True)

def save_interview_session(call_sid: str, data: dict):
    """Save interview session (in-progress) - S3 or local"""
    try:
        # Try S3 first
        if USE_S3:
            session_data = data.copy()
            session_data['is_session'] = True
            save_interview_to_s3(f"session_{call_sid}", session_data)
        
        # Also save locally as backup
        filename = f"interviews/session_{call_sid}.json"
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving session {call_sid}: {e}")

def load_interview_session(call_sid: str) -> Optional[dict]:
    """Load interview session - S3 or local"""
    try:
        # Try S3 first
        if USE_S3:
            data = load_interview_from_s3(f"session_{call_sid}")
            if data:
                return data
        
        # Fallback to local
        filename = f"interviews/session_{call_sid}.json"
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
        return None
    except Exception as e:
        print(f"Error loading session {call_sid}: {e}")
        return None

def save_interview(call_sid: str, interview_data: dict):
    """Save completed interview - S3 and local"""
    try:
        interview_data.update({
            "status": interview_data.get("status", "COMPLETED"),
            "end_time": datetime.now().isoformat(),
            "completion_time": datetime.now().isoformat()
        })
        
        # Save to S3
        if USE_S3:
            s3_key = save_interview_to_s3(call_sid, interview_data)
            if s3_key:
                print(f"✅ Interview saved to S3: {s3_key}")
        
        # Also save locally as backup
        filename = f"interviews/{call_sid}.json"
        with open(filename, 'w') as f:
            json.dump(interview_data, f, indent=2)
        
        # Remove session file if exists
        session_file = f"interviews/session_{call_sid}.json"
        if os.path.exists(session_file):
            os.remove(session_file)
        
        print(f"Interview saved: {filename}")
        return filename
    except Exception as e:
        print(f"Error saving interview: {e}")
        return None

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
    """Get all interview files - from S3 or local"""
    interviews = []
    
    # Try S3 first
    if USE_S3:
        try:
            s3_interviews = list_all_interviews_from_s3()
            # Filter out session files and analysis files
            for interview in s3_interviews:
                call_sid = interview.get('call_sid') or interview.get('interview_id', '')
                if call_sid and not call_sid.startswith('session_') and 'JD_ANALYSIS' not in str(interview):
                    interviews.append(interview)
            if interviews:
                print(f"✅ Loaded {len(interviews)} interviews from S3")
                return interviews
        except Exception as e:
            print(f"⚠️ Error loading from S3, falling back to local: {e}")
    
    # Fallback to local
    interview_folder = "interviews"
    if not os.path.exists(interview_folder):
        return interviews
    
    import glob
    json_files = glob.glob(f"{interview_folder}/*.json")
    
    for file_path in json_files:
        filename = os.path.basename(file_path)
        # Skip session files and analysis files
        if "session_" in filename or "JD_ANALYSIS" in filename or "archive" in file_path:
            continue
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                interviews.append(data)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            continue
    
    return interviews
