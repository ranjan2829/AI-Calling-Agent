"""File storage and data persistence - Simple and clean"""
import os
import json
from datetime import datetime
from typing import Optional

def ensure_directories():
    """Create necessary directories"""
    folders = ["interviews", "live test results"]
    for folder in folders:
        os.makedirs(folder, exist_ok=True)

def save_interview_session(call_sid: str, data: dict):
    """Save interview session (in-progress)"""
    try:
        filename = f"interviews/session_{call_sid}.json"
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving session {call_sid}: {e}")

def load_interview_session(call_sid: str) -> Optional[dict]:
    """Load interview session"""
    try:
        filename = f"interviews/session_{call_sid}.json"
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
        return None
    except Exception as e:
        print(f"Error loading session {call_sid}: {e}")
        return None

def save_interview(call_sid: str, interview_data: dict):
    """Save completed interview - simple naming: just call_sid.json"""
    try:
        interview_data.update({
            "status": interview_data.get("status", "COMPLETED"),
            "end_time": datetime.now().isoformat(),
            "completion_time": datetime.now().isoformat()
        })
        
        # Simple filename - just call_sid.json
        filename = f"interviews/{call_sid}.json"
        with open(filename, 'w') as f:
            json.dump(interview_data, f, indent=2)
        
        # Remove session file if exists
        session_file = f"interviews/session_{call_sid}.json"
        if os.path.exists(session_file):
            os.remove(session_file)
        
        print(f"✅ Interview saved: {filename}")
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
    """Get all interview files - simple pattern matching"""
    interviews = []
    interview_folder = "interviews"
    
    if not os.path.exists(interview_folder):
        return interviews
    
    import glob
    # Only get completed interviews (not session files)
    json_files = glob.glob(f"{interview_folder}/*.json")
    
    for file_path in json_files:
        filename = os.path.basename(file_path)
        # Skip session files and analysis files - only get simple call_sid.json files
        if "session_" in filename or "JD_ANALYSIS" in filename:
            continue
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                interviews.append(data)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            continue
    
    return interviews
