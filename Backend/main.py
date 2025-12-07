"""AI Interview Platform - Simple and Clean"""
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
import os
import json
import csv
import io
import re
import glob
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from config import (
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
    WEBHOOK_BASE_URL, INTERVIEW_QUESTIONS
)

# Check if S3 is available
try:
    from s3_storage import s3_client
    USE_S3 = s3_client is not None
except:
    USE_S3 = False
from storage import (
    ensure_directories, save_interview_session, load_interview_session,
    load_job_description, save_job_description, get_all_interviews, save_interview
)
from call_handler import ask_next_question, handle_no_response, complete_interview, handle_error
from interview import validate_response
from summary import run_jd_analysis

# Initialize
app = FastAPI(title="AI Interview Platform")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
executor = ThreadPoolExecutor(max_workers=10)
ensure_directories()

# ==================== CALLING ====================

@app.post("/make-call")
async def make_single_call(request: Request):
    """Make a single interview call"""
    try:
        data = await request.json()
        phone_number = data.get("phone_number", "").strip()
        candidate_name = data.get("candidate_name", "").strip()
        
        if not phone_number:
            return {"success": False, "error": "Phone number is required"}
        
        if not candidate_name:
            return {"success": False, "error": "Candidate name is required"}
        
        # Clean phone number
        if phone_number.startswith('+'):
            clean_phone = phone_number
        elif phone_number.startswith('91') and len(phone_number) == 12:
            clean_phone = f"+{phone_number}"
        elif len(phone_number) == 10:
            clean_phone = f"+91{phone_number}"
        else:
            clean_phone = phone_number
        
        call = client.calls.create(
            url=f"{WEBHOOK_BASE_URL}/voice",
            to=clean_phone,
            from_=TWILIO_PHONE_NUMBER,
            record=True,
            recording_channels="dual",
            recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status",
            recording_status_callback_event=['completed']
        )
        
        # Create interview session with name and phone
        interview_data = {
            "interview_id": call.sid,
            "call_sid": call.sid,
            "candidate_phone": clean_phone,
            "candidate_name": candidate_name,
            "phone_number": clean_phone,
            "start_time": datetime.now().isoformat(),
            "status": "IN_PROGRESS",
            "current_question": 0,
            "responses": [],
            "silence_prompts": 0,
            "last_activity": datetime.now().isoformat()
        }
        save_interview_session(call.sid, interview_data)
        
        return {
            "success": True,
            "call_sid": call.sid,
            "status": call.status,
            "to": clean_phone,
            "candidate_name": candidate_name,
            "message": f"Call initiated to {candidate_name} at {clean_phone}"
        }
        
    except Exception as error:
        print(f"[CALL ERROR] {error}")
        return {"success": False, "error": str(error)}

@app.post("/bulk-call")
async def start_bulk_calling(request: Request):
    """Start bulk calling"""
    try:
        contacts = await request.json()
        if not contacts:
            return {"success": False, "error": "No contacts provided"}
        
        results = []
        
        for contact in contacts:
            try:
                name = contact.get("name", "").strip()
                phone = contact.get("phone", "").strip()
                
                if not phone:
                    results.append({
                        "name": name or "Unknown",
                        "phone": "",
                        "success": False,
                        "error": "No phone number"
                    })
                    continue
                
                # Clean phone
                if phone.startswith('+'):
                    clean_phone = phone
                elif phone.startswith('91') and len(phone) == 12:
                    clean_phone = f"+{phone}"
                elif len(phone) == 10:
                    clean_phone = f"+91{phone}"
                else:
                    clean_phone = phone
                
                # Make call
                call = client.calls.create(
                    url=f"{WEBHOOK_BASE_URL}/voice",
                    to=clean_phone,
                    from_=TWILIO_PHONE_NUMBER,
                    record=True,
                    recording_channels="dual",
                    recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status",
                    recording_status_callback_event=['completed']
                )
                
                # Store candidate info directly in session (no contact mapping)
                interview_data = {
                    "interview_id": call.sid,
                    "call_sid": call.sid,
                    "candidate_phone": clean_phone,
                    "candidate_name": name or f"Candidate_{clean_phone[-4:]}",
                    "start_time": datetime.now().isoformat(),
                    "status": "IN_PROGRESS",
                    "current_question": 0,
                    "responses": [],
                    "is_bulk_call": True
                }
                save_interview_session(call.sid, interview_data)
                
                results.append({
                    "name": name,
                    "phone": clean_phone,
                    "success": True,
                    "call_sid": call.sid
                })
                
                time.sleep(1)  # Small delay between calls
                
            except Exception as error:
                results.append({
                    "name": contact.get("name", "Unknown"),
                    "phone": contact.get("phone", ""),
                    "success": False,
                    "error": str(error)
                })
        
        successful = len([r for r in results if r.get("success")])
        
        return {
            "success": True,
            "total": len(contacts),
            "successful": successful,
            "failed": len(contacts) - successful,
            "results": results
        }
        
    except Exception as error:
        print(f"[BULK CALL ERROR] {error}")
        return {"success": False, "error": str(error)}

