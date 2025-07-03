from fastapi import FastAPI, Request, BackgroundTasks, UploadFile, File
from fastapi.responses import Response
import os
import json
import boto3
import time
import requests
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather
import asyncio
import re
from summary import run_jd_analysis
import glob
from typing import List
import csv
import io
from dotenv import load_dotenv
load_dotenv()
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET = os.getenv("S3_BUCKET", "ai-calling-agent")
account_sid = os.getenv("account_sid")
auth_token = os.getenv("auth_token")
WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL")
TRANSCRIPTION_TIMEOUT = 10
SILENCE_TIMEOUT = 5 
MAX_SILENCE_PROMPTS = 1 
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="AI INTERVIEWER")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000","http://13.204.76.229:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],)
client = Client(account_sid, auth_token)
executor = ThreadPoolExecutor(max_workers=10)
def create_folders():
    folders = [
        "interviews/audio_recordings",
        "interviews/transcriptions"]
    for folder in folders:
        os.makedirs(folder, exist_ok=True)
create_folders()
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION)
    transcribe_client = boto3.client(
        'transcribe',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION)
    print("AWS clients initialized successfully")
except Exception as e:
    print(f"Error initializing AWS clients: {e}")
conversation_state = {}
INTERVIEW_QUESTIONS = {
    0: "Is this a good time to speak for a 3-4 minute interview?",
    1: "Introduce yourself.",
    2: "What are your key skills for this role?",
    3: "What is your current notice period?",
    4: "What is your current CTC and expected salary?",
    5: "Tell us about your experience with APIs.",
    6: "What is your understanding of cloud platforms? Have you worked with AWS, Azure, or GCP?",
    7: "Describe your experience with deployments, including the use of Docker and Kubernetes.",
    8: "What is your experience with AI and machine learning? Mention any GenAI, deep learning technologies, or frameworks you've used."
}
def load_jd_skills():
    try:
        config_files = ["current_jd.json", "config/job_description.json"]
        for jd_file_path in config_files:
            if os.path.exists(jd_file_path):
                with open(jd_file_path, 'r') as f:
                    jd_data = json.load(f)
                skills = jd_data.get("required_skills", []) or jd_data.get("skills", []) or jd_data.get("technical_skills", [])
                return skills if skills else ["python", "javascript", "react"]
        return ["python", "javascript", "react"]
    except Exception as e:
        print(f"Error loading JD skills: {e}")
        return ["python", "javascript", "react"]
def check_skills_match(transcript_text):
    text_lower = transcript_text.lower()
    jd_skills = load_jd_skills()
    found_skills = []
    for skill in jd_skills:
        if skill.lower() in text_lower:
            found_skills.append(skill)
    match_percentage = (len(found_skills) / len(jd_skills)) * 100 if jd_skills else 0
    return match_percentage >= 50, found_skills, match_percentage
def check_relocation_willingness(transcript_text):
    text_lower = transcript_text.lower()
    positive_indicators = ["yes", "open", "willing", "can relocate", "no problem", "sure", "okay", "fine"]
    negative_indicators = ["no", "not open", "cannot", "can't", "not willing", "remote only", "not interested"]
    for indicator in positive_indicators:
        if indicator in text_lower:
            return True, "positive"
    for indicator in negative_indicators:
        if indicator in text_lower:
            return False, "negative"
    return True, "unclear"
def check_onsite_availability(transcript_text):
    text_lower = transcript_text.lower()
    positive_indicators = ["yes", "can attend", "available", "no problem", "sure", "okay", "fine"]
    negative_indicators = ["no", "cannot", "can't", "not available", "remote only", "not possible"] 
    for indicator in positive_indicators:
        if indicator in text_lower:
            return True, "positive"
    for indicator in negative_indicators:
        if indicator in text_lower:
            return False, "negative"
    return True, "unclear"
def check_notice_period(transcript_text):
    text_lower = transcript_text.lower()
    day_pattern = r'(\d+)\s*(?:days?|day)'
    week_pattern = r'(\d+)\s*(?:weeks?|week)'
    month_pattern = r'(\d+)\s*(?:months?|month)'
    days_found = re.findall(day_pattern, text_lower)
    weeks_found = re.findall(week_pattern, text_lower)
    months_found = re.findall(month_pattern, text_lower)
    total_days = 0
    if days_found:
        total_days = max([int(d) for d in days_found])
    if weeks_found:
        total_days = max(total_days, max([int(w) * 7 for w in weeks_found]))
    if months_found:
        total_days = max(total_days, max([int(m) * 30 for m in months_found]))
    immediate_keywords = ["immediate", "immediately", "now", "asap", "no notice"]
    for keyword in immediate_keywords:
        if keyword in text_lower:
            return True, 0, "immediate"
    if total_days == 0:
        return True, 0, "unclear"
    return total_days <= 30, total_days, "specified"
def save_interview_session(call_sid: str, data: dict):
    try:
        filename = f"interviews/session_{call_sid}.json"
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving session {call_sid}: {e}")
def load_interview_session(call_sid: str):
    try:
        filename = f"interviews/session_{call_sid}.json"
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
        return None
    except Exception as e:
        print(f"Error loading session {call_sid}: {e}")
        return None
def check_api_experience(transcript_text):
    text_lower = transcript_text.lower()
    api_keywords = [
        "api", "rest", "json", "http", "get", "post", "put", "delete",
        "endpoints", "postman", "flask", "django", "express", "fastapi"
    ]
    has_api_experience = any(keyword in text_lower for keyword in api_keywords)
    found_skills = [keyword for keyword in api_keywords if keyword in text_lower]
    return has_api_experience, found_skills, has_api_experience

def check_cloud_platforms_experience(transcript_text):
    text_lower = transcript_text.lower()
    cloud_keywords = [
        "aws", "azure", "gcp", "google cloud", "amazon web services",
        "cloud", "docker", "kubernetes", "devops"
    ]
    has_cloud_experience = any(keyword in text_lower for keyword in cloud_keywords)
    found_skills = [keyword for keyword in cloud_keywords if keyword in text_lower]
    return has_cloud_experience, {"cloud": found_skills}, found_skills, 1 if has_cloud_experience else 0
def check_deployment_docker_kubernetes_experience(transcript_text):
    text_lower = transcript_text.lower()
    deployment_keywords = [
        "deployment", "deploy", "docker", "kubernetes", "ci/cd", "devops", "build"
    ]
    has_experience = any(keyword in text_lower for keyword in deployment_keywords)
    found_skills = [keyword for keyword in deployment_keywords if keyword in text_lower]
    return has_experience, has_experience, has_experience, found_skills, has_experience
