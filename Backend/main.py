from fastapi import FastAPI, Request, BackgroundTasks, UploadFile, File
from fastapi.responses import Response
import os
import json
import boto3
import time
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
    1: "Introduce yourself.",
    2: "What are your key skills for this role?",
    3: "Are you open to relocation or looking for remote work?",
    4: "The first interview round will be on-site. Can you attend in person?",
    5: "What is your current notice period?",
    6: "What is your current CTC and expected salary?",
    7: "If selected, how soon can you join?"}
def load_jd_skills():
    """Load skills from job description JSON file"""
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
        current_question_index = interview_data.get('current_question', 1)
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
        if current_question_index in [2, 3, 4, 5]:
            should_continue, reason_code, reason_message = validate_response_selected_questions(call_sid, current_question_index, speech_result)
            print(f"Validation Q{current_question_index}: {'PASS' if should_continue else 'FAIL'} - {reason_message}")          
            if not should_continue:
                return terminate_interview(call_sid, reason_code, reason_message)
        if current_question_index >= len(questions):
            print(f"[INTERVIEW COMPLETE] All {len(questions)} questions answered for {call_sid}")
            return complete_interview(call_sid)
        else:
            next_question_index = current_question_index + 1
            print(f"[NEXT] Moving to question {next_question_index} for {call_sid}")
            return ask_next_question_immediately(call_sid, next_question_index)      
    except Exception as e:
        print(f"[ERROR] Error handling speech for {call_sid}: {e}")
        return handle_error("Sorry, there was an error processing your response.")
def validate_response_instantly(call_sid: str, step: int, transcription: str):
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return True, "continue", "No state found"      
        validation_result = {"step": step, "passed": True, "reason": ""}
        if step == 2:
            skills_match, found_skills, match_percentage = check_skills_match(transcription)
            validation_result["skills_match"] = skills_match
            validation_result["found_skills"] = found_skills
            validation_result["match_percentage"] = match_percentage
            if not skills_match:
                validation_result["passed"] = False
                validation_result["reason"] = f"Insufficient skills match ({match_percentage:.1f}%)"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "skills_mismatch", f"Skills match only {match_percentage:.1f}%"      
        elif step == 3:
            relocation_ok, sentiment = check_relocation_willingness(transcription)
            validation_result["relocation_willing"] = relocation_ok
            validation_result["sentiment"] = sentiment
            if not relocation_ok:
                validation_result["passed"] = False
                validation_result["reason"] = "Not willing to relocate"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "relocation_issue", "Not open to relocation"     
        elif step == 4:
            onsite_ok, sentiment = check_onsite_availability(transcription)
            validation_result["onsite_available"] = onsite_ok
            validation_result["sentiment"] = sentiment
            if not onsite_ok:
                validation_result["passed"] = False
                validation_result["reason"] = "Cannot attend onsite interview"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "onsite_unavailable", "Cannot attend onsite interview"      
        elif step == 5:
            notice_ok, days, notice_type = check_notice_period(transcription)
            validation_result["notice_acceptable"] = notice_ok
            validation_result["notice_days"] = days
            validation_result["notice_type"] = notice_type
            if not notice_ok:
                validation_result["passed"] = False
                validation_result["reason"] = f"Notice period too long ({days} days)"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "notice_too_long", f"Notice period {days} days exceeds 30 days"
        if "validation_results" not in interview_data:
            interview_data["validation_results"] = {}
        interview_data["validation_results"][step] = validation_result
        save_interview_session(call_sid, interview_data)      
        return True, "continue", "Validation passed"      
    except Exception as e:
        print(f"[ERROR] Validation error for {call_sid}, step {step}: {e}")
        return True, "continue", "Validation error - continuing"