# ==================== VOICE WEBHOOKS ====================

@app.post("/voice")
async def voice_webhook(request: Request):
    """Handle incoming Twilio calls"""
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        from_number = form_data.get('From')
        to_number = form_data.get('To')
        
        print(f"[VOICE] Call {call_sid} from {from_number}")
        
        # Load or create interview session
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            interview_data = {
                "interview_id": call_sid,
                "call_sid": call_sid,
                "candidate_phone": from_number,
                "phone_number": from_number,
                "twilio_number": to_number,
                "candidate_name": f"Candidate_{call_sid[-8:]}",
                "start_time": datetime.now().isoformat(),
                "status": "IN_PROGRESS",
                "current_question": 0,
                "responses": [],
                "silence_prompts": 0,
                "last_activity": datetime.now().isoformat()
            }
            save_interview_session(call_sid, interview_data)
        
        # Start interview
        resp = VoiceResponse()
        resp.say("Hello! This is an AI assistant. Thank you for your interest in our position.", 
                voice='Polly.Aditi', rate='medium')
        resp.pause(length=0.5)
        resp.say(INTERVIEW_QUESTIONS[0], voice='Polly.Aditi', rate='medium')
        
        resp.gather(
            input='speech',
            action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
            method='POST',
            speechTimeout='auto',
            timeout='6',
            language='en-IN',
            enhanced=True,
            profanityFilter=False,
            speechModel='phone_calls'
        )
        
        resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')
        return Response(content=str(resp), media_type="application/xml")
        
    except Exception as error:
        print(f"[VOICE ERROR] {error}")
        resp = VoiceResponse()
        resp.say("Sorry, there was a technical error. Please try again later.", voice='Polly.Aditi')
        resp.hangup()
        return Response(content=str(resp), media_type="application/xml")

@app.post("/voice/speech/{call_sid}")
async def handle_speech_response(call_sid: str, request: Request):
    """Handle speech responses"""
    try:
        form_data = await request.form()
        speech_result = form_data.get('SpeechResult', '')
        confidence = form_data.get('Confidence', '0.0')
        
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return Response(content=handle_error("Interview session not found"), media_type="application/xml")
        
        current_question = interview_data.get('current_question', 0)
        
        # Store response
        response_data = {
            "question_index": current_question,
            "question": INTERVIEW_QUESTIONS.get(current_question, ""),
            "answer": speech_result,
            "confidence": float(confidence),
            "timestamp": datetime.now().isoformat()
        }
        
        if "responses" not in interview_data:
            interview_data["responses"] = []
        interview_data["responses"].append(response_data)
        interview_data['silence_prompts'] = 0
        interview_data['last_activity'] = datetime.now().isoformat()
        
        # Validate response
        is_valid, validation_action, validation_reason = validate_response(
            call_sid, current_question, speech_result
        )
        
        if not is_valid:
            if validation_action == "call_later":
                interview_data["status"] = "CALLBACK_REQUESTED"
                save_interview(call_sid, interview_data)
                resp = VoiceResponse()
                resp.say("Thank you! We'll call you back at a better time. Have a great day!", voice='Polly.Aditi')
                resp.hangup()
                return Response(content=str(resp), media_type="application/xml")
            elif validation_action == "not_available":
                interview_data["status"] = "NOT_STARTED"
                save_interview(call_sid, interview_data)
                resp = VoiceResponse()
                resp.say("Thank you for your time. We'll be in touch soon. Have a great day!", voice='Polly.Aditi')
                resp.hangup()
                return Response(content=str(resp), media_type="application/xml")
        
        # Move to next question
        next_question_index = current_question + 1
        interview_data['current_question'] = next_question_index
        save_interview_session(call_sid, interview_data)
        
        # Check if complete
        if next_question_index >= len(INTERVIEW_QUESTIONS):
            return Response(content=complete_interview(call_sid), media_type="application/xml")
        
        # Ask next question
        return Response(content=ask_next_question(call_sid, next_question_index), media_type="application/xml")
        
    except Exception as error:
        print(f"[SPEECH ERROR] {error}")
        return Response(content=handle_error("Sorry, there was an error processing your response."), media_type="application/xml")