def check_ai_ml_experience(transcript_text):
    text_lower = transcript_text.lower()
    ai_keywords = [
        "ai", "ml", "machine learning", "artificial intelligence", "deep learning",
        "neural network", "tensorflow", "pytorch", "python", "data science"
    ]
    has_ai_experience = any(keyword in text_lower for keyword in ai_keywords)
    found_skills = [keyword for keyword in ai_keywords if keyword in text_lower]
    return has_ai_experience, has_ai_experience, has_ai_experience, has_ai_experience, found_skills
def check_time_availability(transcript_text):
    """Check if candidate is available for interview right now"""
    text_lower = transcript_text.lower()
    
    positive_indicators = [
        "yes", "sure", "okay", "ok", "fine", "good time", "available", 
        "ready", "go ahead", "proceed", "comfortable", "convenient",
        "now is good", "good to talk", "let's do it", "let's start",
        "i'm free", "no problem", "that's fine", "perfect"
    ]
    
    negative_indicators = [
        "no", "not now", "busy", "not a good time", "later", "call back",
        "not available", "inconvenient", "not convenient", "meeting",
        "driving", "working", "occupied", "reschedule", "can't talk",
        "bad time", "not free", "in a meeting", "call later"
    ]
    
    for indicator in positive_indicators:
        if indicator in text_lower:
            return True, "available"
    
    for indicator in negative_indicators:
        if indicator in text_lower:
            return False, "not_available"
    
    return True, "unclear"
def validate_response_selected_questions(call_sid: str, step: int, transcription: str):
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return True, "continue", "No state found"      
        validation_result = {"step": step, "passed": True, "reason": ""}
        if step == 0:
            is_available, availability_status = check_time_availability(transcription)
            validation_result["time_available"] = is_available
            validation_result["availability_status"] = availability_status
            validation_result["response"] = transcription[:100]
            
            if not is_available:
                validation_result["passed"] = False
                validation_result["reason"] = "Candidate not available for interview"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "not_available", "Candidate not available for interview"
        
        elif step == 2:
            has_skills, found_skills, match_percentage = check_skills_match(transcription)
            validation_result["skills_match"] = has_skills
            validation_result["found_skills"] = found_skills
            validation_result["match_percentage"] = match_percentage
            if not has_skills and len(found_skills) == 0:
                validation_result["passed"] = False
                validation_result["reason"] = "No relevant skills mentioned"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_skills", "No relevant skills found"
                
        elif step == 3:
            notice_acceptable, notice_days, _ = check_notice_period(transcription)
            validation_result["notice_acceptable"] = notice_acceptable
            validation_result["notice_days"] = notice_days
            if notice_days > 60:
                validation_result["passed"] = False
                validation_result["reason"] = f"Notice period too long ({notice_days} days > 60 days)"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "notice_long", f"Notice period {notice_days} days exceeds 60 days"
                
        elif step == 4:
            validation_result["ctc_mentioned"] = True
            validation_result["response"] = transcription[:100]
            
        elif step == 5:
            has_api_exp, found_api_skills, _ = check_api_experience(transcription)
            validation_result["api_experience"] = has_api_exp
            validation_result["found_api_skills"] = found_api_skills
            if not has_api_exp and len(found_api_skills) == 0:
                validation_result["passed"] = False
                validation_result["reason"] = "No API experience mentioned"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_api_experience", "No API experience found"
                
        elif step == 6:
            has_cloud_exp, found_platforms, cloud_concepts, platforms_count = check_cloud_platforms_experience(transcription)
            validation_result["cloud_experience"] = has_cloud_exp
            validation_result["found_platforms"] = found_platforms
            validation_result["cloud_concepts"] = cloud_concepts
            if not has_cloud_exp and len(cloud_concepts) == 0:
                validation_result["passed"] = False
                validation_result["reason"] = "No cloud experience mentioned"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_cloud_experience", "No cloud experience found"
                
        elif step == 7:
            has_deploy, has_docker, has_k8s, total_skills, has_modern = check_deployment_docker_kubernetes_experience(transcription)
            validation_result["deployment_experience"] = has_deploy
            validation_result["docker_experience"] = has_docker
            validation_result["kubernetes_experience"] = has_k8s
            validation_result["deployment_skills"] = total_skills
            if not has_deploy and len(total_skills) == 0:
                validation_result["passed"] = False
                validation_result["reason"] = "No deployment experience mentioned"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_deployment_experience", "No deployment experience found"
                
        elif step == 8:
            has_ai, has_genai, has_frameworks, has_dl, total_ai_skills = check_ai_ml_experience(transcription)
            validation_result["ai_experience"] = has_ai
            validation_result["genai_experience"] = has_genai
            validation_result["framework_experience"] = has_frameworks
            validation_result["deep_learning_experience"] = has_dl
            validation_result["ai_skills"] = total_ai_skills
            if not has_ai and len(total_ai_skills) == 0:
                validation_result["passed"] = False
                validation_result["reason"] = "No AI/ML experience mentioned"
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_ai_experience", "No AI/ML experience found"
        
        if "validation_results" not in interview_data:
            interview_data["validation_results"] = {}
        interview_data["validation_results"][str(step)] = validation_result
        save_interview_session(call_sid, interview_data)
        return True, "continue", "Validation passed"
    except Exception as e:
        print(f"[ERROR] Validation error for {call_sid}, step {step}: {e}")
        return True, "continue", "Validation error - continuing"
def ask_next_question_immediately(call_sid: str, question_index: int):
    try:
        if question_index > len(INTERVIEW_QUESTIONS) - 1:
            return complete_interview(call_sid)      
        
        question = INTERVIEW_QUESTIONS[question_index]     
        resp = VoiceResponse()
        if question_index == 1:
            resp.say("Great! Let's begin with our technical interview.", voice='Polly.Aditi', rate='medium')
            resp.pause(length=0.5)
        elif question_index > 1:
            resp.say("Next question:", voice='Polly.Aditi', rate='medium')
            resp.pause(length=0.2)
        
        resp.say(question, voice='Polly.Aditi', rate='medium')
        
        gather = resp.gather(
            input='speech',
            action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
            method='POST',
            speechTimeout='auto',
            timeout='6',         
            language='en-IN',      
            enhanced=True,         
            profanityFilter=False,
            speechModel='experimental_conversations'
        )
        resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')      
        return str(resp)      
    except Exception as e:
        print(f"[ERROR] Error asking question {question_index} for {call_sid}: {e}")
        return handle_error("Sorry, there was an error with the question.")