def ask_next_question_immediately(call_sid: str, question_index: int):
    try:
        if question_index > len(INTERVIEW_QUESTIONS):
            return complete_interview(call_sid)      
        question = INTERVIEW_QUESTIONS[question_index]     
        resp = VoiceResponse()
        
        if question_index > 1:
            resp.say("Next question:", voice='Polly.Amy', rate='medium')
            resp.pause(length=0.2)  # Reduced from 0.3
        
        resp.say(question, voice='Polly.Amy', rate='medium')
        
        gather = resp.gather(
            input='speech',
            action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
            method='POST',
            speechTimeout='8',  # Reduced from 10
            timeout='4',        # Reduced from 5
            language='en-US')
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
        current_question_index = interview_data.get('current_question', 1)        
        
        if silence_prompts >= 1:
            resp = VoiceResponse()
            resp.say("Thank you for your time. We'll be in touch soon.", voice='Polly.Amy')
            resp.hangup()           
            
            interview_data['status'] = 'INCOMPLETE_SILENCE'
            interview_data['end_time'] = datetime.now().isoformat()
            save_interview_session(call_sid, interview_data)          
            
            return str(resp)
        
        interview_data['silence_prompts'] = silence_prompts + 1
        save_interview_session(call_sid, interview_data)      
        
        resp = VoiceResponse()
        resp.say("Please respond to the question.", voice='Polly.Amy', rate='medium')
        
        if current_question_index <= len(INTERVIEW_QUESTIONS):
            resp.pause(length=0.3)  # Reduced from 0.5
            resp.say(INTERVIEW_QUESTIONS[current_question_index], voice='Polly.Amy', rate='medium')
            
            gather = resp.gather(
                input='speech',
                action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
                method='POST',
                speechTimeout='6',  # Reduced from 8
                timeout='3',        # Reduced from 4
                language='en-US'
            )           
            resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')        
        
        return str(resp)      
    except Exception as e:
        return handle_error("Technical difficulty occurred.")
@app.post("/voice")
async def voice_response(request: Request):
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid")
        caller_phone = form_data.get("From")  # Get the phone number being called
        called_phone = form_data.get("To")    # Get our Twilio number
        
        interview_data = {
            "interview_id": call_sid,
            "current_question": 1,
            "responses": [],
            "silence_prompts": 0,
            "start_time": datetime.now().isoformat(),
            "validation_results": {},
            "status": "IN_PROGRESS",
            "phone_number": caller_phone,  # Store the caller's phone number
            "twilio_number": called_phone  # Store our Twilio number
        }
        save_interview_session(call_sid, interview_data)    
        
        resp = VoiceResponse()
        resp.pause(length=0.3)  # Reduced from 0.5
        resp.say("Hello! I'm your AI interviewer from Onelab Ventures.", voice='Polly.Amy', rate='medium')
        resp.pause(length=0.2)  # Reduced from 0.5
        resp.say("Let's begin.", voice='Polly.Amy', rate='medium')
        resp.pause(length=0.2)  # Reduced from 0.3
        resp.say(INTERVIEW_QUESTIONS[1], voice='Polly.Amy', rate='medium')
        
        gather = resp.gather(
            input='speech',
            action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
            method='POST',
            speechTimeout='8',  # Reduced from 10
            timeout='4',        # Reduced from 5
            language='en-US')
        resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')
        
        return Response(str(resp), media_type="application/xml")      
    except Exception as e:
        print(f"[ERROR] Voice response error: {e}")
        return Response(handle_error("Sorry, there was an error starting the interview."), media_type="application/xml")
@app.post("/voice/speech/{call_sid}")
async def speech_handler(call_sid: str, request: Request):
    try:
        form_data = await request.form()
        speech_result = form_data.get('SpeechResult', '').strip()
        confidence = float(form_data.get('Confidence', 0.0))
        print(f"[SPEECH HANDLER] Call {call_sid}: '{speech_result}' (confidence: {confidence})")
        if speech_result.lower() in ['skip', 'next', 'pass', 'move on', 'next question']:
            print(f"[SKIP] User requested to skip question for {call_sid}")
            interview_data = load_interview_session(call_sid)
            if interview_data:
                current_question_index = interview_data.get('current_question', 1)
                response_data = {
                    'question': INTERVIEW_QUESTIONS.get(current_question_index, ''),
                    'answer': '[SKIPPED]',
                    'confidence': 1.0,
                    'timestamp': datetime.now().isoformat(),
                    'question_number': current_question_index
                }              
                interview_data['responses'].append(response_data)
                interview_data['current_question'] = current_question_index + 1
                interview_data['silence_prompts'] = 0
                save_interview_session(call_sid, interview_data)
                if current_question_index >= len(INTERVIEW_QUESTIONS):
                    return Response(complete_interview(call_sid), media_type="application/xml")
                else:
                    return Response(ask_next_question_immediately(call_sid, current_question_index + 1), media_type="application/xml")
        return Response(handle_speech(call_sid, speech_result, confidence), media_type="application/xml")     
    except Exception as e:
        print(f"[ERROR] Speech handler error for {call_sid}: {e}")
        return Response(handle_error("Sorry, there was an error processing your response."), media_type="application/xml")