@app.post("/voice/no-response/{call_sid}")
async def handle_no_response_endpoint(call_sid: str):
    """Handle no response"""
    try:
        return Response(content=handle_no_response(call_sid), media_type="application/xml")
    except Exception:
        return Response(content=handle_error("Technical difficulty occurred."), media_type="application/xml")

@app.post("/recording-status")
async def recording_status_callback(request: Request):
    """Handle recording status and upload to S3 when completed"""
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        recording_sid = form_data.get('RecordingSid')
        recording_status = form_data.get('RecordingStatus')
        
        print(f"[RECORDING] Call {call_sid}, Recording {recording_sid}: {recording_status}")
        
        # When recording is completed, upload to S3
        if recording_status == 'completed' and recording_sid:
            from s3_storage import upload_recording_to_s3
            s3_result = upload_recording_to_s3(call_sid, recording_sid)
            
            if s3_result:
                # Update interview data with S3 URL
                interview_data = load_interview_session(call_sid)
                if interview_data:
                    if 'recordings' not in interview_data:
                        interview_data['recordings'] = []
                    interview_data['recordings'].append({
                        'recording_sid': recording_sid,
                        's3_url': s3_result['s3_url'],
                        's3_key': s3_result['s3_key'],
                        'duration': s3_result.get('duration'),
                        'status': 'stored_in_s3'
                    })
                    save_interview_session(call_sid, interview_data)
                    print(f"✅ Recording stored in S3: {s3_result['s3_url']}")
        
        return {"status": "received"}
    except Exception as error:
        print(f"[RECORDING ERROR] {error}")
        return {"error": str(error)}

# ==================== INTERVIEW DATA ====================

@app.get("/interviews-detailed")
async def get_all_interviews_detailed():
    """Get all interviews"""
    try:
        interviews = get_all_interviews()
        
        # Include active sessions
        session_files = glob.glob("interviews/session_*.json")
        for session_file in session_files:
            try:
                call_sid = os.path.basename(session_file).replace("session_", "").replace(".json", "")
                session_data = load_interview_session(call_sid)
                if session_data:
                    interviews.append(session_data)
            except Exception:
                    continue
        
        # Process interviews
        processed = []
        for interview in interviews:
            call_sid = interview.get("call_sid") or interview.get("interview_id", "unknown")
            processed.append({
                "call_sid": call_sid,
                "interview_id": call_sid,
                "phone_number": interview.get("candidate_phone") or interview.get("phone_number", ""),
                "candidate_name": interview.get("candidate_name", f"Candidate_{call_sid[-8:]}"),
                "status": interview.get("status", "COMPLETED"),
                "start_time": interview.get("start_time", ""),
                "end_time": interview.get("end_time", ""),
                "completion_time": interview.get("completion_time", interview.get("end_time", "")),
                "responses": interview.get("responses", []),
                "questions_answered": len(interview.get("responses", [])),
                "total_questions": len(INTERVIEW_QUESTIONS)
            })
        
        processed.sort(key=lambda x: x.get("start_time", ""), reverse=True)
        completed_count = len([i for i in processed if i.get("status") == "COMPLETED"])
        
        return {
            "success": True,
            "interviews": processed,
            "total_count": len(processed),
            "completed_count": completed_count
        }
    except Exception as error:
        print(f"Error getting interviews: {error}")
        return {"success": False, "error": str(error), "interviews": []}