def handle_no_response(call_sid: str):
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return handle_error("Interview session not found")       
        silence_prompts = interview_data.get('silence_prompts', 0)
        current_question_index = interview_data.get('current_question', 0)  # Changed to 0        
        if silence_prompts >= 1:
            resp = VoiceResponse()
            resp.say("Thank you for your time. We'll be in touch soon.", voice='Polly.Aditi')
            resp.hangup()           
            interview_data['status'] = 'INCOMPLETE_SILENCE'
            interview_data['end_time'] = datetime.now().isoformat()
            save_interview_session(call_sid, interview_data)          
            return str(resp)
        interview_data['silence_prompts'] = silence_prompts + 1
        save_interview_session(call_sid, interview_data)      
        resp = VoiceResponse()
        resp.say("Please respond to the question.", voice='Polly.Aditi', rate='medium')
        if current_question_index <= len(INTERVIEW_QUESTIONS) - 1: # Adjust for 0-based indexing
            resp.pause(length=0.3)
            resp.say(INTERVIEW_QUESTIONS[current_question_index], voice='Polly.Aditi', rate='medium')
            gather = resp.gather(
                input='speech',
                action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
                method='POST',
                speechTimeout='auto',
                timeout='6',
                language='en-IN',
                enhanced=True,
                profanityFilter=False,
                speechModel='experimental_conversations'
            )           
            resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')        
        
        return str(resp)      
    except Exception as e:
        return handle_error("Technical difficulty occurred.")
def complete_interview(call_sid):
    try:
        print(f"[DEBUG] Completing interview for {call_sid}")
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            print(f"[ERROR] No interview session found for {call_sid}")
            interview_data = {
                "interview_id": call_sid,
                "responses": [],
                "status": "COMPLETED",
                "start_time": datetime.now().isoformat(),
                "phone_number": "unknown",
                "twilio_number": "+14787807480"
            }
        responses = interview_data.get("responses", [])
        print(f"[DEBUG] Found {len(responses)} responses for {call_sid}")
        interview_data["status"] = "COMPLETED"
        interview_data["end_time"] = datetime.now().isoformat()
        interview_data["completion_time"] = datetime.now().isoformat()
        if "phone_number" not in interview_data:
            interview_data["phone_number"] = "unknown"
        if "twilio_number" not in interview_data:
            interview_data["twilio_number"] = "+14787807480"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"interviews/{call_sid}_COMPLETED_{timestamp}.json"
        os.makedirs("interviews", exist_ok=True)
        with open(filename, 'w') as f:
            json.dump(interview_data, f, indent=2)
        print(f"[COMPLETED] Interview {call_sid} saved to {filename}")
        try:
            executor.submit(run_jd_analysis)
        except Exception as e:
            print(f"[ERROR] Failed to run analysis: {e}")
        try:
            session_file = f"interviews/session_{call_sid}.json"
            if os.path.exists(session_file):
                os.remove(session_file)
                print(f"[CLEANUP] Removed session file for {call_sid}")
        except Exception as e:
            print(f"[ERROR] Failed to cleanup session file: {e}")
        conversation_state.pop(call_sid, None)
        response = VoiceResponse()
        response.say("Thank you for your time! Your interview has been completed successfully. We will review your responses and get back to you soon. Have a great day!", voice='Polly.Aditi')  # Changed to Polly.Aditi
        response.hangup()
        return str(response)
    except Exception as e:
        print(f"[ERROR] Error completing interview for {call_sid}: {e}")
        response = VoiceResponse()
        response.say("Thank you for your time! We'll be in touch soon. Have a great day!", voice='Polly.Aditi')
        response.hangup()
        return str(response)
def handle_error(message):
    try:
        response = VoiceResponse()
        response.say(message, voice='Polly.Aditi')
        response.hangup()
        return str(response)
    except Exception as e:
        print(f"[ERROR] Error in handle_error: {e}")
        return '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi">Sorry, there was an error. Goodbye.</Say><Hangup/>'
def create_error_response(message):
    try:
        response = VoiceResponse()
        response.say(message)
        response.hangup()
        return str(response)
    except Exception as e:
        print(f"[ERROR] Error creating error response: {e}")
        return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, there was an error. Goodbye.</Say><Hangup/>'
def save_completed_interview(call_sid, responses):
    try:
        interview_data = {
            "interview_id": call_sid,
            "responses": responses,
            "total_questions": len(INTERVIEW_QUESTIONS),
            "completion_time": datetime.now().isoformat(),
            "status": "COMPLETED"
        }
        os.makedirs("interviews", exist_ok=True)
        filename = f"interviews/{call_sid}_COMPLETED_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(interview_data, f, indent=2)
        print(f"[SAVED] Interview {call_sid} completed and saved to {filename}")
        return filename
    except Exception as e:
        print(f"[ERROR] Failed to save completed interview {call_sid}: {e}")
        return None
def save_incomplete_interview(call_sid: str, interview_data: dict, termination_reason: str):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Different summary based on termination reason
        if termination_reason == "not_available":
            interview_type = "Interview Not Started - Candidate Unavailable"
            status = "NOT_STARTED"
        else:
            interview_type = "Terminated Interview - Validation Failed"
            status = "TERMINATED"
        
        summary = {
            "interview_id": call_sid,
            "company": "Onelab Ventures",
            "interviewer": "AI Assistant with Validation",
            "completion_time": timestamp,
            "status": status,
            "termination_reason": termination_reason,
            "questions_answered": len(interview_data.get("responses", [])),
            "total_questions": len(INTERVIEW_QUESTIONS),
            "responses": interview_data.get("responses", []),
            "validation_results": interview_data.get("validation_results", {}),
            "start_time": interview_data.get("start_time", ""),
            "end_time": datetime.now().isoformat(),
            "interview_type": interview_type,
            "candidate_name": interview_data.get("candidate_name", "Unknown"),
            "candidate_phone": interview_data.get("candidate_phone", "Unknown"),
            "bulk_call_id": interview_data.get("bulk_call_id"),
            "is_bulk_call": interview_data.get("is_bulk_call", False)
        }
        
        summary_filename = f"interviews/{call_sid}_ONELAB_{status}_{timestamp}.json"
        with open(summary_filename, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"Saved {status.lower()} interview: {summary_filename}")
        
    except Exception as e:
        print(f"Error saving {status.lower()} interview: {e}")