def complete_interview(call_sid):
    """Complete the interview and save results"""
    try:
        print(f"[DEBUG] Completing interview for {call_sid}")
        
        # Load from session file instead of conversation_state
        interview_data = load_interview_session(call_sid)
        
        if not interview_data:
            print(f"[ERROR] No interview session found for {call_sid}")
            # Create minimal data if session not found
            interview_data = {
                "interview_id": call_sid,
                "responses": [],
                "status": "COMPLETED",
                "start_time": datetime.now().isoformat(),
                "phone_number": "unknown",
                "twilio_number": "+14067601762"
            }
        responses = interview_data.get("responses", [])
        print(f"[DEBUG] Found {len(responses)} responses for {call_sid}")
        interview_data["status"] = "COMPLETED"
        interview_data["end_time"] = datetime.now().isoformat()
        interview_data["completion_time"] = datetime.now().isoformat()
        if "phone_number" not in interview_data:
            interview_data["phone_number"] = "unknown"
        if "twilio_number" not in interview_data:
            interview_data["twilio_number"] = "+14067601762"
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
        response.say("Thank you for your time! Your interview has been completed successfully. We will review your responses and get back to you soon. Have a great day!")
        response.hangup()
        return str(response)
    except Exception as e:
        print(f"[ERROR] Error completing interview for {call_sid}: {e}")
        response = VoiceResponse()
        response.say("Thank you for your time! We'll be in touch soon. Have a great day!")
        response.hangup()
        return str(response)
def handle_error(message):
    try:
        response = VoiceResponse()
        response.say(message)
        response.hangup()
        return str(response)
    except Exception as e:
        print(f"[ERROR] Error in handle_error: {e}")
        return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, there was an error. Goodbye.</Say><Hangup/>'
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
        summary = {
            "interview_id": call_sid,
            "company": "Onelab Ventures",
            "interviewer": "AI Assistant with Validation",
            "completion_time": timestamp,
            "status": "TERMINATED",
            "termination_reason": termination_reason,
            "questions_answered": len(interview_data.get("responses", [])),
            "total_questions": len(INTERVIEW_QUESTIONS),
            "responses": interview_data.get("responses", []),
            "validation_results": interview_data.get("validation_results", {}),
            "start_time": interview_data.get("start_time", ""),
            "end_time": datetime.now().isoformat(),
            "interview_type": "Terminated Interview - Validation Failed"}      
        summary_filename = f"interviews/{call_sid}_ONELAB_TERMINATED_{timestamp}.json"
        with open(summary_filename, 'w') as f:
            json.dump(summary, f, indent=2)       
        print(f"Saved terminated interview: {summary_filename}")      
    except Exception as e:
        print(f"Error saving terminated interview: {e}")
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
                        "responses": responses}
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
@app.get("/interview-details/{interview_id}")
async def get_interview_details(interview_id: str):
    try:
        print(f"Getting details for interview: {interview_id}")
        session_data = load_interview_session(interview_id)
        if session_data:
            responses = session_data.get("responses", [])
            interview_details = {
                "interview_id": interview_id,
                "status": session_data.get("status", "IN_PROGRESS"),
                "questions_answered": len(responses),
                "total_questions": len(INTERVIEW_QUESTIONS),
                "start_time": session_data.get("start_time", ""),
                "end_time": session_data.get("end_time", ""),
                "all_validations_passed": all(v.get('passed', True) for v in session_data.get('validation_results', {}).values()),
                "termination_reason": session_data.get("termination_reason", None),
                "responses": responses,
                "source": "session"
            }
            return interview_details
        interview_folder = "interviews"
        if os.path.exists(interview_folder):
            file_patterns = [
                f"{interview_folder}/{interview_id}_ONELAB_*.json",
                f"{interview_folder}/*_{interview_id}_*.json",
                f"{interview_folder}/*{interview_id}*.json"
            ]
            for pattern in file_patterns:
                files = glob.glob(pattern)
                if files:
                    file_path = files[0]
                    with open(file_path, 'r') as f:
                        file_data = json.load(f)                   
                    responses = file_data.get("responses", [])
                    interview_details = {
                        "interview_id": interview_id,
                        "status": file_data.get("status", "COMPLETED"),
                        "questions_answered": len(responses),
                        "total_questions": file_data.get("total_questions", len(INTERVIEW_QUESTIONS)),
                        "start_time": file_data.get("start_time", ""),
                        "end_time": file_data.get("end_time", ""),
                        "completion_time": file_data.get("completion_time", ""),
                        "all_validations_passed": file_data.get("all_validations_passed", False),
                        "termination_reason": file_data.get("termination_reason", None),
                        "responses": responses,
                        "source": "file"}
                    return interview_details      
        return {"error": f"Interview {interview_id} not found"}      
    except Exception as e:
        print(f"Error getting interview details: {e}")
        return {"error": str(e)}