@app.get("/interview-details/{interview_id}")
async def get_interview_details(interview_id: str):
    """Get interview details - optimized for faster loading"""
    try:
        # Try to load from S3 first, then local
        data = None
        if USE_S3:
            from s3_storage import load_interview_from_s3
            data = load_interview_from_s3(interview_id)
        
        # Fallback to local file
        if not data:
            interview_file = f"interviews/{interview_id}.json"
            if os.path.exists(interview_file):
                with open(interview_file, 'r') as f:
                    data = json.load(f)
        
        if data:
            
            # Get S3 recording URLs if available
            recordings = data.get('recordings', [])
            if not recordings and data.get('call_sid'):
                # Try to fetch from S3 if not in data
                from s3_storage import list_recordings_for_call
                s3_recordings = list_recordings_for_call(data.get('call_sid', interview_id))
                if s3_recordings:
                    recordings = [{'s3_url': r['url'], 's3_key': r['key']} for r in s3_recordings]
            
            return {
                "interview_id": interview_id,
                "call_sid": data.get('call_sid', interview_id),
                "candidate_name": data.get('candidate_name', f"Candidate_{interview_id[-8:]}"),
                "candidate_phone": data.get('candidate_phone') or data.get('phone_number', ""),
                "status": data.get('status', 'COMPLETED'),
                "start_time": data.get('start_time', ''),
                "end_time": data.get('end_time', ''),
                "responses": data.get('responses', []),
                "questions_answered": len(data.get('responses', [])),
                "total_questions": len(INTERVIEW_QUESTIONS),
                "recordings": recordings
            }
        
        # Check session file (for in-progress calls)
        session_data = load_interview_session(interview_id)
        if session_data:
            return {
                "interview_id": interview_id,
                "call_sid": interview_id,
                "candidate_name": session_data.get('candidate_name', f"Candidate_{interview_id[-8:]}"),
                "candidate_phone": session_data.get('candidate_phone', ""),
                "status": session_data.get('status', 'IN_PROGRESS'),
                "start_time": session_data.get('start_time', ''),
                "responses": session_data.get('responses', []),
                "questions_answered": len(session_data.get('responses', [])),
                "total_questions": len(INTERVIEW_QUESTIONS),
                "recordings": session_data.get('recordings', [])
            }
        
        return {"error": "Interview not found"}
    except Exception as error:
        print(f"Error getting interview details: {error}")
        return {"error": str(error)}

# ==================== JOB DESCRIPTION ====================

@app.get("/job-description")
async def get_job_description_endpoint():
    """Get job description"""
    try:
        jd = load_job_description()
        return {
            "title": jd.get("title", "Software Developer"),
            "company": jd.get("company", "AI Interview Platform"),
            "description": jd.get("description", ""),
            "required_skills": ", ".join(jd.get("required_skills", [])),
            "experience_required": jd.get("experience_required", "2-5 years")
        }
    except Exception:
        return {
            "title": "Software Developer",
            "company": "AI Interview Platform",
            "description": "Software Developer position",
            "required_skills": "python, javascript, react",
            "experience_required": "2-5 years"
        }

@app.post("/update-job-description")
async def update_job_description_endpoint(request: Request):
    """Update job description"""
    try:
        jd_data = await request.json()
        skills_text = jd_data.get("required_skills", "")
        
        if isinstance(skills_text, str):
            skills_list = [skill.strip() for skill in skills_text.split(",") if skill.strip()]
        else:
            skills_list = skills_text
        
        jd_config = {
            "title": jd_data.get("title", "Software Developer"),
            "company": jd_data.get("company", "AI Interview Platform"),
            "description": jd_data.get("description", ""),
            "required_skills": skills_list,
            "experience_required": jd_data.get("experience_required", "2-5 years")
        }
        
        save_job_description(jd_config)
        
        return {
            "success": True,
            "message": "Job Description updated successfully",
            "updated_data": jd_config
        }
    except Exception as error:
        return {"success": False, "error": str(error)}

# ==================== ANALYSIS ====================

@app.post("/run-jd-analysis")
async def run_jd_analysis_endpoint():
    """Run JD analysis"""
    try:
        report = run_jd_analysis()
        return report
    except Exception as error:
        return {"error": str(error)}

@app.get("/jd-report/{call_id}")
async def get_jd_report(call_id: str):
    """Get JD analysis report - from S3 or local"""
    try:
        # Try S3 first
        if USE_S3:
            from s3_storage import load_jd_analysis_from_s3
            s3_data = load_jd_analysis_from_s3(call_id)
            if s3_data:
                return s3_data
        
        # Fallback to local
        pattern = f"interviews/*{call_id}*JD_*ANALYSIS*.json"
        files = glob.glob(pattern)
        if files:
            latest_file = max(files, key=os.path.getmtime)
            with open(latest_file, 'r') as f:
                return json.load(f)
        return {"error": "JD report not found"}
    except Exception as error:
        return {"error": str(error)}