@app.get("/interviews")
async def get_interviews():
    try:
        interviews = []
        pattern = "interviews/*_ONELAB_*.json"
        files = glob.glob(pattern)     
        for file_path in files:
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    interviews.append({
                        "interview_id": data.get("interview_id", "unknown"),
                        "status": data.get("status", "unknown"),
                        "questions_answered": data.get("questions_answered", 0),
                        "total_questions": data.get("total_questions", 7),
                        "completion_time": data.get("completion_time", ""),
                        "all_validations_passed": data.get("all_validations_passed", False),
                        "termination_reason": data.get("termination_reason", None),
                        "responses": data.get("responses", [])
                    })
            except Exception as e:
                print(f"Error loading interview file {file_path}: {e}")
                continue   
        for call_sid in list(conversation_state.keys()):
            session_data = load_interview_session(call_sid)
            if session_data:
                interviews.append({
                    "interview_id": call_sid,
                    "status": session_data.get("status", "IN_PROGRESS"),
                    "questions_answered": len(session_data.get("responses", [])),
                    "total_questions": len(INTERVIEW_QUESTIONS),
                    "completion_time": session_data.get("start_time", ""),
                    "all_validations_passed": all(v.get('passed', True) for v in session_data.get('validation_results', {}).values()),
                    "termination_reason": None,
                    "responses": session_data.get("responses", [])
                })    
        interviews.sort(key=lambda x: x["completion_time"], reverse=True)
        return {"interviews": interviews}       
    except Exception as e:
        return {"error": str(e), "interviews": []}
@app.post("/run-jd-analysis")
async def run_jd_analysis_endpoint():
    try:
        report = run_jd_analysis()
        return report
    except Exception as e:
        return {"error": str(e)}
@app.get("/jd-report/{call_id}")
async def get_jd_report(call_id: str):
    try:
        pattern = f"interviews/*{call_id}*JD_*ANALYSIS*.json"
        files = glob.glob(pattern)      
        if files:
            latest_file = max(files, key=os.path.getmtime)
            with open(latest_file, 'r') as f:
                return json.load(f)
        else:
            return {"error": "JD report not found"}        
    except Exception as e:
        return {"error": str(e)}
@app.get("/test-aws")
async def test_aws_services():
    try:
        s3_client.list_objects_v2(Bucket=S3_BUCKET, MaxKeys=1)
        transcribe_client.list_transcription_jobs(MaxResults=1)
        return {
            "success": True,
            "message": "AWS S3 and Transcribe services are accessible"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"AWS services error: {str(e)}"
        }
@app.get("/job-description")
async def get_job_description():
    try:
        try:
            from summary import load_job_description
            jd_config = load_job_description()
        except:
            jd_config = {
                "title": "Software Developer",
                "company": "Onelab Ventures",
                "description": "Software Developer position at Onelab Ventures",
                "required_skills": ["python", "javascript", "react"],
                "experience_required": "2-5 years"
            }       
        response_data = {
            "title": jd_config.get("title", "Software Developer"),
            "company": jd_config.get("company", "Onelab Ventures"),
            "description": jd_config.get("description", "Software Developer position"),
            "required_skills": ", ".join(jd_config.get("required_skills", [])),
            "experience_required": jd_config.get("experience_required", "2-5 years")
        }      
        return response_data     
    except Exception as e:
        print(f"GET JD Error: {e}")
        return {
            "title": "Software Developer",
            "company": "Onelab Ventures", 
            "description": "Software Developer position",
            "required_skills": "python, javascript, react",
            "experience_required": "2-5 years"
        }
@app.post("/update-job-description")
async def update_job_description(request: Request):
    try:
        jd_data = await request.json()
        print(f"Updating JD with: {jd_data}") 
        skills_text = jd_data.get("required_skills", "")
        if isinstance(skills_text, str):
            skills_list = [skill.strip() for skill in skills_text.split(",") if skill.strip()]
        else:
            skills_list = skills_text 
        jd_config = {
            "title": jd_data.get("title", "Software Developer"),
            "company": jd_data.get("company", "Onelab Ventures"),
            "description": jd_data.get("description", ""),
            "required_skills": skills_list,
            "experience_required": jd_data.get("experience_required", "2-5 years")}  
        try:
            with open("current_jd.json", "w") as f:
                json.dump(jd_config, f, indent=2)
            print("JD saved successfully")
        except Exception as save_error:
            print(f"Error saving JD: {save_error}")
        try:
            from summary import save_job_description
            save_job_description(jd_config)
        except Exception as summary_error:
            print(f"Summary.py update failed: {summary_error}")
        return {
            "success": True,
            "message": "Job Description updated successfully",
            "updated_data": jd_config}
    except Exception as e:
        print(f"JD Update Error: {e}")
        return {"success": False, "error": str(e)}
@app.get("/all-interviews")
async def get_all_interviews():
    try:
        all_interviews = []
        interview_folder = "interviews"
        if os.path.exists(interview_folder):
            json_files = glob.glob(f"{interview_folder}/*.json")
            for file_path in json_files:
                if "session_" in file_path:
                    continue   
                try:
                    with open(file_path, 'r') as f:
                        interview_data = json.load(f)
                    filename = os.path.basename(file_path)
                    interview_id = interview_data.get("interview_id", filename.split('_')[0])
                    responses = interview_data.get("responses", [])
                    interview_summary = {
                        "interview_id": interview_id,
                        "status": interview_data.get("status", "COMPLETED"),
                        "questions_answered": len(responses),
                        "total_questions": interview_data.get("total_questions", 7),
                        "start_time": interview_data.get("start_time", ""),
                        "end_time": interview_data.get("end_time", ""),
                        "completion_time": interview_data.get("completion_time", ""),
                        "all_validations_passed": interview_data.get("all_validations_passed", False),
                        "termination_reason": interview_data.get("termination_reason", None),
                        "responses": responses
                    }
                    all_interviews.append(interview_summary)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
                    continue
        session_files = glob.glob("interviews/session_*.json")
        for session_file in session_files:
            try:
                call_sid = os.path.basename(session_file).replace("session_", "").replace(".json", "")
                session_data = load_interview_session(call_sid)               
                if session_data:
                    exists_in_files = any(interview["interview_id"] == call_sid for interview in all_interviews)   
                    if not exists_in_files:
                        interview_summary = {
                            "interview_id": call_sid,
                            "status": session_data.get("status", "IN_PROGRESS"),
                            "questions_answered": len(session_data.get("responses", [])),
                            "total_questions": len(INTERVIEW_QUESTIONS),
                            "start_time": session_data.get("start_time", ""),
                            "end_time": session_data.get("end_time", ""),
                            "completion_time": session_data.get("start_time", ""),
                            "all_validations_passed": all(v.get('passed', True) for v in session_data.get('validation_results', {}).values()),
                            "termination_reason": session_data.get("termination_reason", None),
                            "responses": session_data.get("responses", [])}                      
                        all_interviews.append(interview_summary)
            except Exception as e:
                print(f"Error reading session {session_file}: {e}")
                continue      
        all_interviews.sort(key=lambda x: x.get("start_time", ""), reverse=True)      
        return {"interviews": all_interviews}    
    except Exception as e:
        print(f"Error getting all interviews: {e}")
        return {"error": str(e), "interviews": []}