@app.get("/call-stats")
async def get_call_stats():
    try:
        all_interviews = []
        pattern = "interviews/*_ONELAB_*.json"
        files = glob.glob(pattern)      
        for file_path in files:
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    all_interviews.append(data)
            except Exception as e:
                continue
        session_files = glob.glob("interviews/session_*.json")
        for session_file in session_files:
            try:
                call_sid = os.path.basename(session_file).replace("session_", "").replace(".json", "")
                session_data = load_interview_session(call_sid)
                if session_data:
                    all_interviews.append({
                        "status": session_data.get("status", "IN_PROGRESS"),
                        "questions_answered": len(session_data.get("responses", [])),
                        "total_questions": len(INTERVIEW_QUESTIONS),
                        "all_validations_passed": all(v.get('passed', True) for v in session_data.get('validation_results', {}).values())})
            except:
                continue 
        total_calls = len(all_interviews)
        completed_calls = len([i for i in all_interviews if i.get("status") == "COMPLETED"])       
        return {
            "totalCalls": total_calls,
            "completedCalls": completed_calls
        }      
    except Exception as e:
        return {"totalCalls": 0, "completedCalls": 0}
bulk_call_sessions = {}
@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.csv'):
            return {"success": False, "error": "Only CSV files are allowed"}      
        contents = await file.read()
        csv_data = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_data))      
        contacts = []
        for row in csv_reader:
            if 'name' in row and 'phone' in row:
                if row['name'].strip() and row['phone'].strip():
                    contact = {
                        "name": row['name'].strip(),
                        "phone": row['phone'].strip(),
                        "data": row.get('data', '').strip() if 'data' in row else ''}
                    contacts.append(contact)  
        if not contacts:
            return {"success": False, "error": "No valid contacts found in CSV"}      
        return {
            "success": True, 
            "contacts": contacts,
            "count": len(contacts),
            "message": f"Successfully loaded {len(contacts)} contacts"}     
    except Exception as e:
        return {"success": False, "error": f"Error processing CSV: {str(e)}"}
@app.post("/bulk-call")
async def bulk_call(contacts: List[dict], background_tasks: BackgroundTasks):
    try:
        bulk_call_id = f"bulk_{int(time.time())}"
        bulk_call_sessions[bulk_call_id] = {
            "contacts": contacts,
            "status": "STARTING",
            "current_index": 0,
            "results": [],
            "start_time": datetime.now().isoformat(),
            "total_contacts": len(contacts)
        }      
        background_tasks.add_task(process_bulk_calls, bulk_call_id, contacts)     
        return {
            "success": True,
            "bulk_call_id": bulk_call_id,
            "total_contacts": len(contacts),
            "message": "Bulk calling started"
        } 
    except Exception as e:
        return {"success": False, "error": str(e)}
@app.get("/bulk-call-status/{bulk_call_id}")
async def get_bulk_call_status(bulk_call_id: str):
    try:
        if bulk_call_id not in bulk_call_sessions:
            return {"error": "Bulk call session not found"} 
        session = bulk_call_sessions[bulk_call_id]
        return {
            "bulk_call_id": bulk_call_id,
            "status": session["status"],
            "current_index": session["current_index"],
            "total_contacts": session["total_contacts"],
            "completed_calls": len(session["results"]),
            "results": session["results"],
            "start_time": session["start_time"]
        }
    except Exception as e:
        return {"error": str(e)}