# ==================== INTERVIEW QUESTIONS ====================

@app.get("/interview-questions")
async def get_interview_questions():
    """Get interview questions"""
    try:
        questions = []
        for q_id, q_text in INTERVIEW_QUESTIONS.items():
            questions.append({
                "id": q_id,
                "question": q_text
            })
        return {"success": True, "questions": questions}
    except Exception as error:
        return {"success": False, "error": str(error), "questions": []}

@app.post("/update-interview-questions")
async def update_interview_questions(request: Request):
    """Update interview questions"""
    try:
        data = await request.json()
        questions = data.get("questions", [])
        
        # Update INTERVIEW_QUESTIONS dict
        updated_questions = {}
        for q in questions:
            q_id = q.get("id")
            q_text = q.get("question", "").strip()
            if q_id is not None and q_text:
                updated_questions[q_id] = q_text
        
        # Update config.py file
        config_file = os.path.join(os.path.dirname(__file__), "config.py")
        with open(config_file, 'r') as f:
            content = f.read()
        
        # Replace INTERVIEW_QUESTIONS dict
        pattern = r'INTERVIEW_QUESTIONS\s*=\s*\{[^}]*\}'
        questions_str = "INTERVIEW_QUESTIONS = {\n"
        for q_id, q_text in sorted(updated_questions.items()):
            # Escape quotes in question text
            escaped_text = q_text.replace('"', '\\"')
            questions_str += f'    {q_id}: "{escaped_text}",\n'
        questions_str += "}"
        
        content = re.sub(pattern, questions_str, content, flags=re.DOTALL)
        
        with open(config_file, 'w') as f:
            f.write(content)
        
        # Update the global INTERVIEW_QUESTIONS
        global INTERVIEW_QUESTIONS
        INTERVIEW_QUESTIONS = updated_questions
        
        return {"success": True, "message": "Questions updated successfully"}
    except Exception as error:
        return {"success": False, "error": str(error)}

# ==================== CSV UPLOAD ====================

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload and process CSV file"""
    try:
        if not file.filename.endswith('.csv'):
            return {"success": False, "error": "Only CSV files are allowed", "contacts": []}
        
        content = await file.read()
        csv_data = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        candidates = list(csv_reader)
        
        if not candidates:
            return {"success": False, "error": "No candidates found in CSV", "contacts": []}
        
        processed_contacts = []
        for candidate in candidates:
            name = candidate.get("name", candidate.get("Name", "")).strip()
            phone = candidate.get("phone", candidate.get("Phone", candidate.get("mobile", candidate.get("Mobile", "")))).strip()
            email = candidate.get("email", candidate.get("Email", "")).strip()
            
            # Clean phone
            clean_phone = phone
            if phone:
                if phone.startswith('+'):
                    clean_phone = phone[1:]
                if clean_phone.startswith('919') and len(clean_phone) == 13:
                    clean_phone = clean_phone[2:]
                    clean_phone = f"+91{clean_phone}"
                elif clean_phone.startswith('91') and len(clean_phone) == 12:
                    clean_phone = f"+{clean_phone}"
                elif len(clean_phone) == 10:
                    clean_phone = f"+91{clean_phone}"
            
            # Generate email if missing
            if not email:
                if name:
                    email_name = name.lower().replace(' ', '.').replace('-', '.')
                    email_name = re.sub(r'[^a-z0-9.]', '', email_name)
                    email = f"{email_name}@example.com"
                elif clean_phone:
                    phone_suffix = clean_phone.replace('+', '').replace('-', '').replace(' ', '')[-6:]
                    email = f"candidate{phone_suffix}@example.com"
            
            # Generate name if missing
            if not name and clean_phone:
                phone_suffix = clean_phone.replace('+', '')[-4:] if len(clean_phone) >= 4 else "0000"
                name = f"Candidate_{phone_suffix}"
            
            processed_contacts.append({
                "name": name,
                "phone": clean_phone or "",
                "email": email
            })
        
        return {
            "success": True,
            "contacts": processed_contacts,
            "total_contacts": len(processed_contacts),
            "message": f"✅ {len(processed_contacts)} contacts loaded!"
        }
        
    except Exception as error:
        print(f"[CSV ERROR] {error}")
        return {"success": False, "error": str(error), "contacts": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