@app.get("/interviews-detailed")
async def get_all_interviews_detailed():
    try:
        all_interviews = []
        interview_folder = "interviews"
        if os.path.exists(interview_folder):
            json_files = glob.glob(f"{interview_folder}/*.json")
            for file_path in json_files:
                if "session_" in file_path:
                    continue
                try:
                    with open(file_path, 'r') as f:
                        interview_data = json.load(f)
                    filename = os.path.basename(file_path)
                    processed_interview = {
                        "call_sid": interview_data.get("call_sid") or interview_data.get("interview_id"),
                        "interview_id": interview_data.get("interview_id") or interview_data.get("call_sid"),
                        "phone_number": interview_data.get("phone_number") or interview_data.get("candidate_phone"),
                        "candidate_name": interview_data.get("candidate_name") or "Unknown Candidate",
                        "candidate_phone": interview_data.get("candidate_phone") or interview_data.get("phone_number"),
                        "twilio_number": interview_data.get("twilio_number", "+14787807480"),
                        "start_time": interview_data.get("start_time", ""),
                        "end_time": interview_data.get("end_time", ""),
                        "status": interview_data.get("status", "COMPLETED"),
                        "current_question": interview_data.get("current_question", len(interview_data.get("responses", []))),
                        "responses": interview_data.get("responses", []),
                        "validation_results": interview_data.get("validation_results", {}),
                        "questions_answered": len(interview_data.get("responses", [])),
                        "total_questions": interview_data.get("total_questions", 8),  # Updated to 8 questions
                        "completion_time": interview_data.get("completion_time", ""),
                        "all_validations_passed": interview_data.get("all_validations_passed", False),
                        "termination_reason": interview_data.get("termination_reason", None),
                        "silence_prompts": interview_data.get("silence_prompts", 0),
                        "last_activity": interview_data.get("last_activity", ""),
                        "bulk_call_id": interview_data.get("bulk_call_id"),
                        "is_bulk_call": interview_data.get("is_bulk_call", False)
                    }
                    all_interviews.append(processed_interview)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
                    continue
        session_files = glob.glob("interviews/session_*.json")
        for session_file in session_files:
            try:
                call_sid = os.path.basename(session_file).replace("session_", "").replace(".json", "")
                session_data = load_interview_session(call_sid)
                if session_data:
                    exists_in_files = any(interview["call_sid"] == call_sid for interview in all_interviews)
                    if not exists_in_files:
                        processed_session = {
                            "call_sid": call_sid,
                            "interview_id": call_sid,
                            "phone_number": session_data.get("phone_number") or session_data.get("candidate_phone"),
                            "candidate_name": session_data.get("candidate_name", "Unknown Candidate"),
                            "candidate_phone": session_data.get("candidate_phone") or session_data.get("phone_number"),
                            "twilio_number": session_data.get("twilio_number", "+14787807480"),
                            "start_time": session_data.get("start_time", ""),
                            "end_time": session_data.get("end_time", ""),
                            "status": session_data.get("status", "IN_PROGRESS"),
                            "current_question": session_data.get("current_question", 1),
                            "responses": session_data.get("responses", []),
                            "validation_results": session_data.get("validation_results", {}),
                            "questions_answered": len(session_data.get("responses", [])),
                            "total_questions": len(INTERVIEW_QUESTIONS),
                            "completion_time": session_data.get("start_time", ""),
                            "all_validations_passed": all(v.get('passed', True) for v in session_data.get('validation_results', {}).values()),
                            "termination_reason": session_data.get("termination_reason", None),
                            "silence_prompts": session_data.get("silence_prompts", 0),
                            "last_activity": session_data.get("last_activity", ""),
                            "bulk_call_id": session_data.get("bulk_call_id"),
                            "is_bulk_call": session_data.get("is_bulk_call", False)
                        }
                        all_interviews.append(processed_session)
            except Exception as e:
                print(f"Error reading session {session_file}: {e}")
                continue
        all_interviews.sort(key=lambda x: x.get("start_time", ""), reverse=True)
        print(f"📋 Returning {len(all_interviews)} interviews")
        if all_interviews:
            print(f"📊 Sample interview: {all_interviews[0]}")
        return {
            "success": True,
            "interviews": all_interviews,
            "total_count": len(all_interviews),
            "completed_count": len([i for i in all_interviews if i.get("status") == "COMPLETED"])
        }
    except Exception as e:
        print(f"Error getting all interviews: {e}")
        return {
            "success": False,
            "error": str(e),
            "interviews": [],
            "total_count": 0,
            "completed_count": 0
        }
def terminate_interview(call_sid: str, reason_code: str, reason_message: str):
    try:
        resp = VoiceResponse()
        
        # Different messages based on termination reason
        if reason_code == "not_available":
            resp.say(
                "No problem at all! We completely understand. We'll reach out to you at a more convenient time. Thank you and have a great day!",
                voice='Polly.Aditi', rate='medium')
        else:
            resp.say(
                "Thank you so much for taking the time to speak with us today. We really appreciate your interest. We'll review everything and get back to you soon. Have a wonderful day!",
                voice='Polly.Aditi', rate='medium')
        
        resp.hangup()
        
        interview_data = load_interview_session(call_sid)
        if interview_data:
            interview_data['status'] = 'TERMINATED'
            interview_data['termination_reason'] = reason_code
            interview_data['end_time'] = datetime.now().isoformat()
            save_interview_session(call_sid, interview_data)
            save_incomplete_interview(call_sid, interview_data, reason_code)
        
        conversation_state.pop(call_sid, None)
        print(f"[TERMINATED] Interview {call_sid} terminated due to: {reason_code}")
        return str(resp)
        
    except Exception as e:
        print(f"[ERROR] Error terminating interview for {call_sid}: {e}")
        return handle_error("Thank you for your time. Have a great day!")