@app.post("/stop-bulk-call/{bulk_call_id}")
async def stop_bulk_call(bulk_call_id: str):
    try:
        if bulk_call_id in bulk_call_sessions:
            bulk_call_sessions[bulk_call_id]["status"] = "STOPPED"
            return {"success": True, "message": "Bulk calling stopped"}
        else:
            return {"success": False, "error": "Bulk call session not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}
async def process_bulk_calls(bulk_call_id: str, contacts: List[dict]):
    try:
        session = bulk_call_sessions[bulk_call_id]
        session["status"] = "IN_PROGRESS"      
        for index, contact in enumerate(contacts):
            if session["status"] == "STOPPED":
                break      
            session["current_index"] = index
            print(f"Starting call {index + 1}/{len(contacts)} to {contact['name']} at {contact['phone']}")         
            try:
                call = client.calls.create(
                    url=f"{WEBHOOK_BASE_URL}/voice",
                    to=contact["phone"],
                    from_="+14067601762"
                )              
                print(f"Call initiated: {call.sid}")
                call_completed = False
                timeout_seconds = 300
                check_interval = 10               
                for _ in range(timeout_seconds // check_interval):
                    try:
                        updated_call = client.calls(call.sid).fetch()
                        call_status = updated_call.status
                        print(f"Call {call.sid} status: {call_status}")                      
                        if call_status in ['completed', 'busy', 'failed', 'no-answer', 'canceled']:
                            call_completed = True
                            if call_status == 'completed':
                                result = {
                                    "contact": contact,
                                    "status": "SUCCESS",
                                    "call_sid": call.sid,
                                    "timestamp": datetime.now().isoformat(),
                                    "message": f"Call completed successfully (Status: {call_status})",
                                    "call_duration": str(updated_call.duration) if updated_call.duration else "0"
                                }
                            else:
                                result = {
                                    "contact": contact,
                                    "status": "FAILED",
                                    "call_sid": call.sid,
                                    "timestamp": datetime.now().isoformat(),
                                    "message": f"Call failed with status: {call_status}",
                                    "call_duration": "0"
                                }
                            break                          
                    except Exception as status_error:
                        print(f"Error checking call status: {status_error}")                   
                    await asyncio.sleep(check_interval)               
                if not call_completed:
                    try:
                        client.calls(call.sid).update(status='canceled')
                    except:
                        pass                  
                    result = {
                        "contact": contact,
                        "status": "FAILED",
                        "call_sid": call.sid,
                        "timestamp": datetime.now().isoformat(),
                        "message": "Call timed out after 5 minutes",
                        "call_duration": "0"
                    }                  
            except Exception as call_error:
                print(f"Error making call to {contact['phone']}: {call_error}")
                result = {
                    "contact": contact,
                    "status": "FAILED",
                    "call_sid": None,
                    "timestamp": datetime.now().isoformat(),
                    "message": f"Call initiation failed: {str(call_error)}",
                    "call_duration": "0"
                }          
            session["results"].append(result)
            print(f"Call {index + 1} completed: {result['status']}")
            if index < len(contacts) - 1 and session["status"] != "STOPPED":
                print(f"Waiting 15 seconds before next call...")
                await asyncio.sleep(15)     
        if session["status"] != "STOPPED":
            session["status"] = "COMPLETED"    
        session["end_time"] = datetime.now().isoformat()    
    except Exception as e:
        session["status"] = "ERROR"
        session["error"] = str(e)
        print(f"Bulk call processing error: {e}")
def check_skills_match_simple(transcript_text):
    text_lower = transcript_text.lower()
    jd_skills = load_jd_skills()
    found_skills = []
    for skill in jd_skills:
        skill_lower = skill.lower()
        if skill_lower in text_lower:
            found_skills.append(skill)
    has_skills = len(found_skills) > 0
    match_percentage = (len(found_skills) / len(jd_skills)) * 100 if jd_skills else 0
    return has_skills, found_skills, match_percentage
def check_relocation_simple(transcript_text):
    text_lower = transcript_text.lower()
    rejection_words = ["no", "not willing", "cannot", "can't", "not open", "remote only", "not interested"]
    for word in rejection_words:
        if word in text_lower:
            return False
    return True
def check_onsite_simple(transcript_text):
    text_lower = transcript_text.lower()
    rejection_words = ["no", "cannot", "can't", "not available", "remote only", "not possible"]  
    for word in rejection_words:
        if word in text_lower:
            return False  
    return True 
def check_notice_period_days(transcript_text):
    text_lower = transcript_text.lower()
    import re
    day_matches = re.findall(r'(\d+)\s*(?:days?|day)', text_lower)
    week_matches = re.findall(r'(\d+)\s*(?:weeks?|week)', text_lower)
    month_matches = re.findall(r'(\d+)\s*(?:months?|month)', text_lower)
    total_days = 0
    if day_matches:
        days = max([int(d) for d in day_matches])
        total_days = max(total_days, days)  
    if week_matches:
        weeks = max([int(w) for w in week_matches])
        total_days = max(total_days, weeks * 7) 
    if month_matches:
        months = max([int(m) for m in month_matches])
        total_days = max(total_days, months * 30)
    immediate_keywords = ["immediate", "immediately", "now", "asap", "no notice", "right away", "joining immediately"]
    for keyword in immediate_keywords:
        if keyword in text_lower:
            return True, 0
    if total_days == 0:
        return True, 15
    is_acceptable = total_days <= 30
    return is_acceptable, total_days
def validate_response_selected_questions(call_sid: str, step: int, transcription: str):
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return True, "continue", "No state found"      
        validation_result = {"step": step, "passed": True, "reason": ""}
        if step == 2:
            has_skills, found_skills, match_percentage = check_skills_match_simple(transcription)
            validation_result["skills_match"] = has_skills
            validation_result["found_skills"] = found_skills
            validation_result["match_percentage"] = match_percentage          
            if not has_skills:
                validation_result["passed"] = False
                validation_result["reason"] = "No relevant skills mentioned"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_skills", "No relevant skills found"
        elif step == 3:
            willing_to_relocate = check_relocation_simple(transcription)
            validation_result["relocation_willing"] = willing_to_relocate          
            if not willing_to_relocate:
                validation_result["passed"] = False
                validation_result["reason"] = "Not willing to relocate"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "relocation_no", "Not willing to relocate"
        elif step == 4:
            can_attend_onsite = check_onsite_simple(transcription)
            validation_result["onsite_available"] = can_attend_onsite          
            if not can_attend_onsite:
                validation_result["passed"] = False
                validation_result["reason"] = "Cannot attend onsite interview"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "onsite_no", "Cannot attend onsite interview"
        elif step == 5:
            notice_acceptable, notice_days = check_notice_period_days(transcription)
            validation_result["notice_acceptable"] = notice_acceptable
            validation_result["notice_days"] = notice_days         
            if not notice_acceptable:
                validation_result["passed"] = False
                validation_result["reason"] = f"Notice period too long ({notice_days} days > 30 days)"
                interview_data["validation_results"][step] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "notice_long", f"Notice period {notice_days} days exceeds 30 days"
        if "validation_results" not in interview_data:
            interview_data["validation_results"] = {}
        interview_data["validation_results"][step] = validation_result
        save_interview_session(call_sid, interview_data)     
        return True, "continue", "Validation passed"       
    except Exception as e:
        print(f"[ERROR] Validation error for {call_sid}, step {step}: {e}")
        return True, "continue", "Validation error - continuing"
def terminate_interview(call_sid: str, reason_code: str, reason_message: str):
    try:
        resp = VoiceResponse()
        resp.say(
            "Thank you so much for taking the time to speak with us today. We really appreciate your interest. We'll review everything and get back to you soon. Have a wonderful day!",
            voice='Polly.Amy', rate='medium')
        resp.hangup()
        interview_data = load_interview_session(call_sid)
        if interview_data:
            interview_data['status'] = 'TERMINATED'
            interview_data['termination_reason'] = reason_code
            interview_data['end_time'] = datetime.now().isoformat()
            save_interview_session(call_sid, interview_data)          
            save_incomplete_interview(call_sid, interview_data, reason_code)  
        print(f"[TERMINATED] Interview {call_sid} terminated due to: {reason_code}")
        return str(resp)     
    except Exception as e:
        print(f"[ERROR] Error terminating interview for {call_sid}: {e}")
        return handle_error("Thank you for your time. Have a great day!")
@app.post("/make-call")
async def make_call(request: Request):
    try:
        data = await request.json()
        phone_number = data.get("phone_number")
        if not phone_number:
            return {"error": "Phone number is required"}
        call = client.calls.create(
            url=f"{WEBHOOK_BASE_URL}/voice",
            to=phone_number,
            from_="+14067601762"
        )
        print(f"Call initiated: {call.sid} to {phone_number}")
        call_mapping = {
            "call_sid": call.sid,
            "phone_number": phone_number,
            "initiated_time": datetime.now().isoformat(),
            "status": "initiated"}
        try:
            mapping_file = "call_phone_mapping.json"
            if os.path.exists(mapping_file):
                with open(mapping_file, 'r') as f:
                    mappings = json.load(f)
            else:
                mappings = {}
            mappings[call.sid] = call_mapping
            with open(mapping_file, 'w') as f:
                json.dump(mappings, f, indent=2)
        except Exception as e:
            print(f"Error saving call mapping: {e}")
        return {
            "success": True,
            "call_sid": call.sid,
            "status": call.status,
            "phone_number": phone_number,
            "message": f"Call initiated to {phone_number}"}
    except Exception as e:
        return {"error": f"Failed to make call: {str(e)}"}