def handle_speech(call_sid: str, speech_result: str, confidence: float):
    try:
        print(f"[SPEECH] Call {call_sid}: '{speech_result}'")       
        if not speech_result or speech_result.strip() == "":
            print(f"[SPEECH ERROR] Empty transcription for {call_sid}")
            return handle_no_response(call_sid)        
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            print(f"[ERROR] No interview session found for {call_sid}")
            return handle_error("Interview session not found")       
        
        current_question_index = interview_data.get('current_question', 0)  # Changed to start from 0
        questions = INTERVIEW_QUESTIONS 
        
        response_data = {
            'question': questions[current_question_index],
            'answer': speech_result,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat(),
            'question_number': current_question_index
        }     
        interview_data['responses'].append(response_data)
        interview_data['current_question'] = current_question_index + 1
        interview_data['last_activity'] = datetime.now().isoformat()
        interview_data['silence_prompts'] = 0       
        save_interview_session(call_sid, interview_data)      
        print(f"[PROGRESS] Call {call_sid}: Question {current_question_index}/{len(questions)} completed")
        
        # Validate responses for specific questions (now including step 0)
        if current_question_index in [0, 2, 3, 5, 6, 7, 8]:  # Added 0 for availability check
            should_continue, reason_code, reason_message = validate_response_selected_questions(call_sid, current_question_index, speech_result)
            print(f"Validation Q{current_question_index}: {'PASS' if should_continue else 'FAIL'} - {reason_message}")          
            
            if not should_continue:
                return terminate_interview(call_sid, reason_code, reason_message)
        
        # Check if all questions are completed (now 0-8 = 9 questions total)
        if current_question_index >= len(questions) - 1:
            print(f"[INTERVIEW COMPLETE] All {len(questions)} questions answered for {call_sid}")
            return complete_interview(call_sid)
        else:
            next_question_index = current_question_index + 1
            print(f"[NEXT] Moving to question {next_question_index} for {call_sid}")
            return ask_next_question_immediately(call_sid, next_question_index)
    except Exception as e:
        print(f"[ERROR] Error handling speech for {call_sid}: {e}")
        return handle_error("Sorry, there was an error processing your response.")
@app.post("/make-call")
async def make_call(request: Request):
    try:
        data = await request.json()
        phone_number = data.get("phone_number")
        candidate_name = data.get("name", "Test Candidate")
        if not phone_number:
            return {"error": "Phone number is required"}
        call = client.calls.create(
            url=f"{WEBHOOK_BASE_URL}/voice",
            to=phone_number,
            from_="+14787807480",
            record=True,
            recording_channels="dual",
            recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
        )
        print(f"Call initiated with recording: {call.sid} to {phone_number}")
        contact_mappings_file = "contact_mappings.json"
        try:
            if os.path.exists(contact_mappings_file):
                with open(contact_mappings_file, 'r') as f:
                    all_mappings = json.load(f)
            else:
                all_mappings = {}
            all_mappings[call.sid] = {
                "candidate_name": candidate_name,
                "candidate_phone": phone_number,
                "is_bulk_call": False,
                "recording_enabled": True
            }
            with open(contact_mappings_file, 'w') as f:
                json.dump(all_mappings, f, indent=2)
        except Exception as mapping_error:
            print(f"Error storing contact mapping: {mapping_error}")
        return {
            "success": True,
            "call_sid": call.sid,
            "status": call.status,
            "phone_number": phone_number,
            "candidate_name": candidate_name,
            "recording_enabled": True,
            "message": f"Call initiated to {phone_number} with high-accuracy recording enabled"
        }
    except Exception as e:
        return {"error": f"Failed to make call: {str(e)}"}
@app.post("/recording-status")
async def recording_status(request: Request):
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid")
        recording_status = form_data.get("RecordingStatus")
        print(f"[RECORDING STATUS] Call {call_sid}: {recording_status}")
        return Response("", media_type="application/xml")
    except Exception as e:
        print(f"[ERROR] Recording status error: {e}")
        return Response("", media_type="application/xml")
@app.post("/recording/{call_sid}")
async def handle_recording(call_sid: str, request: Request):
    try:
        form_data = await request.form()
        recording_url = form_data.get('RecordingUrl')
        recording_sid = form_data.get('RecordingSid')
        recording_duration = form_data.get('RecordingDuration', '0')
        print(f"[RECORDING] Call {call_sid}: Recording available at {recording_url}")
        if recording_url:
            executor.submit(download_and_save_recording, call_sid, recording_url, recording_sid, recording_duration)
        return Response("", media_type="application/xml")
    except Exception as e:
        print(f"[ERROR] Recording handler error for {call_sid}: {e}")
        return Response("", media_type="application/xml")
def download_and_save_recording(call_sid: str, recording_url: str, recording_sid: str, duration: str):
    try:
        import requests
        import time
        max_wait_attempts = 12
        wait_interval = 10
        for attempt in range(max_wait_attempts):
            try:
                download_urls = [
                    f"{recording_url}.wav",
                    f"{recording_url}.mp3",
                    recording_url,
                    f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Recordings/{recording_sid}.wav",
                    f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Recordings/{recording_sid}.mp3"
                ]
                recording_downloaded = False
                final_audio_filename = None
                for url_attempt, download_url in enumerate(download_urls):
                    try:
                        response = requests.get(
                            download_url, 
                            auth=(account_sid, auth_token),
                            timeout=30,
                            headers={
                                'User-Agent': 'AI-Interviewer/1.0',
                                'Accept': 'audio/*'
                            }
                        )
                        if response.status_code == 200 and len(response.content) > 1000:
                            content_type = response.headers.get('content-type', '').lower()
                            if 'wav' in content_type or download_url.endswith('.wav'):
                                extension = '.wav'
                            elif 'mp3' in content_type or download_url.endswith('.mp3'):
                                extension = '.mp3'
                            else:
                                extension = '.wav'
                            audio_filename = f"interviews/audio_recordings/{call_sid}_{recording_sid}{extension}"
                            os.makedirs("interviews/audio_recordings", exist_ok=True)
                            with open(audio_filename, 'wb') as f:
                                f.write(response.content)
                            final_audio_filename = audio_filename
                            recording_downloaded = True
                            break
                        elif response.status_code == 404:
                            continue
                        else:
                            continue
                    except requests.RequestException:
                        continue
                if recording_downloaded and final_audio_filename:
                    try:
                        s3_key = f"recordings/{call_sid}_{recording_sid}{os.path.splitext(final_audio_filename)[1]}"
                        s3_client.upload_file(final_audio_filename, S3_BUCKET, s3_key)
                        start_transcription_job_indian(call_sid, s3_key, recording_sid)
                    except Exception:
                        pass
                    try:
                        interview_data = load_interview_session(call_sid)
                        if interview_data:
                            interview_data['recording_url'] = recording_url
                            interview_data['recording_sid'] = recording_sid
                            interview_data['recording_duration'] = duration
                            interview_data['audio_file'] = final_audio_filename
                            interview_data['s3_key'] = s3_key if 's3_key' in locals() else None
                            interview_data['recording_status'] = 'downloaded_successfully'
                            save_interview_session(call_sid, interview_data)
                    except Exception:
                        pass
                    return
                else:
                    if attempt < max_wait_attempts - 1:
                        time.sleep(wait_interval)  
            except Exception:
                if attempt < max_wait_attempts - 1:
                    time.sleep(wait_interval)
                continue   
        try:
            interview_data = load_interview_session(call_sid)
            if interview_data:
                interview_data['recording_url'] = recording_url
                interview_data['recording_sid'] = recording_sid
                interview_data['recording_duration'] = duration
                interview_data['recording_status'] = 'download_failed'
                interview_data['recording_error'] = 'Failed to download after multiple attempts'
                save_interview_session(call_sid, interview_data)
        except Exception:
            pass       
    except Exception:
        pass
def start_transcription_job_indian(call_sid: str, s3_key: str, recording_sid: str):
    try:
        job_name = f"interview-{call_sid}-{recording_sid}-{int(time.time())}"
        job_uri = f"s3://{S3_BUCKET}/{s3_key}"
        file_extension = os.path.splitext(s3_key)[1].lower()
        if file_extension == '.wav':
            media_format = 'wav'
        elif file_extension == '.mp3':
            media_format = 'mp3'
        elif file_extension == '.mp4':
            media_format = 'mp4'
        else:
            media_format = 'wav'   
        transcribe_response = transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={'MediaFileUri': job_uri},
            MediaFormat=media_format,
            LanguageCode='en-IN',
            OutputBucketName=S3_BUCKET,
            OutputKey=f"transcripts/{call_sid}_aws_transcript.json",
            Settings={
                'VocabularyFilterName': None,
                'ShowSpeakerLabels': True,
                'MaxSpeakerLabels': 2,
                'ChannelIdentification': False,
                'ShowAlternatives': True,
                'MaxAlternatives': 5,
                'VocabularyFilterMethod': 'remove'
            }
        )
        executor.submit(poll_transcription_job_fast_indian, call_sid, job_name, recording_sid)
    except Exception:
        pass
def poll_transcription_job_fast_indian(call_sid: str, job_name: str, recording_sid: str):
    try:
        max_attempts = 120
        for attempt in range(max_attempts):
            time.sleep(5)
            try:
                response = transcribe_client.get_transcription_job(TranscriptionJobName=job_name)
                status = response['TranscriptionJob']['TranscriptionJobStatus']
                if status == 'COMPLETED':
                    transcript_uri = response['TranscriptionJob']['Transcript']['TranscriptFileUri']
                    import requests
                    transcript_response = requests.get(transcript_uri, timeout=30)
                    if transcript_response.status_code == 200:
                        transcript_data = transcript_response.json()
                        full_transcript = transcript_data['results']['transcripts'][0]['transcript']
                        transcript_filename = f"interviews/transcriptions/{call_sid}_{recording_sid}_aws_indian_transcript.txt"
                        os.makedirs("interviews/transcriptions", exist_ok=True)                       
                        with open(transcript_filename, 'w', encoding='utf-8') as f:
                            f.write(f"Call ID: {call_sid}\n")
                            f.write(f"Recording SID: {recording_sid}\n")
                            f.write(f"AWS Transcribe Job: {job_name}\n")
                            f.write(f"Language: Indian English (en-IN)\n")
                            f.write(f"Completion Date: {datetime.now().isoformat()}\n")
                            f.write(f"\n--- HIGH-ACCURACY INDIAN ENGLISH TRANSCRIPT ---\n")
                            f.write(full_transcript)
                            f.write(f"\n\n--- RAW JSON DATA ---\n")
                            f.write(json.dumps(transcript_data, indent=2, ensure_ascii=False))
                        interview_data = load_interview_session(call_sid)
                        if interview_data:
                            interview_data['aws_transcript'] = full_transcript
                            interview_data['aws_transcript_file'] = transcript_filename
                            interview_data['transcription_completed'] = datetime.now().isoformat()
                            save_interview_session(call_sid, interview_data)                        
                    break                   
                elif status == 'FAILED':
                    break                   
            except Exception:
                continue               
    except Exception:
        pass
@app.post("/transcription/{call_sid}")
async def handle_transcription(call_sid: str, request: Request):
    try:
        form_data = await request.form()
        transcription_text = form_data.get('TranscriptionText', '')
        transcription_status = form_data.get('TranscriptionStatus', '')
        confidence = form_data.get('TranscriptionConfidence', '0.0')
        print(f"[TWILIO TRANSCRIPTION] Call {call_sid}: Status={transcription_status}, Confidence={confidence}")
        if transcription_text and transcription_status == 'completed':
            transcript_filename = f"interviews/transcriptions/{call_sid}_twilio_backup_transcript.txt"
            os.makedirs("interviews/transcriptions", exist_ok=True)           
            with open(transcript_filename, 'w', encoding='utf-8') as f:
                f.write(f"Call ID: {call_sid}\n")
                f.write(f"Transcription Date: {datetime.now().isoformat()}\n")
                f.write(f"Status: {transcription_status}\n")
                f.write(f"Confidence: {confidence}\n")
                f.write(f"Source: Twilio (Backup)\n")
                f.write(f"\n--- TWILIO BACKUP TRANSCRIPT ---\n")
                f.write(transcription_text)          
            print(f"[TWILIO TRANSCRIPT SAVED] {transcript_filename}")      
        return Response("", media_type="application/xml")      
    except Exception as e:  # ADD THIS MISSING EXCEPT BLOCK
        print(f"[ERROR] Transcription handler error for {call_sid}: {e}")
        return Response("", media_type="application/xml")
@app.post("/voice")
async def handle_voice_call(request: Request):
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        from_number = form_data.get('From', 'unknown')
        to_number = form_data.get('To', '+14787807480')       
        print(f"[VOICE] Incoming call {call_sid} from {from_number}")
        
        # Load contact mapping for bulk calls
        contact_info = None
        try:
            contact_mappings_file = "contact_mappings.json"
            if os.path.exists(contact_mappings_file):
                with open(contact_mappings_file, 'r') as f:
                    all_mappings = json.load(f)
                contact_info = all_mappings.get(call_sid, {})
        except Exception as e:
            print(f"Error loading contact mapping: {e}")
        
        # Create interview session starting with question 0 (availability check)
        interview_data = {
            'call_sid': call_sid,
            'phone_number': from_number,
            'twilio_number': to_number,
            'start_time': datetime.now().isoformat(),
            'status': 'IN_PROGRESS',
            'current_question': 0,  # Changed: Start with availability check
            'responses': [],
            'validation_results': {},
            'silence_prompts': 0,
            'last_activity': datetime.now().isoformat()
        }
        
        # Add candidate info for bulk calls
        if contact_info:
            interview_data.update({
                'candidate_name': contact_info.get('candidate_name', 'Unknown'),
                'candidate_phone': contact_info.get('candidate_phone', from_number),
                'candidate_data': contact_info.get('candidate_data', ''),
                'bulk_call_id': contact_info.get('bulk_call_id'),
                'is_bulk_call': contact_info.get('is_bulk_call', False)
            })
        
        save_interview_session(call_sid, interview_data)
        conversation_state[call_sid] = interview_data       
        print(f"[VOICE] Interview session created for {call_sid}")
        
        # Start with availability check
        resp = VoiceResponse()
        resp.say("Hello! Thank you for your interest in our position. I'm your AI interviewer from Onelab Ventures.", 
                voice='Polly.Aditi', rate='medium')
        resp.pause(length=0.5)
        resp.say(INTERVIEW_QUESTIONS[0], voice='Polly.Aditi', rate='medium')  # Ask availability question
        
        gather = resp.gather(
            input='speech',
            action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
            method='POST',
            speechTimeout='auto',
            timeout='6',
            language='en-IN',
            enhanced=True,
            profanityFilter=False,
            speechModel='experimental_conversations'
        )
        resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')
        return Response(str(resp), media_type="application/xml")
    except Exception as e:
        print(f"[ERROR] Voice call handler error: {e}")
        resp = VoiceResponse()
        resp.say("Sorry, there was an error. Please try again later.", voice='Polly.Aditi')
        resp.hangup()
        return Response(str(resp), media_type="application/xml")
@app.post("/voice/speech/{call_sid}")
async def handle_voice_speech(call_sid: str, request: Request):
    try:
        form_data = await request.form()
        speech_result = form_data.get('SpeechResult', '')
        confidence = float(form_data.get('Confidence', '0.0'))
        print(f"[SPEECH] Call {call_sid}: '{speech_result}' (confidence: {confidence})")
        response_xml = handle_speech(call_sid, speech_result, confidence)
        return Response(response_xml, media_type="application/xml")
    except Exception as e:
        print(f"[ERROR] Speech handler error for {call_sid}: {e}")
        return Response(handle_error("Sorry, there was an error processing your response."), 
                       media_type="application/xml")
@app.post("/voice/no-response/{call_sid}")
async def handle_voice_no_response(call_sid: str, request: Request):
    try:
        print(f"[NO RESPONSE] Call {call_sid}")
        response_xml = handle_no_response(call_sid)
        return Response(response_xml, media_type="application/xml")
    except Exception as e:
        print(f"[ERROR] No response handler error for {call_sid}: {e}")
        return Response(handle_error("Sorry, there was an error."), 
                       media_type="application/xml")
@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.csv'):
            return {"success": False, "error": "Please upload a CSV file"}
        content = await file.read()
        csv_string = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_string))
        candidates = []
        for row in csv_reader:
            name = row.get('name', '').strip()
            phone = row.get('phone', '').strip()
            if name and phone:
                if not phone.startswith('+'):
                    phone = f"+91{phone}"
                candidates.append({
                    "name": name,
                    "phone": phone
                })
        if not candidates:
            return {"success": False, "error": "No valid candidates found in CSV"}
        return {
            "success": True,
            "message": f"Successfully parsed {len(candidates)} candidates",
            "contacts": candidates,
            "count": len(candidates)
        }
    except Exception as e:
        print(f"[ERROR] CSV upload failed: {e}")
        return {"success": False, "error": f"Failed to process CSV: {str(e)}"}
@app.post("/bulk-call")
async def make_bulk_calls(request: Request):
    try:
        data = await request.json()
        candidates = data if isinstance(data, list) else data.get("candidates", [])
        if not candidates:
            return {"success": False, "error": "No candidates provided"}
        results = []
        bulk_call_id = f"bulk_{int(time.time())}"
        for candidate in candidates:
            try:
                name = candidate.get("name", "Unknown")
                phone = candidate.get("phone", "")
                if not phone:
                    results.append({
                        "name": name,
                        "phone": phone,
                        "success": False,
                        "error": "No phone number provided"
                    })
                    continue
                call = client.calls.create(
                    url=f"{WEBHOOK_BASE_URL}/voice",
                    to=phone,
                    from_="+14787807480",
                    record=True,
                    recording_channels="dual",
                    recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
                )
                contact_mappings_file = "contact_mappings.json"
                try:
                    if os.path.exists(contact_mappings_file):
                        with open(contact_mappings_file, 'r') as f:
                            all_mappings = json.load(f)
                    else:
                        all_mappings = {}
                    all_mappings[call.sid] = {
                        "candidate_name": name,
                        "candidate_phone": phone,
                        "is_bulk_call": True,
                        "bulk_call_id": bulk_call_id,
                        "recording_enabled": True,
                        "speech_only": True
                    }
                    with open(contact_mappings_file, 'w') as f:
                        json.dump(all_mappings, f, indent=2)
                except Exception as mapping_error:
                    print(f"Error storing contact mapping: {mapping_error}")
                results.append({
                    "name": name,
                    "phone": phone,
                    "success": True,
                    "call_sid": call.sid,
                    "status": call.status
                })
                print(f"[BULK CALL] {name} ({phone}): {call.sid}")
                
            except Exception as call_error:
                results.append({
                    "name": candidate.get("name", "Unknown"),
                    "phone": candidate.get("phone", ""),
                    "success": False,
                    "error": str(call_error)
                })
        successful_calls = len([r for r in results if r["success"]])
        return {
            "success": True,
            "bulk_call_id": bulk_call_id,
            "total_candidates": len(candidates),
            "successful_calls": successful_calls,
            "failed_calls": len(candidates) - successful_calls,
            "results": results
        }   
    except Exception as e:
        print(f"[ERROR] Bulk call failed: {e}")
        return {"success": False, "error": str(e)}