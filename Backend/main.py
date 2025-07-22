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
from email.message import EmailMessage
import smtplib
from pydantic import BaseModel
from typing import Optional
from typing import List
import csv
import io
import PyPDF2
from dotenv import load_dotenv
import shutil
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
class EmailLinkRequest(BaseModel):
    email: str
    link: str
    candidate_name: Optional[str] = None
    role: Optional[str] = None
def create_folders():
    folders = [
        "interviews/audio_recordings",
        "interviews/transcriptions",
        "interviews/bulk_results",
        "interviews/contact_mappings"
        ]
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
    comprehensive_ai_ml_skills = [
        "nlp", "natural language processing", "llm", "large language model", 
        "rag", "retrieval augmented generation", "agents", "chatbot", "chatbots",
        "hugging face", "transformers", "bert", "gpt", "openai", "text processing", 
        "language models", "text based", "huggingface",
        
        "deep learning", "neural network", "cnn", "convolutional neural network",
        "yolo", "stable diffusion", "computer vision", "image processing", 
        "object detection", "image based models", "convolutional", "pytorch", 
        "tensorflow", "keras", "generative ai", "diffusion models", "image models",
        
        "machine learning", "ml", "regression", "clustering", "clustering algorithms",
        "supervised", "unsupervised", "supervised algorithms", "unsupervised algorithms",
        "classification", "random forest", "svm", "decision tree", "xgboost",
        "k-means", "linear regression", "logistic regression", "naive bayes",
        
        "fine-tuning", "fine tuning", "model training", "training", "transfer learning",
        "hyperparameter tuning", "optimization", "model fine-tuning", "training models",
        "fine tuned", "model optimization", "training algorithms",
        
        "aws", "amazon web services", "ec2", "s3", "sagemaker", "ecr", 
        "azure", "microsoft azure", "gcp", "google cloud", "google cloud platform",
        "cloud computing", "cloud", "cloud knowledge", "cloud experience",
        
        "docker", "kubernetes", "deployment", "containerization", "k8s",
        "container", "orchestration", "ci/cd", "devops", "deployment knowledge",
        
        "api", "fastapi", "rest api", "restapi", "flask", "flask api", 
        "api development", "endpoints", "json", "http", "web services",
        "api knowledge", "api experience", "ai api", "ml api", "model api",
        "open source model", "apis", "rest", "microservices"
    ]
    jd_found_skills = []
    for skill in jd_skills:
        if skill.lower() in text_lower:
            jd_found_skills.append(skill)
    ai_found_skills = []
    for skill in comprehensive_ai_ml_skills:
        if skill in text_lower:
            ai_found_skills.append(skill)
    jd_match_percentage = (len(jd_found_skills) / len(jd_skills)) * 100 if jd_skills else 0
    ai_match_percentage = (len(ai_found_skills) / len(comprehensive_ai_ml_skills)) * 100
    all_found_skills = list(set(jd_found_skills + ai_found_skills)) 
    has_good_match = (
        jd_match_percentage >= 20 or          
        ai_match_percentage >= 3 or           
        len(all_found_skills) >= 1 or
        any(word in text_lower for word in ["programming", "development", "coding", "software", "technical", "engineering"])
    )
    overall_percentage = max(jd_match_percentage, ai_match_percentage)
    return has_good_match, all_found_skills, overall_percentage
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
    
    # Enhanced cloud keywords with better pattern matching
    cloud_keywords = [
        # AWS services and variations
        "aws", "amazon web services", "amazon", "ec2", "s3", "lambda", "rds", "cloudformation",
        "elastic compute", "simple storage", "sagemaker", "ecr", "elastic container registry",
        
        # Azure services
        "azure", "microsoft azure", "azure storage", "azure functions", "azure sql",
        
        # GCP services  
        "gcp", "google cloud", "google cloud platform", "compute engine", "cloud storage",
        "bigquery", "cloud functions",
        
        # General cloud terms
        "cloud", "cloud computing", "cloud platform", "cloud platforms", "cloud services",
        "docker", "kubernetes", "devops", "containerization", "microservices",
        
        # Common cloud concepts
        "deployment", "scaling", "load balancer", "cdn", "api gateway"
    ]
    
    # Check for cloud keywords with fuzzy matching
    found_skills = []
    for keyword in cloud_keywords:
        if keyword in text_lower:
            found_skills.append(keyword)
    
    # Special handling for AWS variations (common speech-to-text errors)
    aws_variations = [
        "aws", "a w s", "amazon", "ec2", "e c 2", "ec two", "s3", "s 3", "s three",
        "elastic", "compute", "storage", "cloud"
    ]
    
    aws_found = any(variation in text_lower for variation in aws_variations)
    
    # Check for positive indicators
    positive_indicators = ["yes", "worked with", "experience", "used", "familiar", "know"]
    has_positive_response = any(indicator in text_lower for indicator in positive_indicators)
    
    # Determine if candidate has cloud experience
    has_cloud_experience = (
        len(found_skills) > 0 or 
        aws_found or
        (has_positive_response and any(cloud_term in text_lower for cloud_term in ["cloud", "aws", "azure", "gcp"]))
    )
    
    platforms_count = 1 if has_cloud_experience else 0
    
    return has_cloud_experience, {"cloud": found_skills}, found_skills, platforms_count
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
    
    # Your comprehensive categories
    ai_keywords = [
        # NLP/LLM
        "nlp", "natural language processing", "llm", "large language model", 
        "rag", "retrieval augmented generation", "agents", "chatbot", "hugging face",
        "transformers", "bert", "gpt", "openai",
        
        # Deep Learning
        "deep learning", "neural network", "cnn", "convolutional neural network",
        "yolo", "stable diffusion", "computer vision", "image processing",
        "pytorch", "tensorflow", "keras", "generative ai",
        
        # Machine Learning  
        "machine learning", "ml", "regression", "classification", "clustering",
        "supervised learning", "unsupervised learning", "random forest", "svm",
        "decision tree", "xgboost", "naive bayes", "feature engineering",
        
        # Training/Fine-tuning
        "fine-tuning", "training", "model training", "transfer learning",
        "hyperparameter tuning", "optimization", "data preprocessing",
        
        # General AI
        "ai", "artificial intelligence", "data science", "python", "analytics"
    ]
    
    found_skills = [keyword for keyword in ai_keywords if keyword in text_lower]
    has_ai_experience = len(found_skills) > 0
    
    return has_ai_experience, has_ai_experience, has_ai_experience, has_ai_experience, found_skills
def check_time_availability(transcript_text):
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
    call_later_indicators = [
        "later", "call back", "reschedule", "call later", "not now",
        "after", "evening", "tomorrow", "next week", "monday", "tuesday", 
        "wednesday", "thursday", "friday", "saturday", "sunday",
        "morning", "afternoon", "evening", "tonight", "weekend"
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
def validate_response_selected_questions(call_sid: str, step: int, transcription: str):
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
            validation_result["response"] = transcription[:200]
            validation_result["full_response"] = transcription   
            
            if not is_available:
                validation_result["passed"] = False
                
                if availability_status == "call_later":
                    validation_result["reason"] = "Candidate requested to call later"
                    interview_data["callback_requested"] = True
                    interview_data["callback_response"] = transcription
                    interview_data["callback_request_time"] = datetime.now().isoformat()
                    
                    if "validation_results" not in interview_data:
                        interview_data["validation_results"] = {}
                    interview_data["validation_results"][str(step)] = validation_result
                    save_interview_session(call_sid, interview_data)
                    return False, "call_later", "Candidate requested to call later"
                else:
                    validation_result["reason"] = "Candidate not available for interview"
                    if "validation_results" not in interview_data:
                        interview_data["validation_results"] = {}
                    interview_data["validation_results"][str(step)] = validation_result
                    save_interview_session(call_sid, interview_data)
                    return False, "not_available", "Candidate not available for interview"
        
        # For all other steps (2,3,4,5,6,7,8), just store response without validation
        # All technical validations will happen post-interview
        
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
            speechModel='phone_calls'  # Changed to phone_calls for better accuracy
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
                speechModel='phone_calls'  # Changed to phone_calls for better accuracy
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
                "call_sid": call_sid,
                "responses": [],
                "status": "COMPLETED",
                "start_time": datetime.now().isoformat(),
                "phone_number": f"Phone_{call_sid[-8:]}",
                "candidate_phone": f"Phone_{call_sid[-8:]}",
                "candidate_name": f"Candidate_{call_sid[-8:]}",
                "twilio_number": "+14787807480"
            }
        
        responses = interview_data.get("responses", [])
        print(f"[DEBUG] Found {len(responses)} responses for {call_sid}")
        current_name = interview_data.get("candidate_name", "")
        if (not current_name or 
            current_name.startswith("Candidate_") or 
            current_name == "Unknown" or 
            current_name == "Unknown Candidate"):
            if responses and len(responses) > 0:
                intro_response = responses[0].get("answer", "")
                name_patterns = [
                    r"(?:i'?m|my name is|i am|this is)\s+([a-zA-Z][a-zA-Z\s]{1,25})",
                    r"^([a-zA-Z][a-zA-Z\s]{1,25}?)(?:\s+speaking|\s+here|\s*$)",
                    r"myself\s+([a-zA-Z][a-zA-Z\s]{1,25})"
                ]
                
                for pattern in name_patterns:
                    match = re.search(pattern, intro_response, re.IGNORECASE)
                    if match:
                        extracted_name = match.group(1).strip()
                        # Validate the extracted name
                        if (len(extracted_name) > 2 and 
                            not any(word in extracted_name.lower() for word in ['from', 'calling', 'speaking', 'here', 'hello', 'hi'])):
                            interview_data["candidate_name"] = extracted_name.title()
                            print(f"🎯 Extracted name from intro: '{extracted_name.title()}'")
                            break
        final_name = interview_data.get("candidate_name", f"Candidate_{call_sid[-8:]}")
        final_phone = interview_data.get("candidate_phone") or interview_data.get("phone_number") or f"Phone_{call_sid[-8:]}"
        
        # Update interview data with final values
        interview_data.update({
            "status": "COMPLETED",
            "end_time": datetime.now().isoformat(),
            "completion_time": datetime.now().isoformat(),
            "interview_id": call_sid,
            "call_sid": call_sid,
            "candidate_name": final_name,
            "name": final_name,  # Alternative field
            "phone_number": final_phone,
            "candidate_phone": final_phone,
            "twilio_number": interview_data.get("twilio_number", "+14787807480")
        })
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"interviews/{call_sid}_COMPLETED_{timestamp}.json"
        os.makedirs("interviews", exist_ok=True)
        
        with open(filename, 'w') as f:
            json.dump(interview_data, f, indent=2)
        
        print(f"[COMPLETED] Interview {call_sid} saved to {filename}")
        print(f"[DATA] Saved data for {final_name} - {final_phone}")
        
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
        response.say("Thank you for your time! Your interview has been completed successfully. We will review your responses and get back to you soon. Have a great day!", voice='Polly.Aditi')
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
        elif termination_reason == "call_later":
            interview_type = "Callback Requested - Will Reschedule"
            status = "CALLBACK_REQUESTED"
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
            "is_bulk_call": interview_data.get("is_bulk_call", False),
            
            # NEW: Callback-specific fields
            "callback_requested": interview_data.get("callback_requested", False),
            "callback_response": interview_data.get("callback_response", ""),
            "callback_request_time": interview_data.get("callback_request_time", ""),
            "preferred_time": interview_data.get("preferred_time", "")
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
                    call_sid = (interview_data.get("call_sid") or 
                               interview_data.get("interview_id") or 
                               filename.split('_')[0])
                    candidate_name = (interview_data.get("candidate_name") or 
                                     interview_data.get("name") or 
                                     interview_data.get("contact_name"))
                    if (not candidate_name or 
                        candidate_name == "Unknown" or 
                        candidate_name == "Unknown Candidate" or
                        candidate_name.startswith("Candidate_")):
                        
                        responses = interview_data.get("responses", [])
                        if responses and len(responses) > 0:
                            intro_text = responses[0].get("answer", "")
                            name_patterns = [
                                r"(?:my name is|i'?m|i am|this is)\s+([a-zA-Z][a-zA-Z\s]{1,25})",
                                r"^([a-zA-Z][a-zA-Z\s]{1,25}?)(?:\s+speaking|\s+here|\s*$)",
                                r"myself\s+([a-zA-Z][a-zA-Z\s]{1,25})"
                            ]
                            
                            for pattern in name_patterns:
                                match = re.search(pattern, intro_text, re.IGNORECASE)
                                if match:
                                    extracted_name = match.group(1).strip()
                                    if (len(extracted_name) > 2 and 
                                        not any(word in extracted_name.lower() for word in ['from', 'calling', 'speaking', 'here', 'hello', 'hi'])):
                                        candidate_name = extracted_name.title()
                                        print(f"🎯 Extracted name from terminated interview: '{extracted_name.title()}'")
                                        break
                    if not candidate_name or candidate_name in ["Unknown", "Unknown Candidate"]:
                        phone_number = (interview_data.get("candidate_phone") or 
                                       interview_data.get("phone_number") or 
                                       call_sid[-8:])
                        phone_suffix = phone_number.replace('+', '')[-4:] if len(phone_number) >= 4 else call_sid[-4:]
                        candidate_name = f"Candidate_{phone_suffix}"
                    phone_number = (interview_data.get("candidate_phone") or 
                                   interview_data.get("phone_number") or 
                                   interview_data.get("phone") or 
                                   f"Phone_{call_sid[-8:]}")
                    
                    processed_interview = {
                        "call_sid": call_sid,
                        "interview_id": call_sid,
                        "phone_number": phone_number,
                        "candidate_name": candidate_name,
                        "candidate_phone": phone_number,
                        "twilio_number": interview_data.get("twilio_number", "+14787807480"),
                        "start_time": interview_data.get("start_time", ""),
                        "end_time": interview_data.get("end_time", ""),
                        "completion_time": interview_data.get("completion_time", interview_data.get("end_time", "")),
                        "status": interview_data.get("status", "COMPLETED"),
                        "current_question": interview_data.get("candidate_name", len(interview_data.get("responses", []))),
                        "responses": interview_data.get("responses", []),
                        "validation_results": interview_data.get("validation_results", {}),
                        "questions_answered": len(interview_data.get("responses", [])),
                        "total_questions": interview_data.get("total_questions", 8),
                        "all_validations_passed": interview_data.get("all_validations_passed", False),
                        "termination_reason": interview_data.get("termination_reason", None),
                        "silence_prompts": interview_data.get("silence_prompts", 0),
                        "last_activity": interview_data.get("last_activity", ""),
                        "bulk_call_id": interview_data.get("bulk_call_id"),
                        "is_bulk_call": interview_data.get("is_bulk_call", False),
                        "callback_requested": interview_data.get("callback_requested", False),
                        "callback_response": interview_data.get("callback_response", ""),
                        "callback_request_time": interview_data.get("callback_request_time", ""),
                        "preferred_time": interview_data.get("preferred_time", "")
                    }
                    all_interviews.append(processed_interview);
                    
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
                        candidate_name = session_data.get("candidate_name", f"Candidate_{call_sid[-8:]}")
                        phone_number = session_data.get("candidate_phone", f"Phone_{call_sid[-8:]}")
                        
                        processed_session = {
                            "call_sid": call_sid,
                            "interview_id": call_sid,
                            "phone_number": phone_number,
                            "candidate_name": candidate_name,
                            "candidate_phone": phone_number,
                            "twilio_number": session_data.get("twilio_number", "+14787807480"),
                            "start_time": session_data.get("start_time", ""),
                            "end_time": session_data.get("end_time", ""),
                            "completion_time": session_data.get("start_time", ""),
                            "status": session_data.get("status", "IN_PROGRESS"),
                            "current_question": session_data.get("current_question", 1),
                            "responses": session_data.get("responses", []),
                            "validation_results": session_data.get("validation_results", {}),
                            "questions_answered": len(session_data.get("responses", [])),
                            "total_questions": len(INTERVIEW_QUESTIONS),
                            "all_validations_passed": all(v.get('passed', True) for v in session_data.get('validation_results', {}).values()),
                            "termination_reason": session_data.get("termination_reason", None),
                            "silence_prompts": session_data.get("silence_prompts", 0),
                            "last_activity": session_data.get("last_activity", ""),
                            "bulk_call_id": session_data.get("bulk_call_id"),
                            "is_bulk_call": session_data.get("is_bulk_call", False),
                            "callback_requested": session_data.get("callback_requested", False),
                            "callback_response": session_data.get("callback_response", ""),
                            "callback_request_time": session_data.get("callback_request_time", ""),
                            "preferred_time": session_data.get("preferred_time", "")
                        }
                        
                        print(f"📊 Processed session {call_sid}: status='{processed_session['status']}', name='{candidate_name}'")
                        all_interviews.append(processed_session);
            except Exception as e:
                print(f"Error reading session {session_file}: {e}")
                continue
        all_interviews.sort(key=lambda x: x.get("start_time", x.get("completion_time", "")), reverse=True)
        completed_count = len([i for i in all_interviews if i.get("status") == "COMPLETED"])
        terminated_count = len([i for i in all_interviews if i.get("status") == "TERMINATED"])
        callback_count = len([i for i in all_interviews if i.get("status") == "CALLBACK_REQUESTED"])
        
        print(f"📋 Returning {len(all_interviews)} interviews ({completed_count} completed, {terminated_count} terminated, {callback_count} callbacks)")
        
        return {
            "success": True,
            "interviews": all_interviews,
            "total_count": len(all_interviews),
            "completed_count": completed_count,
            "terminated_count": terminated_count,
            "callback_count": callback_count
        }
    except Exception as e:
        print(f"Error getting all interviews: {e}")
        return {
            "success": False,
            "error": str(e),
            "interviews": [],
            "total_count": 0,
            "completed_count": 0,
            "terminated_count": 0,
            "callback_count": 0
        }
@app.get("/interview-details/{interview_id}")
async def get_interview_details(interview_id: str):
    try:
        interview_folder = "interviews"
        if os.path.exists(interview_folder):
            json_files = glob.glob(f"{interview_folder}/*{interview_id}*.json")
            
            for file_path in json_files:
                if "session_" in file_path:
                    continue
                    
                try:
                    with open(file_path, 'r') as f:
                        interview_data = json.load(f)
                    
                    # Enhanced data processing
                    candidate_name = interview_data.get('candidate_name') or interview_data.get('name')
                    if not candidate_name or candidate_name == 'Unknown':
                        responses = interview_data.get('responses', [])
                        if responses:
                            intro_text = responses[0].get('answer', '')
                            name_match = re.search(r'(?:i\'?m|my name is|i am|this is)\s+([a-zA-Z\s]{2,25})', intro_text, re.IGNORECASE)
                            if name_match:
                                candidate_name = name_match.group(1).strip().title()
                            else:
                                candidate_name = f"Candidate_{interview_id[-8:]}"
                    phone_number = (interview_data.get('candidate_phone') or 
                                   interview_data.get('phone_number') or 
                                   f"Phone_{interview_id[-8:]}")
                    
                    processed_data = {
                        "interview_id": interview_id,
                        "call_sid": interview_data.get('call_sid', interview_id),
                        "candidate_name": candidate_name,
                        "candidate_phone": phone_number,
                        "phone_number": phone_number,
                        "status": interview_data.get('status', 'COMPLETED'),
                        "start_time": interview_data.get('start_time', ''),
                        "end_time": interview_data.get('end_time', ''),
                        "completion_time": interview_data.get('completion_time', ''),
                        "responses": interview_data.get('responses', []),
                        "validation_results": interview_data.get('validation_results', {}),
                        "questions_answered": len(interview_data.get('responses', [])),
                        "total_questions": interview_data.get('total_questions', 8),
                        "completion_rate": f"{int((len(interview_data.get('responses', [])) / 8) * 100)}%",
                        "interviewer": "AI Assistant - Onelab Ventures",
                        "twilio_number": interview_data.get('twilio_number', '+14787807480'),
                        "bulk_call_id": interview_data.get('bulk_call_id'),
                        "is_bulk_call": interview_data.get('is_bulk_call', False)
                    }
                    
                    print(f"[INTERVIEW DETAILS] Found interview data for {candidate_name}")
                    return processed_data
                    
                except Exception as e:
                    print(f"Error reading interview file {file_path}: {e}")
                    continue
        session_file = f"interviews/session_{interview_id}.json"
        if os.path.exists(session_file):
            session_data = load_interview_session(interview_id)
            if session_data:
                candidate_name = session_data.get('candidate_name', f"Candidate_{interview_id[-8:]}")
                phone_number = session_data.get('candidate_phone', f"Phone_{interview_id[-8:]}")
                
                return {
                    "interview_id": interview_id,
                    "call_sid": interview_id,
                    "candidate_name": candidate_name,
                    "candidate_phone": phone_number,
                    "phone_number": phone_number,
                    "status": session_data.get('status', 'IN_PROGRESS'),
                    "start_time": session_data.get('start_time', ''),
                    "end_time": session_data.get('end_time', ''),
                    "responses": session_data.get('responses', []),
                    "validation_results": session_data.get('validation_results', {}),
                    "questions_answered": len(session_data.get('responses', [])),
                    "total_questions": 8,
                    "completion_rate": f"{int((len(session_data.get('responses', [])) / 8) * 100)}%",
                    "interviewer": "AI Assistant - Onelab Ventures",
                    "twilio_number": session_data.get('twilio_number', '+14787807480')
                }
        
        return {"error": "Interview not found"}
        
    except Exception as e:
        print(f"[ERROR] Failed to get interview details: {e}")
        return {"error": str(e)}
@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        print("=" * 50)
        print("[CSV UPLOAD] 📄 PROCESSING CSV FILE ONLY - NO CALLS!")
        print("=" * 50)
        
        if not file.filename.endswith('.csv'):
            print("[CSV UPLOAD] ❌ Invalid file format")
            return {
                "success": False, 
                "error": "Only CSV files are allowed",
                "contacts": [],
                "total_contacts": 0,
                "message": "Invalid file format"
            }
        content = await file.read()
        csv_data = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        candidates = list(csv_reader)
        
        if not candidates:
            print("[CSV UPLOAD] ❌ Empty CSV file")
            return {
                "success": False, 
                "error": "No candidates found in CSV",
                "contacts": [],
                "total_contacts": 0,
                "message": "Empty CSV file"
            }
        processed_contacts = []
        for candidate in candidates:
            name = candidate.get("name", candidate.get("Name", "")).strip()
            phone = candidate.get("phone", candidate.get("Phone", candidate.get("mobile", candidate.get("Mobile", "")))).strip()
            email = candidate.get("email", candidate.get("Email", "")).strip()
            experience = candidate.get("experience", candidate.get("Experience", "")).strip()
            skills = candidate.get("skills", candidate.get("Skills", "")).strip()
            clean_phone = phone
            if phone:
                if phone.startswith('+'):
                    clean_phone = phone[1:]
                if clean_phone.startswith('919') and len(clean_phone) == 13:
                    clean_phone = clean_phone[2:]  # Remove first "91"
                    clean_phone = f"+91{clean_phone}"
                elif clean_phone.startswith('91') and len(clean_phone) == 12:
                    clean_phone = f"+{clean_phone}"
                elif len(clean_phone) == 10:
                    clean_phone = f"+91{clean_phone}"
        return {
            "success": True,
            "contacts": processed_contacts,
            "total_contacts": len(processed_contacts),
            "message": f"✅ {len(processed_contacts)} contacts loaded successfully! Click 'Start AI Bulk Interviews' to begin calling."
        }
        
    except Exception as e:
        print(f"[CSV UPLOAD] ❌ Error: {e}")
        return {
            "success": False, 
            "error": str(e),
            "contacts": [],
            "total_contacts": 0,
            "message": "Failed to process CSV file"
        }

@app.post("/bulk-call")
async def start_bulk_calling(request: Request):
    """
    THIS IS WHERE ACTUAL TWILIO CALLS ARE MADE!
    Only triggered when user clicks 'Start AI Bulk Interviews' button.
    """
    try:
        print("=" * 60)
        print("[BULK CALL] 🚀 STARTING ACTUAL TWILIO CALLS NOW!")
        print("=" * 60)
        
        contacts = await request.json()
        
        if not contacts or len(contacts) == 0:
            print("[BULK CALL] ❌ No contacts provided")
            return {"success": False, "error": "No contacts provided", "results": []}
        
        # Generate bulk call ID
        bulk_call_id = f"bulk_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        results = []
        successful_calls = 0
        failed_calls = 0
        
        print(f"[BULK CALL] 📞 About to make {len(contacts)} actual Twilio calls...")
        print(f"[BULK CALL] 🆔 Bulk Call ID: {bulk_call_id}")
        
        # Process each contact and MAKE ACTUAL CALLS
        for index, contact in enumerate(contacts):
            try:
                name = contact.get("name", "").strip()
                phone = contact.get("phone", "").strip()
                email = contact.get("email", "").strip()
                experience = contact.get("experience", "").strip()
                skills = contact.get("skills", "").strip()
                
                print(f"[BULK CALL] 📞 Processing {index + 1}/{len(contacts)}: {name} ({phone}) - {email}")
                
                if not phone:
                    print(f"[BULK CALL] ⚠️  Skipping {name} - No phone number")
                    failed_calls += 1
                    results.append({
                        "name": name or "Unknown",
                        "phone": "N/A",
                        "email": email,
                        "success": False,
                        "error": "No phone number",
                        "call_sid": None,
                        "status": "failed"
                    })
                    continue
                
                # Generate meaningful name if missing
                if not name:
                    phone_suffix = phone.replace('+', '')[-4:] if len(phone) >= 4 else "0000"
                    name = f"Candidate_{phone_suffix}"
                
                # Generate email if missing
                if not email:
                    if name and not name.startswith("Candidate_"):
                        email_name = name.lower().replace(' ', '.').replace('-', '.')
                        email_name = re.sub(r'[^a-z0-9.]', '', email_name)
                        email = f"{email_name}@example.com"
                    else:
                        phone_suffix = phone.replace('+', '').replace('-', '').replace(' ', '')[-6:]
                        email = f"candidate{phone_suffix}@example.com"
                
                # 🔥 MAKE ACTUAL TWILIO CALL HERE 🔥
                try:
                    print(f"[TWILIO] 📞 Creating actual call to {phone}...")
                    
                    call = client.calls.create(
                        url=f"{WEBHOOK_BASE_URL}/voice",
                        to=phone,
                        from_="+14787807480",
                        record=True,
                        recording_channels="dual",
                        recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
                    )
                    
                    print(f"[TWILIO] ✅ Call created successfully: {call.sid}")
                    
                    # Store contact mapping for the interview with EMAIL
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
                            "candidate_email": email,  # ✅ NOW STORING EMAIL
                            "candidate_experience": experience,
                            "candidate_skills": skills,
                            "is_bulk_call": True,
                            "bulk_call_id": bulk_call_id,
                            "recording_enabled": True,
                            "candidate_data": {
                                "name": name,
                                "phone": phone,
                                "email": email,  # ✅ NOW STORING EMAIL IN CANDIDATE DATA
                                "experience": experience,
                                "skills": skills
                            }
                        }
                        
                        with open(contact_mappings_file, 'w') as f:
                            json.dump(all_mappings, f, indent=2)
                            
                        print(f"[BULK MAPPING] 💾 Stored data for {name} ({phone}) - {email}")
                        
                    except Exception as mapping_error:
                        print(f"[MAPPING ERROR] ❌ {mapping_error}")
                    
                    successful_calls += 1
                    results.append({
                        "name": name,
                        "phone": phone,
                        "email": email,  # ✅ NOW RETURNING EMAIL IN RESULTS
                        "success": True,
                        "call_sid": call.sid,
                        "status": call.status,
                        "error": None
                    })
                    
                    print(f"[BULK SUCCESS] ✅ {name} ({phone}) - {email}: Call SID {call.sid}")
                    
                    # Small delay between calls to avoid rate limiting
                    import time
                    time.sleep(1)
                    
                except Exception as call_error:
                    print(f"[TWILIO ERROR] ❌ Failed to call {name} ({phone}): {call_error}")
                    failed_calls += 1
                    results.append({
                        "name": name,
                        "phone": phone,
                        "email": email,  # ✅ NOW RETURNING EMAIL EVEN IN ERRORS
                        "success": False,
                        "error": str(call_error),
                        "call_sid": None,
                        "status": "failed"
                    })
                    
            except Exception as contact_error:
                print(f"[CONTACT ERROR] ❌ Error processing contact: {contact_error}")
                failed_calls += 1
                results.append({
                    "name": contact.get("name", "Unknown"),
                    "phone": contact.get("phone", "N/A"),
                    "email": contact.get("email", "N/A"),  # ✅ NOW HANDLING EMAIL IN ERRORS
                    "success": False,
                    "error": str(contact_error),
                    "call_sid": None,
                    "status": "failed"
                })
        
        # Save bulk call results
        bulk_data = {
            "bulk_call_id": bulk_call_id,
            "total_candidates": len(contacts),
            "successful_calls": successful_calls,
            "failed_calls": failed_calls,
            "results": results,
            "created_at": datetime.now().isoformat(),
            "status": "COMPLETED"
        }
        
        # Save to persistent storage
        try:
            os.makedirs("bulk_results", exist_ok=True)
            bulk_results_file = f"bulk_results/{bulk_call_id}.json"
            with open(bulk_results_file, 'w') as f:
                json.dump(bulk_data, f, indent=2)
            print(f"[BULK RESULTS] 💾 Saved results to {bulk_results_file}")
        except Exception as save_error:
            print(f"[SAVE ERROR] ❌ Failed to save bulk results: {save_error}")
        
        print("=" * 60)
        print(f"[BULK COMPLETED] ✅ Bulk calling session finished!")
        print(f"[BULK STATS] 📊 Total: {len(contacts)} | Success: {successful_calls} | Failed: {failed_calls}")
        print("=" * 60)
        
        return {
            "success": True,
            "bulk_call_id": bulk_call_id,
            "total_candidates": len(contacts),
            "successful_calls": successful_calls,
            "failed_calls": failed_calls,
            "results": results
        }
        
    except Exception as e:
        print(f"[BULK ERROR] ❌ Bulk calling failed: {e}")
        return {
            "success": False, 
            "error": str(e), 
            "results": [],
            "bulk_call_id": None,
            "total_candidates": 0,
            "successful_calls": 0,
            "failed_calls": 0
        }

@app.post("/voice")
async def voice_webhook(request: Request):
    """Handle incoming Twilio voice calls"""
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        from_number = form_data.get('From')
        to_number = form_data.get('To')
        call_status = form_data.get('CallStatus')
        
        print(f"[VOICE WEBHOOK] 📞 Call {call_sid} from {from_number} to {to_number}, status: {call_status}")
        
        # Load contact mapping if it exists
        contact_info = {}
        try:
            if os.path.exists("contact_mappings.json"):
                with open("contact_mappings.json", 'r') as f:
                    all_mappings = json.load(f)
                    contact_info = all_mappings.get(call_sid, {})
        except Exception as e:
            print(f"[VOICE] Error loading contact mappings: {e}")
        
        # Initialize interview session with EMAIL
        interview_data = {
            "interview_id": call_sid,
            "call_sid": call_sid,
            "candidate_phone": from_number,
            "phone_number": from_number,
            "twilio_number": to_number,
            "candidate_name": contact_info.get("candidate_name", f"Candidate_{call_sid[-8:]}"),
            "candidate_email": contact_info.get("candidate_email", ""),  # ✅ NOW STORING EMAIL
            "candidate_experience": contact_info.get("candidate_experience", ""),
            "candidate_skills": contact_info.get("candidate_skills", ""),
            "is_bulk_call": contact_info.get("is_bulk_call", False),
            "bulk_call_id": contact_info.get("bulk_call_id", None),
            "candidate_skills": contact_info.get("candidate_skills", ""),
            "is_bulk_call": contact_info.get("is_bulk_call", False),
            "bulk_call_id": contact_info.get("bulk_call_id", None),
            "start_time": datetime.now().isoformat(),
            "status": "IN_PROGRESS",
            "current_question": 0,
            "responses": [],
            "validation_results": {},
            "silence_prompts": 0,
            "last_activity": datetime.now().isoformat()
        }
        
        # Generate email if not found in mapping
        if not interview_data["candidate_email"]:
            name = interview_data["candidate_name"]
            if name and not name.startswith("Candidate_"):
                email_name = name.lower().replace(' ', '.').replace('-', '.')
                email_name = re.sub(r'[^a-z0-9.]', '', email_name)
                interview_data["candidate_email"] = f"{email_name}@example.com"
            else:
                phone_suffix = from_number.replace('+', '').replace('-', '').replace(' ', '')[-6:]
                interview_data["candidate_email"] = f"candidate{phone_suffix}@example.com"
        
        print(f"[VOICE SESSION] 📧 Interview session for {interview_data['candidate_name']} - {interview_data['candidate_email']}")
        
        save_interview_session(call_sid, interview_data)
        conversation_state[call_sid] = interview_data
        
        # Start with first question
        resp = VoiceResponse()
        resp.say("Hello! This is an AI assistant from Onelab Ventures. Thank you for your interest in our position.", 
                voice='Polly.Aditi', rate='medium')
        resp.pause(length=0.5)
        resp.say(INTERVIEW_QUESTIONS[0], voice='Polly.Aditi', rate='medium')
        
        gather = resp.gather(
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
        
    except Exception as e:
        print(f"[VOICE ERROR] ❌ {e}")
        resp = VoiceResponse()
        resp.say("Sorry, there was a technical error. Please try again later.", voice='Polly.Aditi')
        resp.hangup()
        return Response(content=str(resp), media_type="application/xml")
# Add this endpoint to get bulk call results
@app.get("/bulk-results")
async def get_bulk_results():
    """Get all saved bulk call results"""
    try:
        bulk_results = []
        bulk_results_folder = "bulk_results"
        
        if os.path.exists(bulk_results_folder):
            json_files = glob.glob(f"{bulk_results_folder}/*.json")
            
            for file_path in json_files:
                try:
                    with open(file_path, 'r') as f:
                        bulk_data = json.load(f)
                    
                    # Extract bulk call ID from filename if not in data
                    filename = os.path.basename(file_path)
                    bulk_call_id = bulk_data.get("bulk_call_id", filename.replace(".json", ""))
                    
                    bulk_result = {
                        "bulk_call_id": bulk_call_id,
                        "total_candidates": bulk_data.get("total_candidates", 0),
                        "successful_calls": bulk_data.get("successful_calls", 0),
                        "failed_calls": bulk_data.get("failed_calls", 0),
                        "created_at": bulk_data.get("created_at", ""),
                        "status": bulk_data.get("status", "COMPLETED"),
                        "results": bulk_data.get("results", [])
                    }
                    
                    bulk_results.append(bulk_result)
                    
                except Exception as e:
                    print(f"Error reading bulk result file {file_path}: {e}")
                    continue
        
        # Sort by created_at (newest first)
        bulk_results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        print(f"[BULK RESULTS] 📊 Returning {len(bulk_results)} bulk call results")
        
        return {
            "success": True,
            "bulk_results": bulk_results,
            "total_count": len(bulk_results)
        }
        
    except Exception as e:
        print(f"[BULK RESULTS ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "bulk_results": [],
            "total_count": 0
        }

# Add this endpoint to get specific bulk call result
@app.get("/bulk-results/{bulk_call_id}")
async def get_bulk_result(bulk_call_id: str):
    """Get specific bulk call result by ID"""
    try:
        bulk_results_file = f"bulk_results/{bulk_call_id}.json"
        
        if not os.path.exists(bulk_results_file):
            return {
                "success": False,
                "error": "Bulk call result not found",
                "bulk_result": None
            }
        
        with open(bulk_results_file, 'r') as f:
            bulk_data = json.load(f)
        
        print(f"[BULK RESULT] 📊 Returning result for bulk call: {bulk_call_id}")
        
        return {
            "success": True,
            "bulk_result": bulk_data
        }
        
    except Exception as e:
        print(f"[BULK RESULT ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "bulk_result": None
        }

# Add this endpoint to delete bulk call results
@app.delete("/bulk-results/{bulk_call_id}")
async def delete_bulk_result(bulk_call_id: str):
    """Delete a specific bulk call result"""
    try:
        bulk_results_file = f"bulk_results/{bulk_call_id}.json"
        
        if not os.path.exists(bulk_results_file):
            return {
                "success": False,
                "error": "Bulk call result not found"
            }
        
        os.remove(bulk_results_file)
        
        print(f"[BULK RESULT] 🗑️ Deleted bulk call result: {bulk_call_id}")
        
        return {
            "success": True,
            "message": f"Bulk call result {bulk_call_id} deleted successfully"
        }
        
    except Exception as e:
        print(f"[BULK RESULT DELETE ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e)
        }

# Add this endpoint to get bulk call statistics
@app.get("/bulk-stats")
async def get_bulk_stats():
    """Get bulk call statistics"""
    try:
        bulk_results_folder = "bulk_results"
        
        if not os.path.exists(bulk_results_folder):
            return {
                "success": True,
                "stats": {
                    "total_bulk_calls": 0,
                    "total_candidates_called": 0,
                    "total_successful_calls": 0,
                    "total_failed_calls": 0,
                    "success_rate": 0.0
                }
            }
        
        json_files = glob.glob(f"{bulk_results_folder}/*.json")
        
        total_bulk_calls = 0
        total_candidates_called = 0
        total_successful_calls = 0
        total_failed_calls = 0
        
        for file_path in json_files:
            try:
                with open(file_path, 'r') as f:
                    bulk_data = json.load(f)
                
                total_bulk_calls += 1
                total_candidates_called += bulk_data.get("total_candidates", 0)
                total_successful_calls += bulk_data.get("successful_calls", 0)
                total_failed_calls += bulk_data.get("failed_calls", 0)
                
            except Exception as e:
                print(f"Error reading bulk stats file {file_path}: {e}")
                continue
        
        success_rate = (total_successful_calls / total_candidates_called * 100) if total_candidates_called > 0 else 0.0
        
        stats = {
            "total_bulk_calls": total_bulk_calls,
            "total_candidates_called": total_candidates_called,
            "total_successful_calls": total_successful_calls,
            "total_failed_calls": total_failed_calls,
            "success_rate": round(success_rate, 2)
        }
        
        print(f"[BULK STATS] 📊 Returning bulk call statistics: {stats}")
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        print(f"[BULK STATS ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "stats": {
                "total_bulk_calls": 0,
                "total_candidates_called": 0,
                "total_successful_calls": 0,
                "total_failed_calls": 0,
                "success_rate": 0.0
            }
        }
@app.get("/api/candidates")
async def get_candidates():
    """Get candidates from interviews with email addresses"""
    try:
        interviews_data = []
        try:
            response = requests.get(f"http://13.204.76.229:8000/interviews-detailed", timeout=30)
            if response.status_code == 200:
                data = response.json()
                interviews_data = data.get("interviews", [])
        except Exception as e:
            print(f"Error fetching interviews: {e}")
            return {"success": False, "error": "Failed to fetch interviews", "candidates": []}
        
        # Process candidates with proper email handling
        candidates = []
        for interview in interviews_data:
            candidate_email = interview.get("candidate_email")
            
            # If no email found, generate one
            if not candidate_email:
                name = interview.get("candidate_name", "")
                phone = interview.get("candidate_phone", "")
                
                if name and not name.startswith("Candidate_"):
                    email_name = name.lower().replace(' ', '.').replace('-', '.')
                    email_name = re.sub(r'[^a-z0-9.]', '', email_name)
                    candidate_email = f"{email_name}@example.com"
                else:
                    clean_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
                    candidate_email = f"candidate{clean_phone[-6:] if len(clean_phone) >= 6 else interview['interview_id'][-6:]}@example.com"
            
            candidates.append({
                "id": interview["interview_id"],
                "name": interview["candidate_name"],
                "phone": interview["candidate_phone"],
                "email": candidate_email,  # ✅ NOW PROPERLY RETURNING EMAIL
                "status": interview["status"]
            })
        
        print(f"[CANDIDATES] 📧 Processed {len(candidates)} candidates with emails")
        
        return {"success": True, "candidates": candidates}
        
    except Exception as e:
        print(f"[CANDIDATES ERROR] ❌ {e}")
        return {"success": False, "error": str(e), "candidates": []}
# Add this endpoint to your existing main.py file
@app.get("/twilio-balance")
async def get_twilio_balance():
    """Get Twilio account balance"""
    try:
        # Get account information from Twilio
        account = client.api.accounts(account_sid).fetch()
        
        # Get balance (this is a string like "-15.00000")
        balance = float(account.balance)
        
        # Format balance properly
        balance_info = {
            "success": True,
            "balance": balance,
            "currency": account.currency or "USD",
            "account_status": account.status,
            "account_sid": account.sid,
            "friendly_name": account.friendly_name,
            "formatted_balance": f"{account.currency or 'USD'} {balance:.2f}"
        }
        
        print(f"[TWILIO BALANCE] 💰 Account balance: {balance_info['formatted_balance']}")
        
        return balance_info
        
    except Exception as e:
        print(f"[TWILIO BALANCE ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "balance": 0.0,
            "currency": "USD",
            "account_status": "unknown",
            "formatted_balance": "USD 0.00"
        }

# Add this endpoint to send assessment links (if it's missing)
@app.post("/send-assessment-link")
async def send_assessment_link(request: Request):
    """Send assessment link to candidate via email"""
    try:
        email_data = await request.json()
        
        candidate_email = email_data.get("email")
        assessment_link = email_data.get("assessmentLink")
        assessment_title = email_data.get("assessmentTitle", "Technical Assessment")
        job_role = email_data.get("jobRole", "Software Developer")
        candidate_name = email_data.get("candidateName", "Candidate")
        experience = email_data.get("experience", 0)
        duration = email_data.get("duration", 60)
        total_questions = email_data.get("totalQuestions", 10)
        
        if not candidate_email or not assessment_link:
            return {
                "success": False,
                "error": "Email and assessment link are required"
            }
        
        # Email configuration (you'll need to set these in your environment)
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = os.getenv("SENDER_EMAIL", "noreply@onelabventures.com")
        sender_password = os.getenv("SENDER_PASSWORD", "your_app_password")
        
        # Create email content
        subject = f"Technical Assessment Invitation - {job_role} Role"
        
        html_body = f"""
        <html>
        <body>
            <h2>Technical Assessment Invitation</h2>
            <p>Dear {candidate_name},</p>
            
            <p>Thank you for your interest in the <strong>{job_role}</strong> position at Onelab Ventures.</p>
            
            <p>We would like to invite you to complete our technical assessment:</p>
            
            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>{assessment_title}</h3>
                <p><strong>Duration:</strong> {duration} minutes</p>
                <p><strong>Total Questions:</strong> {total_questions}</p>
                <p><strong>Experience Level:</strong> {experience} years</p>
            </div>
            
            <p><a href="{assessment_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Assessment</a></p>
            
            <p>Please complete the assessment at your earliest convenience.</p>
            
            <p>Best regards,<br>
            Onelab Ventures Team</p>
            
            <hr>
            <p style="font-size: 12px; color: #666;">
                This is an automated email. Please do not reply to this email.
            </p>
        </body>
        </html>
        """
        
        # For now, just simulate sending (you can implement actual email sending later)
        print(f"[EMAIL SIMULATION] 📧 Sending assessment link to {candidate_email}")
        print(f"[EMAIL SIMULATION] 🔗 Assessment link: {assessment_link}")
        print(f"[EMAIL SIMULATION] 📝 Assessment: {assessment_title}")
        
        # Simulate email sending delay
        import time
        time.sleep(0.5)
        
        return {
            "success": True,
            "message": f"Assessment link sent to {candidate_email}",
            "email": candidate_email,
            "assessment_title": assessment_title,
            "assessment_link": assessment_link
        }
        
    except Exception as e:
        print(f"[EMAIL ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e)
        }

# Add this endpoint to get candidates for assessment (if missing)
@app.get("/report/{assessment_id}")
async def get_assessment_report(assessment_id: str):
    """Get assessment report/results for a specific assessment"""
    try:
        # This would typically call your assessment API
        # For now, returning mock data structure
        
        print(f"[ASSESSMENT REPORT] 📊 Getting report for assessment: {assessment_id}")
        
        # Mock response - replace with actual API call to your assessment system
        mock_candidates = [
            {
                "id": "cand_1",
                "name": "John Doe",
                "email": "john.doe@example.com",
                "score": 85,
                "totalScore": 85,
                "status": "completed",
                "submittedAt": "2024-01-15T10:30:00Z",
                "duration": 3600,
                "answers": []
            },
            {
                "id": "cand_2", 
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "score": 92,
                "totalScore": 92,
                "status": "completed",
                "submittedAt": "2024-01-15T14:20:00Z",
                "duration": 3400,
                "answers": []
            }
        ]
        
        return {
            "success": True,
            "result": mock_candidates,
            "candidates": mock_candidates,
            "assessment_id": assessment_id,
            "total_candidates": len(mock_candidates)
        }
        
    except Exception as e:
        print(f"[ASSESSMENT REPORT ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "result": [],
            "candidates": []
        }

# Add any other missing endpoints your frontend needs
@app.get("/api/assessments")
async def get_assessments():
    """Get available assessments"""
    try:
        # Mock assessments data - replace with actual API call
        assessments = [
            {
                "id": "assessment_1",
                "testName": "Full Stack Developer Assessment",
                "jobRole": "Full Stack Developer",
                "experience": 3,
                "duration": 60,
                "totalTopics": 10,
                "status": "active",
                "assessmentLink": "https://dev.d23pi31x94e0bg.amplifyapp.com/assessment/assessment_1"
            },
            {
                "id": "assessment_2",
                "testName": "React Developer Assessment", 
                "jobRole": "React Developer",
                "experience": 2,
                "duration": 45,
                "totalTopics": 8,
                "status": "active",
                "assessmentLink": "https://dev.d23pi31x94e0bg.amplifyapp.com/assessment/assessment_2"
            }
        ]
        
        return {
            "success": True,
            "assessments": assessments,
            "total_count": len(assessments)
        }
        
    except Exception as e:
        print(f"[ASSESSMENTS ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "assessments": []
        }

# Add this endpoint for bulk email sending (if missing)
@app.post("/api/send-assessment-bulk")
async def send_bulk_assessment_emails(request: Request):
    """Send assessment emails to multiple candidates"""
    try:
        bulk_data = await request.json()
        
        assessment_name = bulk_data.get("assessmentName")
        job_role = bulk_data.get("jobRole")
        assessment_link = bulk_data.get("assessmentLink")
        candidates = bulk_data.get("candidates", [])
        
        if not candidates:
            return {
                "success": False,
                "error": "No candidates provided"
            }
        
        success_count = 0
        failed_count = 0
        results = []
        
        for candidate in candidates:
            try:
                # Simulate sending email to each candidate
                candidate_email = candidate.get("email")
                candidate_name = candidate.get("name", "Candidate")
                
                if not candidate_email:
                    failed_count += 1
                    results.append({
                        "name": candidate_name,
                        "email": "No email provided",
                        "success": False,
                        "error": "No email address"
                    })
                    continue
                
                # Simulate email sending
                print(f"[BULK EMAIL] 📧 Sending to {candidate_name} ({candidate_email})")
                
                # Add small delay to simulate email sending
                import time
                time.sleep(0.1)
                
                success_count += 1
                results.append({
                    "name": candidate_name,
                    "email": candidate_email,
                    "success": True,
                    "error": None
                })
                
            except Exception as e:
                failed_count += 1
                results.append({
                    "name": candidate.get("name", "Unknown"),
                    "email": candidate.get("email", "Unknown"),
                    "success": False,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "message": f"Bulk emails sent! Success: {success_count}, Failed: {failed_count}",
            "total_candidates": len(candidates),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results
        }
        
    except Exception as e:
        print(f"[BULK EMAIL ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }

# Fix the email generation in CSV upload
@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """
    ONLY PROCESSES CSV FILE - NO CALLS ARE MADE HERE!
    This endpoint only parses the CSV and returns contact data.
    """
    try:
        print("=" * 50)
        print("[CSV UPLOAD] 📄 PROCESSING CSV FILE ONLY - NO CALLS!")
        print("=" * 50)
        
        if not file.filename.endswith('.csv'):
            print("[CSV UPLOAD] ❌ Invalid file format")
            return {
                "success": False, 
                "error": "Only CSV files are allowed",
                "contacts": [],
                "total_contacts": 0,
                "message": "Invalid file format"
            }
        
        # Read CSV content
        content = await file.read()
        csv_data = content.decode('utf-8')
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        candidates = list(csv_reader)
        
        if not candidates:
            print("[CSV UPLOAD] ❌ Empty CSV file")
            return {
                "success": False, 
                "error": "No candidates found in CSV",
                "contacts": [],
                "total_contacts": 0,
                "message": "Empty CSV file"
            }
        
        # ⚠️ CRITICAL: ONLY PROCESS CSV DATA - ABSOLUTELY NO CALLING!
        processed_contacts = []
        for candidate in candidates:
            name = candidate.get("name", candidate.get("Name", "")).strip()
            phone = candidate.get("phone", candidate.get("Phone", candidate.get("mobile", candidate.get("Mobile", "")))).strip()
            email = candidate.get("email", candidate.get("Email", "")).strip()
            experience = candidate.get("experience", candidate.get("Experience", "")).strip()
            skills = candidate.get("skills", candidate.get("Skills", "")).strip()
            
            # Clean phone number format
            clean_phone = phone
            clean_phone = phone[1:]
            if phone:
                if phone.startswith('+'):
                    clean_phone = phone[1:]
                
                # Handle double 91 prefix: +91918619570449 -> +918619570449
                if clean_phone.startswith('919') and len(clean_phone) == 13:
                    clean_phone = clean_phone[2:]  # Remove first "91"
                    clean_phone = f"+91{clean_phone}"
                elif clean_phone.startswith('91') and len(clean_phone) == 12:
                    clean_phone = f"+{clean_phone}"
                elif len(clean_phone) == 10:
                    clean_phone = f"+91{clean_phone}"
            
            # Generate email if not provided - FIX THE EMPTY EMAIL ISSUE
            if not email:
                if name:
                    email_name = name.lower().replace(' ', '.').replace('-', '.')
                    # Remove any special characters except dots
                    email_name = re.sub(r'[^a-z0-9.]', '', email_name)
                    email = f"{email_name}@example.com"  # ✅ FIXED: Actually generate email
                elif clean_phone:
                    phone_suffix = clean_phone.replace('+', '').replace('-', '').replace(' ', '')[-6:]
                    email = f"candidate{phone_suffix}@example.com"  # ✅ FIXED: Actually generate email
                else:
                    email = f"candidate{len(processed_contacts)+1}@example.com"  # ✅ FIXED: Actually generate email
            
            # Generate name if not provided
            if not name and clean_phone:
                phone_suffix = clean_phone.replace('+', '')[-4:] if len(clean_phone) >= 4 else "0000"
                name = f"Candidate_{phone_suffix}"
            elif not name:
                name = f"Candidate_{len(processed_contacts)+1}"
            
            processed_contacts.append({
                "name": name,
                "phone": clean_phone or "",
                "email": email,  # ✅ Now properly includes generated email
                "experience": experience,
                "skills": skills
            })
            
            print(f"[CSV PROCESS] 📋 {name} | 📞 {clean_phone} | 📧 {email}")
        
        print(f"[CSV UPLOAD] ✅ Successfully processed {len(processed_contacts)} contacts")
        print(f"[CSV UPLOAD] 📋 Data parsed and ready for frontend display")
        print(f"[CSV UPLOAD] ⚠️  NO TWILIO CALLS MADE - This is CSV processing only!")
        print("=" * 50)
        
        # ✅ RETURN ONLY CONTACT DATA - NO BULK CALL FIELDS!
        return {
            "success": True,
            "contacts": processed_contacts,
            "total_contacts": len(processed_contacts),
            "message": f"✅ {len(processed_contacts)} contacts loaded successfully! Click 'Start AI Bulk Interviews' to begin calling."
        }
        
    except Exception as e:
        print(f"[CSV UPLOAD] ❌ Error: {e}")
        return {
            "success": False, 
            "error": str(e),
            "contacts": [],
            "total_contacts": 0,
            "message": "Failed to process CSV file"
        }
@app.get("/contact-mappings")
async def get_contact_mappings():
    """Get all contact mappings stored in contact_mappings.json"""
    try:
        contact_mappings_file = "contact_mappings.json"
        
        if not os.path.exists(contact_mappings_file):
            return {
                "success": True,
                "mappings": {},
                "total_count": 0,
                "message": "No contact mappings found"
            }
        
        with open(contact_mappings_file, 'r') as f:
            all_mappings = json.load(f)
        
        print(f"[CONTACT MAPPINGS] 📊 Returning {len(all_mappings)} contact mappings")
        
        return {
            "success": True,
            "mappings": all_mappings,
            "total_count": len(all_mappings),
            "message": f"Found {len(all_mappings)} contact mappings"
        }
        
    except Exception as e:
        print(f"[CONTACT MAPPINGS ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "mappings": {},
            "total_count": 0
        }

@app.post("/contact-mappings")
async def save_contact_mappings(request: Request):
    """Save contact mappings to contact_mappings.json"""
    try:
        mappings_data = await request.json()
        contact_mappings_file = "contact_mappings.json"
        
        # Load existing mappings
        if os.path.exists(contact_mappings_file):
            with open(contact_mappings_file, 'r') as f:
                existing_mappings = json.load(f)
        else:
            existing_mappings = {}
        
        # Update with new mappings
        existing_mappings.update(mappings_data)
        
        # Save updated mappings
        with open(contact_mappings_file, 'w') as f:
            json.dump(existing_mappings, f, indent=2)
        
        print(f"[CONTACT MAPPINGS] 💾 Saved {len(mappings_data)} contact mappings")
        
        return {
            "success": True,
            "message": f"Successfully saved {len(mappings_data)} contact mappings",
            "total_mappings": len(existing_mappings)
        }
        
    except Exception as e:
        print(f"[CONTACT MAPPINGS SAVE ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/contact-mappings/{call_sid}")
async def get_contact_mapping(call_sid: str):
    """Get specific contact mapping by call_sid"""
    try:
        contact_mappings_file = "contact_mappings.json"
        
        if not os.path.exists(contact_mappings_file):
            return {
                "success": False,
                "error": "Contact mappings file not found",
                "mapping": None
            }
        
        with open(contact_mappings_file, 'r') as f:
            all_mappings = json.load(f)
        
        mapping = all_mappings.get(call_sid)
        
        if mapping:
            print(f"[CONTACT MAPPING] 📊 Found mapping for call_sid: {call_sid}")
            return {
                "success": True,
                "mapping": mapping,
                "call_sid": call_sid
            }
        else:
            return {
                "success": False,
                "error": "Mapping not found for this call_sid",
                "mapping": None
            }
        
    except Exception as e:
        print(f"[CONTACT MAPPING ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "mapping": None
        }

@app.delete("/contact-mappings/{call_sid}")
async def delete_contact_mapping(call_sid: str):
    """Delete specific contact mapping by call_sid"""
    try:
        contact_mappings_file = "contact_mappings.json"
        
        if not os.path.exists(contact_mappings_file):
            return {
                "success": False,
                "error": "Contact mappings file not found"
            }
        
        with open(contact_mappings_file, 'r') as f:
            all_mappings = json.load(f)
        
        if call_sid in all_mappings:
            del all_mappings[call_sid]
            
            # Save updated mappings
            with open(contact_mappings_file, 'w') as f:
                json.dump(all_mappings, f, indent=2)
            
            print(f"[CONTACT MAPPING] 🗑️ Deleted mapping for call_sid: {call_sid}")
            return {
                "success": True,
                "message": f"Successfully deleted mapping for {call_sid}",
                "remaining_mappings": len(all_mappings)
            }
        else:
            return {
                "success": False,
                "error": "Mapping not found for this call_sid"
            }
        
    except Exception as e:
        print(f"[CONTACT MAPPING DELETE ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.delete("/contact-mappings")
async def clear_all_contact_mappings():
    """Clear all contact mappings"""
    try:
        contact_mappings_file = "contact_mappings.json"
        
        if os.path.exists(contact_mappings_file):
            os.remove(contact_mappings_file)
        
        print(f"[CONTACT MAPPINGS] 🗑️ Cleared all contact mappings")
        
        return {
            "success": True,
            "message": "All contact mappings cleared successfully"
        }
        
    except Exception as e:
        print(f"[CONTACT MAPPINGS CLEAR ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.post("/extract-candidate-info")
async def extract_candidate_info(file: UploadFile = File(...)):
    try:
        # Read PDF file
        pdf_content = await file.read()
        
        # Extract text from PDF using PyPDF2 or similar
        text = extract_text_from_pdf(pdf_content)
        
        # Use regex to extract name, phone, and email
        candidate_info = {
            'name': extract_name(text),
            'phone': extract_phone(text),
            'email': extract_email(text)
        }
        
        return {"success": True, **candidate_info}
    except Exception as e:
        print(f"[PDF EXTRACT ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}

@app.post("/upload-candidates-to-s3")
async def upload_candidates_to_local(request: Request):
    try:
        data = await request.json()
        folder_name = data['folderName']
        candidates_data = data['data']
        
        # Create local directory structure
        local_folder = f"pdf-data/{folder_name}"
        os.makedirs(local_folder, exist_ok=True)
        
        # Local file path
        local_file_path = f"{local_folder}/candidates.json"
        
        # Save JSON data locally
        json_content = json.dumps(candidates_data, indent=2)
        
        try:
            with open(local_file_path, 'w') as f:
                f.write(json_content)
            
            print(f"[LOCAL SAVE] ✅ Saved to: {local_file_path}")
            
            return {
                "success": True, 
                "localPath": local_file_path,
                "folder": folder_name,
                "candidateCount": len(candidates_data.get("candidates", []))
            }
            
        except Exception as save_error:
            print(f"[LOCAL SAVE ERROR] ❌ Failed to save locally: {save_error}")
            return {"success": False, "error": f"Local save failed: {str(save_error)}"}
            
    except Exception as e:
        print(f"[UPLOAD ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}

# Update the download endpoint to read from local storage
@app.get("/download-candidates/{folder_name}")
async def download_candidates_from_local(folder_name: str):
    """Download processed candidates from local storage"""
    try:
        local_file_path = f"pdf-data/{folder_name}/candidates.json"
        
        if not os.path.exists(local_file_path):
            return {"success": False, "error": "Candidates file not found"}
        
        with open(local_file_path, 'r') as f:
            candidates_data = json.load(f)
        
        return {
            "success": True,
            "data": candidates_data,
            "localPath": local_file_path,
            "folder": folder_name
        }
        
    except Exception as e:
        print(f"[LOCAL DOWNLOAD ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}

# Update the list folders endpoint to read from local storage
@app.get("/list-candidate-folders")
async def list_candidate_folders():
    """List all candidate folders in local storage"""
    try:
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            os.makedirs(pdf_data_dir, exist_ok=True)
            return {
                "success": True,
                "folders": [],
                "total_count": 0
            }
        
        folders = []
        for item in os.listdir(pdf_data_dir):
            item_path = os.path.join(pdf_data_dir, item)
            if os.path.isdir(item_path):
                candidates_file = os.path.join(item_path, "candidates.json")
                if os.path.exists(candidates_file):
                    folders.append({
                        "folder_name": item,
                        "local_path": item_path,
                        "candidates_file": candidates_file
                    })
        
        return {
            "success": True,
            "folders": folders,
            "total_count": len(folders)
        }
        
    except Exception as e:
        print(f"[LOCAL LIST ERROR] ❌ {e}")
        return {"success": False, "error": str(e), "folders": []}

# Helper functions for PDF text extraction
def extract_text_from_pdf(pdf_content):
    """Extract text from PDF content"""
    try:
        try:
            import PyPDF2
            import io
            
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            text = ""
            
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            
            return text.strip()
        except ImportError:
            # Fallback: Try using pdfplumber if available
            try:
                import pdfplumber
                import io
                
                with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
                    text = ""
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                
                return text.strip()
            except ImportError:
                # Fallback: Return empty string and log error
                print("[PDF ERROR] No PDF processing library available (PyPDF2 or pdfplumber)")
                return ""
                
    except Exception as e:
        print(f"[PDF TEXT EXTRACT ERROR] ❌ {e}")
        return ""

def extract_name(text):
    """Extract candidate name from resume text"""
    try:
        # Common patterns for names in resumes
        name_patterns = [
            r'^([A-Z][a-zA-Z\s]{2,40})(?:\n|\s{2,})',  # Name at start of document
            r'Name[\s:]+([A-Z][a-zA-Z\s]{2,40})',       # "Name: John Doe"
            r'([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)',       # "First Last" pattern
            r'I am ([A-Z][a-zA-Z\s]{2,40})',            # "I am John Doe"
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                name = match.group(1).strip()
                # Validate name (not too long, no numbers)
                if 2 < len(name) < 50 and not re.search(r'\d', name):
                    return name.title()
        
        return "Unknown"
    except Exception as e:
        print(f"[NAME EXTRACT ERROR] ❌ {e}")
        return "Unknown"

def extract_phone(text):
    """Extract phone number from resume text"""
    try:
        # Phone number patterns
        phone_patterns = [
            r'\+?91[-\s]?[6-9]\d{9}',           # Indian mobile numbers
            r'\+?[1-9]\d{1,3}[-\s]?\d{3,4}[-\s]?\d{6,7}',  # International format
            r'[6-9]\d{9}',                      # 10-digit Indian mobile
            r'\(\d{3}\)\s?\d{3}-?\d{4}',        # (123) 456-7890
            r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}',   # 123-456-7890
        ]
        
        for pattern in phone_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                # Clean and validate phone number
                clean_phone = re.sub(r'[-\s()]', '', match)
                if 10 <= len(clean_phone) <= 15:
                    # Format Indian numbers
                    if len(clean_phone) == 10 and clean_phone[0] in '6789':
                        return f"+91{clean_phone}"
                    elif len(clean_phone) == 12 and clean_phone.startswith('91'):
                        return f"+{clean_phone}"
                    else:
                        return f"+{clean_phone}" if not clean_phone.startswith('+') else clean_phone
        
        return ""
    except Exception as e:
        print(f"[PHONE EXTRACT ERROR] ❌ {e}")
        return ""

def extract_email(text):
    """Extract email address from resume text with enhanced parsing"""
    try:
        # Multiple email patterns with priority
        email_patterns = [
            # Standard email pattern (highest priority)
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            
            # Email with spaces around @ (common OCR error)
            r'\b[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            
            # Email with "at" instead of @
            r'\b[A-Za-z0-9._%+-]+\s*(?:at|AT)\s*[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            
            # Email with dots replaced by spaces (OCR error)
            r'\b[A-Za-z0-9_%+-]+\s*@\s*[A-Za-z0-9\s-]+\s+(?:com|org|net|edu|gov|in|co|io|me|us|uk)\b',
            
            # Email patterns in different formats
            r'(?:email|e-mail|mail)[\s:]+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})',
            r'(?:contact|reach)[\s:]+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})',
        ]
        
        # Additional context-based patterns
        context_patterns = [
            r'(?i)(?:email|e-mail|mail|contact|reach(?:\s+me)?(?:\s+at)?)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
            r'(?i)(?:you can reach me|contact me|email me)[:\s]*(?:at\s+)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
            r'(?i)(?:my email is|email address)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
        ]
        
        all_emails = []
        
        # Extract emails using all patterns
        for pattern in email_patterns + context_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                # Handle tuple returns from context patterns
                email = match[0] if isinstance(match, tuple) else match
                # Clean the email
                email = re.sub(r'\s+', '', email)  # Remove spaces
                email = email.replace(' at ', '@').replace(' AT ', '@')  # Replace "at" with @
                all_emails.append(email.lower())
        
        # Remove duplicates while preserving order
        unique_emails = list(dict.fromkeys(all_emails))
        
        # Filter and prioritize emails
        valid_emails = []
        for email in unique_emails:
            # Basic validation
            if (len(email) > 5 and 
                '@' in email and 
                '.' in email.split('@')[-1] and
                not any(invalid in email.lower() for invalid in [
                    'example.com', 'test.com', 'placeholder', 'sample', 
                    'dummy', 'fake', 'noreply', 'donotreply'
                ])):
                
                # Additional validation
                parts = email.split('@')
                if len(parts) == 2:
                    username, domain = parts
                    if (len(username) >= 2 and 
                        len(domain) >= 4 and 
                        '.' in domain and
                        not domain.startswith('.') and
                        not domain.endswith('.')):
                        valid_emails.append(email)
        
        # Return the first valid email (prioritized by pattern order)
        if valid_emails:
            print(f"[EMAIL EXTRACT] ✅ Found valid email: {valid_emails[0]}")
            return valid_emails[0]
        
        # Fallback: try to extract from social media or portfolio URLs
        url_patterns = [
            r'(?:linkedin\.com/in/|github\.com/)([a-zA-Z0-9._-]+)',
            r'(?:portfolio|website)[\s:]*(?:https?://)?([a-zA-Z0-9._-]+)',
        ]
        
        for pattern in url_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                # Generate email from username
                username = match.lower().replace('-', '.').replace('_', '.')
                generated_email = f"{username}@gmail.com"
                print(f"[EMAIL EXTRACT] 📧 Generated email from profile: {generated_email}")
                return generated_email
        
        print("[EMAIL EXTRACT] ❌ No valid email found")
        return ""
        
    except Exception as e:
        print(f"[EMAIL EXTRACT ERROR] ❌ {e}")
        return ""
@app.get("/download-candidates/{folder_name}")
async def download_candidates_from_s3(folder_name: str):
    """Download processed candidates from S3"""
    try:
        s3_key = f"pdf-data/{folder_name}/candidates.json"
        
        response = s3_client.get_object(Bucket="calling-agent-ai", Key=s3_key)
        candidates_data = json.loads(response['Body'].read())
        
        return {
            "success": True,
            "data": candidates_data,
            "s3Key": s3_key,
            "folder": folder_name
        }
        
    except Exception as e:
        print(f"[S3 DOWNLOAD ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}

# Add endpoint to list all S3 folders
@app.get("/list-candidate-folders")
async def list_candidate_folders():
    """List all candidate folders in S3"""
    try:
        response = s3_client.list_objects_v2(
            Bucket="calling-agent-ai",
            Prefix="pdf-data/",
            Delimiter="/"
        )
        
        folders = []
        for prefix in response.get('CommonPrefixes', []):
            folder_name = prefix['Prefix'].replace('pdf-data/', '').rstrip('/')
            if folder_name:
                folders.append({
                    "folder_name": folder_name,
                    "s3_path": f"s3://calling-agent-ai/pdf-data/{folder_name}/"
                })
        
        return {
            "success": True,
            "folders": folders,
            "total_count": len(folders)
        }
        
    except Exception as e:
        print(f"[S3 LIST ERROR] ❌ {e}")
        return {"success": False, "error": str(e), "folders": []}
@app.post("/voice/speech/{call_sid}")
async def handle_speech_response(call_sid: str, request: Request):
    """Handle speech responses from Twilio"""
    try:
        form_data = await request.form()
        speech_result = form_data.get('SpeechResult', '')
        confidence = form_data.get('Confidence', '0.0')
        
        print(f"[SPEECH] 🎤 Call {call_sid}: '{speech_result}' (confidence: {confidence})")
        
        # Load interview session
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return Response(content=handle_error("Interview session not found"), media_type="application/xml")
        
        current_question = interview_data.get('current_question', 0)
        
        # Store the response
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
        
        # Reset silence prompts
        interview_data['silence_prompts'] = 0
        interview_data['last_activity'] = datetime.now().isoformat()
        
        # Validate the response
        is_valid, validation_action, validation_reason = validate_response_selected_questions(
            call_sid, current_question, speech_result
        )
        
        if not is_valid:
            if validation_action == "call_later":
                save_incomplete_interview(call_sid, interview_data, "call_later")
                resp = VoiceResponse()
                resp.say("Thank you! We'll call you back at a better time. Have a great day!", voice='Polly.Aditi')
                resp.hangup()
                return Response(content=str(resp), media_type="application/xml")
            
            elif validation_action == "not_available":
                save_incomplete_interview(call_sid, interview_data, "not_available")
                resp = VoiceResponse()
                resp.say("Thank you for your time. We'll be in touch soon. Have a great day!", voice='Polly.Aditi')
                resp.hangup()
                return Response(content=str(resp), media_type="application/xml")
        
        # Move to next question
        next_question_index = current_question + 1
        interview_data['current_question'] = next_question_index
        save_interview_session(call_sid, interview_data)
        
        # Check if interview is complete
        if next_question_index >= len(INTERVIEW_QUESTIONS):
            return Response(content=complete_interview(call_sid), media_type="application/xml")
        
        # Ask next question
        return Response(content=ask_next_question_immediately(call_sid, next_question_index), media_type="application/xml")
        
    except Exception as e:
        print(f"[SPEECH ERROR] ❌ {e}")
        return Response(content=handle_error("Sorry, there was an error processing your response."), media_type="application/xml")

@app.post("/voice/no-response/{call_sid}")
async def handle_no_response_endpoint(call_sid: str):
    """Handle no response from candidate"""
    try:
        return Response(content=handle_no_response(call_sid), media_type="application/xml")
    except Exception as e:
        print(f"[NO RESPONSE ERROR] ❌ {e}")
        return Response(content=handle_error("Technical difficulty occurred."), media_type="application/xml")

@app.post("/recording-status")
async def recording_status_callback(request: Request):
    """Handle Twilio recording status callbacks"""
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        recording_url = form_data.get('RecordingUrl')
        recording_status = form_data.get('RecordingStatus')
        recording_duration = form_data.get('RecordingDuration', '0')
        
        print(f"[RECORDING] 📹 Call {call_sid}: {recording_status} ({recording_duration}s)")
        
        return {"status": "received"}
        
    except Exception as e:
        print(f"[RECORDING ERROR] ❌ {e}")
        return {"error": str(e)}

import re
from datetime import datetime

@app.post("/upload-candidates-to-s3")
async def upload_candidates_to_local(request: Request):
    try:
        data = await request.json()
        folder_name = data.get('folderName')  # This will be auto-generated now
        candidates_data = data['data']
        tag = data.get('tag', 'General')
        if not folder_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            tag_slug = tag.lower().replace(' ', '-').replace('_', '-')
            tag_slug = re.sub(r'[^a-z0-9-]', '', tag_slug)  # Remove special chars
            folder_name = f"{tag_slug}_{timestamp}"
        if 'candidates' in candidates_data:
            for candidate in candidates_data['candidates']:
                candidate['tag'] = tag
                candidate['tag_id'] = tag.lower().replace(' ', '_').replace('-', '_')
                candidate['processed_date'] = datetime.now().isoformat()
        tag_folder = tag.lower().replace(' ', '_').replace('-', '_')
        local_folder = f"pdf-data/{tag_folder}/{folder_name}"
        os.makedirs(local_folder, exist_ok=True)
        tag_index_folder = f"pdf-data/{tag_folder}"
        os.makedirs(tag_index_folder, exist_ok=True)
        local_file_path = f"{local_folder}/candidates.json"
        enhanced_data = {
            **candidates_data,
            'tag': tag,
            'tag_id': tag_folder,
            'tag_slug': tag_slug,
            'processed_at': datetime.now().isoformat(),
            'total_candidates': len(candidates_data.get("candidates", [])),
            'folder_name': folder_name,
            'tag_folder': tag_folder,
            'storage_path': local_folder,
            'file_path': local_file_path
        }
        
        json_content = json.dumps(enhanced_data, indent=2)
        try:
            with open(local_file_path, 'w') as f:
                f.write(json_content)
            
            print(f"[LOCAL SAVE] ✅ Saved to: {local_file_path} with tag: {tag}")
            await update_tag_index(tag_folder, folder_name, enhanced_data)
            
            return {
                "success": True, 
                "localPath": local_file_path,
                "folder": folder_name,
                "tag": tag,
                "tag_id": tag_folder,
                "tag_folder": tag_folder,
                "candidateCount": len(candidates_data.get("candidates", []))
            }
            
        except Exception as save_error:
            print(f"[LOCAL SAVE ERROR] ❌ Failed to save locally: {save_error}")
            return {"success": False, "error": f"Local save failed: {str(save_error)}"}
            
    except Exception as e:
        print(f"[UPLOAD ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}

async def update_tag_index(tag_folder: str, batch_folder: str, batch_data: dict):
    """Update the tag index file with new batch information"""
    try:
        tag_index_file = f"pdf-data/{tag_folder}/tag_index.json"
        if os.path.exists(tag_index_file):
            with open(tag_index_file, 'r') as f:
                tag_index = json.load(f)
        else:
            tag_index = {
                "tag_name": batch_data.get('tag', 'Unknown'),
                "tag_id": tag_folder,
                "created_at": datetime.now().isoformat(),
                "total_batches": 0,
                "total_candidates": 0,
                "batches": {}
            }
        tag_index["batches"][batch_folder] = {
            "batch_name": batch_folder,
            "candidate_count": len(batch_data.get("candidates", [])),
            "processed_at": batch_data.get("processed_at"),
            "file_path": f"pdf-data/{tag_folder}/{batch_folder}/candidates.json"
        }
        tag_index["total_batches"] = len(tag_index["batches"])
        tag_index["total_candidates"] = sum(
            batch["candidate_count"] for batch in tag_index["batches"].values()
        )
        tag_index["last_updated"] = datetime.now().isoformat()
        with open(tag_index_file, 'w') as f:
            json.dump(tag_index, f, indent=2)
        
        print(f"[TAG INDEX] ✅ Updated tag index for {tag_folder}: {tag_index['total_candidates']} total candidates")
        
    except Exception as e:
        print(f"[TAG INDEX ERROR] ❌ {e}")
@app.get("/candidates-by-tag/{tag_id}")
async def get_candidates_by_tag(tag_id: str):
    """Get all candidates for a specific tag"""
    try:
        tag_folder = f"pdf-data/{tag_id}"
        tag_index_file = f"{tag_folder}/tag_index.json"
        
        if not os.path.exists(tag_index_file):
            return {
                "success": False,
                "error": f"Tag '{tag_id}' not found",
                "candidates": [],
                "total_count": 0
            }
        with open(tag_index_file, 'r') as f:
            tag_index = json.load(f)
        
        all_candidates = []
        for batch_name, batch_info in tag_index["batches"].items():
            batch_file = batch_info["file_path"]
            if os.path.exists(batch_file):
                try:
                    with open(batch_file, 'r') as f:
                        batch_data = json.load(f)
                    
                    candidates = batch_data.get("candidates", [])
                    for candidate in candidates:
                        candidate["batch_name"] = batch_name
                        candidate["batch_processed_at"] = batch_info["processed_at"]
                    
                    all_candidates.extend(candidates)
                    
                except Exception as e:
                    print(f"[BATCH LOAD ERROR] ❌ Error loading batch {batch_name}: {e}")
                    continue
        
        return {
            "success": True,
            "tag_name": tag_index["tag_name"],
            "tag_id": tag_id,
            "candidates": all_candidates,
            "total_count": len(all_candidates),
            "total_batches": tag_index["total_batches"],
            "last_updated": tag_index.get("last_updated")
        }
        
    except Exception as e:
        print(f"[CANDIDATES BY TAG ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "candidates": [],
            "total_count": 0
        }
@app.get("/tags-summary")
async def get_tags_summary():
    """Get summary of all tags with candidate counts"""
    try:
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            return {
                "success": True,
                "tags": [],
                "total_tags": 0,
                "total_candidates": 0
            }
        
        tags_summary = []
        total_candidates_across_tags = 0
        for tag_folder in os.listdir(pdf_data_dir):
            tag_path = os.path.join(pdf_data_dir, tag_folder)
            if os.path.isdir(tag_path):
                tag_index_file = os.path.join(tag_path, "tag_index.json")
                
                if os.path.exists(tag_index_file):
                    try:
                        with open(tag_index_file, 'r') as f:
                            tag_index = json.load(f)
                        
                        tag_summary = {
                            "tag_id": tag_folder,
                            "tag_name": tag_index.get("tag_name", tag_folder.replace('_', ' ').title()),
                            "total_candidates": tag_index.get("total_candidates", 0),
                            "total_batches": tag_index.get("total_batches", 0),
                            "created_at": tag_index.get("created_at"),
                            "last_updated": tag_index.get("last_updated"),
                            "folder_path": tag_path
                        }
                        
                        tags_summary.append(tag_summary)
                        total_candidates_across_tags += tag_summary["total_candidates"]
                        
                    except Exception as e:
                        print(f"[TAG SUMMARY ERROR] ❌ Error reading tag {tag_folder}: {e}")
                        continue
        tags_summary.sort(key=lambda x: x["total_candidates"], reverse=True)
        
        return {
            "success": True,
            "tags": tags_summary,
            "total_tags": len(tags_summary),
            "total_candidates": total_candidates_across_tags
        }
        
    except Exception as e:
        print(f"[TAGS SUMMARY ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "tags": [],
            "total_tags": 0,
            "total_candidates": 0
        }
@app.get("/list-candidate-folders")
async def list_candidate_folders():
    """List all candidate folders organized by tags"""
    try:
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            os.makedirs(pdf_data_dir, exist_ok=True)
            return {
                "success": True,
                "folders": [],
                "total_count": 0,
                "by_tag": {},
                "tags_summary": []
            }
        
        folders = []
        folders_by_tag = {}
        tags_summary = []
        for tag_folder in os.listdir(pdf_data_dir):
            tag_path = os.path.join(pdf_data_dir, tag_folder)
            if os.path.isdir(tag_path):
                tag_folders = []
                tag_index_file = os.path.join(tag_path, "tag_index.json")
                tag_info = {
                    "tag_id": tag_folder,
                    "tag_name": tag_folder.replace('_', ' ').title(),
                    "total_candidates": 0,
                    "total_batches": 0
                }
                
                if os.path.exists(tag_index_file):
                    try:
                        with open(tag_index_file, 'r') as f:
                            tag_index = json.load(f)
                        tag_info.update({
                            "tag_name": tag_index.get("tag_name", tag_info["tag_name"]),
                            "total_candidates": tag_index.get("total_candidates", 0),
                            "total_batches": tag_index.get("total_batches", 0),
                            "last_updated": tag_index.get("last_updated")
                        })
                    except Exception as e:
                        print(f"[TAG INDEX READ ERROR] ❌ {e}")
                for batch_folder in os.listdir(tag_path):
                    batch_path = os.path.join(tag_path, batch_folder)
                    if os.path.isdir(batch_path):
                        candidates_file = os.path.join(batch_path, "candidates.json")
                        if os.path.exists(candidates_file):
                            folder_info = {
                                "folder_name": batch_folder,
                                "tag_folder": tag_folder,
                                "tag_name": tag_info["tag_name"],
                                "local_path": batch_path,
                                "candidates_file": candidates_file,
                                "full_path": f"{tag_folder}/{batch_folder}"
                            }
                            folders.append(folder_info)
                            tag_folders.append(folder_info)
                
                if tag_folders:
                    folders_by_tag[tag_folder] = tag_folders
                    tags_summary.append(tag_info)
        
        return {
            "success": True,
            "folders": folders,
            "total_count": len(folders),
            "by_tag": folders_by_tag,
            "tags_summary": tags_summary
        }
        
    except Exception as e:
        print(f"[LOCAL LIST ERROR] ❌ {e}")
        return {
            "success": False, 
            "error": str(e), 
            "folders": [],
            "by_tag": {},
            "tags_summary": []
        }
@app.get("/search-candidates")
async def search_candidates(query: str = "", tag_id: str = ""):
    """Search candidates across all tags or within a specific tag"""
    try:
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            return {
                "success": True,
                "candidates": [],
                "total_count": 0,
                "search_query": query,
                "tag_filter": tag_id
            }
        
        all_candidates = []
        if tag_id:
            tag_folders = [tag_id] if os.path.exists(f"{pdf_data_dir}/{tag_id}") else []
        else:
            tag_folders = [f for f in os.listdir(pdf_data_dir) if os.path.isdir(f"{pdf_data_dir}/{f}")]
        for tag_folder in tag_folders:
            tag_path = f"{pdf_data_dir}/{tag_folder}"
            for batch_folder in os.listdir(tag_path):
                if batch_folder == "tag_index.json":
                    continue
                    
                batch_path = os.path.join(tag_path, batch_folder)
                candidates_file = os.path.join(batch_path, "candidates.json")
                
                if os.path.exists(candidates_file):
                    try:
                        with open(candidates_file, 'r') as f:
                            batch_data = json.load(f)
                        
                        candidates = batch_data.get("candidates", [])
                        for candidate in candidates:
                            candidate["tag_folder"] = tag_folder
                            candidate["batch_folder"] = batch_folder
                            
                            # Apply search filter if query provided
                            if query:
                                searchable_text = f"{candidate.get('name', '')} {candidate.get('email', '')} {candidate.get('fileName', '')}".lower()
                                if query.lower() in searchable_text:
                                    all_candidates.append(candidate)
                            else:
                                all_candidates.append(candidate)
                        
                    except Exception as e:
                        print(f"[SEARCH ERROR] ❌ Error searching in {candidates_file}: {e}")
                        continue
        
        return {
            "success": True,
            "candidates": all_candidates,
            "total_count": len(all_candidates),
            "search_query": query,
            "tag_filter": tag_id
        }
        
    except Exception as e:
        print(f"[SEARCH CANDIDATES ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "candidates": [],
            "total_count": 0
        }
# Add these endpoints to your main.py file

@app.get("/interview-questions")
async def get_interview_questions():
    """Get current interview questions"""
    try:
        return {
            "success": True,
            "questions": [
                {"id": key, "question": value} 
                for key, value in INTERVIEW_QUESTIONS.items()
            ]
        }
    except Exception as e:
        print(f"[INTERVIEW QUESTIONS ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "questions": []
        }

@app.post("/update-interview-questions")
async def update_interview_questions(request: Request):
    """Update interview questions"""
    try:
        questions_data = await request.json()
        
        # Update the global INTERVIEW_QUESTIONS dictionary
        global INTERVIEW_QUESTIONS
        for question in questions_data:
            question_id = question.get("id")
            question_text = question.get("question")
            if question_id is not None and question_text:
                INTERVIEW_QUESTIONS[question_id] = question_text
        
        # Save to file for persistence
        questions_file = "interview_questions.json"
        with open(questions_file, 'w') as f:
            json.dump(INTERVIEW_QUESTIONS, f, indent=2)
        
        print(f"[INTERVIEW QUESTIONS] ✅ Updated {len(questions_data)} questions")
        
        return {
            "success": True,
            "message": "Interview questions updated successfully",
            "questions": [
                {"id": key, "question": value} 
                for key, value in INTERVIEW_QUESTIONS.items()
            ]
        }
        
    except Exception as e:
        print(f"[UPDATE INTERVIEW QUESTIONS ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.get("/local-tags-summary")
async def get_local_tags_summary():
    """Get summary of local tags from the pdf-data directory"""
    try:
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            print(f"[LOCAL TAGS] 📁 pdf-data directory not found")
            return {
                "success": True,
                "tags": [],
                "total_tags": 0
            }
        
        tags_summary = []
        print(f"[LOCAL TAGS] 🔍 Scanning pdf-data directory...")
        
        # ✅ FIX: Scan all subdirectories for tag patterns
        for item in os.listdir(pdf_data_dir):
            item_path = os.path.join(pdf_data_dir, item)
            if os.path.isdir(item_path):
                print(f"[LOCAL TAGS] 📁 Found directory: {item}")
                
                # ✅ Check if this is a tag folder (contains candidates.json)
                candidates_file = os.path.join(item_path, "candidates.json")
                if os.path.exists(candidates_file):
                    try:
                        with open(candidates_file, 'r') as f:
                            data = json.load(f)
                        
                        # ✅ Extract tag information from the JSON metadata
                        metadata = data.get("metadata", {})
                        tag_name = metadata.get("tag_name") or data.get("tag", "Unknown Tag")
                        tag_id = metadata.get("tag_id") or item
                        total_candidates = metadata.get("total_candidates") or len(data.get("candidates", []))
                        
                        tags_summary.append({
                            "tag_id": tag_id,
                            "tag_name": tag_name,
                            "total_candidates": total_candidates,
                            "total_batches": 1,
                            "created_at": metadata.get("created_at") or data.get("processedAt"),
                            "last_updated": metadata.get("last_updated") or data.get("processedAt"),
                            "folder_path": f"pdf-data/{item}"
                        })
                        
                        print(f"[LOCAL TAGS] ✅ Found tag: {tag_name} with {total_candidates} candidates in {item}")
                        
                    except Exception as e:
                        print(f"[LOCAL TAGS] ❌ Error reading {candidates_file}: {e}")
                        continue
                else:
                    print(f"[LOCAL TAGS] ⚠️  No candidates.json found in {item}")
        
        # Sort by total_candidates descending
        tags_summary.sort(key=lambda x: x["total_candidates"], reverse=True)
        
        print(f"[LOCAL TAGS] 📊 Found {len(tags_summary)} local tags total")
        
        return {
            "success": True,
            "tags": tags_summary,
            "total_tags": len(tags_summary)
        }
        
    except Exception as e:
        print(f"[LOCAL TAGS SUMMARY ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "tags": [],
            "total_tags": 0
        }

@app.get("/local-candidates-by-tag/{tag_id}")
async def get_local_candidates_by_tag(tag_id: str):
    """Get candidates from local storage for a specific tag"""
    try:
        print(f"[LOCAL CANDIDATES] 🔍 Looking for tag: {tag_id}")
        pdf_data_dir = "pdf-data"
        
        # ✅ FIX: Search for folders that match the tag pattern
        matching_folders = []
        if os.path.exists(pdf_data_dir):
            for item in os.listdir(pdf_data_dir):
                item_path = os.path.join(pdf_data_dir, item)
                if os.path.isdir(item_path):
                    candidates_file = os.path.join(item_path, "candidates.json")
                    if os.path.exists(candidates_file):
                        try:
                            with open(candidates_file, 'r') as f:
                                data = json.load(f)
                            
                            # Check if this folder matches the requested tag
                            metadata = data.get("metadata", {})
                            folder_tag_id = metadata.get("tag_id") or item.split('_')[0]
                            
                            if folder_tag_id == tag_id or item.startswith(tag_id):
                                matching_folders.append((item_path, data))
                                print(f"[LOCAL CANDIDATES] ✅ Found matching folder: {item}")
                                
                        except Exception as e:
                            print(f"[LOCAL CANDIDATES] ❌ Error reading {candidates_file}: {e}")
                            continue
        
        if not matching_folders:
            print(f"[LOCAL CANDIDATES] ❌ No folders found for tag: {tag_id}")
            return {
                "success": False,
                "error": f"No data found for tag '{tag_id}'",
                "candidates": []
            }
        
        # ✅ Combine all candidates from matching folders
        all_candidates = []
        tag_name = tag_id
        
        for folder_path, data in matching_folders:
            candidates = data.get("candidates", [])
            folder_name = os.path.basename(folder_path)
            
            # Get tag name from metadata
            metadata = data.get("metadata", {})
            if metadata.get("tag_name"):
                tag_name = metadata["tag_name"]
            elif data.get("tag"):
                tag_name = data["tag"]
            
            for candidate in candidates:
                candidate["batch_name"] = folder_name
                candidate["tag"] = tag_name
                all_candidates.append(candidate)
        
        print(f"[LOCAL CANDIDATES] 📊 Found {len(all_candidates)} candidates for tag {tag_id}")
        
        return {
            "success": True,
            "candidates": all_candidates,
            "tag_name": tag_name,
            "tag_id": tag_id,
            "total_candidates": len(all_candidates)
        }
        
    except Exception as e:
        print(f"[LOCAL CANDIDATES BY TAG ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "candidates": []
        }

@app.delete("/delete-tag/{tag_id}")
async def delete_tag(tag_id: str):
    """
    Delete a tag and all associated candidate data (batches) from pdf-data.
    """
    try:
        tag_folder = f"pdf-data/{tag_id}"
        if not os.path.exists(tag_folder):
            return {"success": False, "error": f"Tag '{tag_id}' not found"}
        shutil.rmtree(tag_folder)
        print(f"[TAG DELETE] 🗑️ Deleted tag folder: {tag_folder}")
        return {"success": True, "message": f"Tag '{tag_id}' and all data deleted"}
    except Exception as e:
        print(f"[TAG DELETE ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}
@app.get("/candidates-by-tag/{tag_id}")
async def get_candidates_by_tag(tag_id: str):
    """Get all candidates for a specific tag"""
    try:
        tag_folder = f"pdf-data/{tag_id}"
        
        if not os.path.exists(tag_folder):
            # Try to find folder that starts with tag_id
            pdf_data_dir = "pdf-data"
            if os.path.exists(pdf_data_dir):
                for item in os.listdir(pdf_data_dir):
                    if item.startswith(tag_id) and os.path.isdir(os.path.join(pdf_data_dir, item)):
                        tag_folder = os.path.join(pdf_data_dir, item)
                        break
        
        all_candidates = []
        tag_name = tag_id
        
        if os.path.exists(tag_folder):
            # Check if it's a direct candidates.json file
            candidates_file = os.path.join(tag_folder, "candidates.json")
            if os.path.exists(candidates_file):
                try:
                    with open(candidates_file, 'r') as f:
                        data = json.load(f)
                    
                    candidates = data.get("candidates", [])
                    metadata = data.get("metadata", {})
                    tag_name = metadata.get("tag_name") or data.get("tag", tag_id)
                    
                    for candidate in candidates:
                        candidate["batch_name"] = "main"
                        candidate["tag"] = tag_name
                    
                    all_candidates.extend(candidates)
                    
                except Exception as e:
                    print(f"Error reading {candidates_file}: {e}")
            
            # Also check subdirectories for multiple batches
            try:
                for item in os.listdir(tag_folder):
                    item_path = os.path.join(tag_folder, item)
                    if os.path.isdir(item_path):
                        sub_candidates_file = os.path.join(item_path, "candidates.json")
                        if os.path.exists(sub_candidates_file):
                            try:
                                with open(sub_candidates_file, 'r') as f:
                                    sub_data = json.load(f)
                                
                                sub_candidates = sub_data.get("candidates", [])
                                sub_metadata = sub_data.get("metadata", {})
                                if sub_metadata.get("tag_name"):
                                    tag_name = sub_metadata["tag_name"]
                                
                                for candidate in sub_candidates:
                                    candidate["batch_name"] = item
                                    candidate["tag"] = tag_name
                                
                                all_candidates.extend(sub_candidates)
                                
                            except Exception as e:
                                print(f"Error reading {sub_candidates_file}: {e}")
                                continue
            except Exception as e:
                print(f"Error scanning subdirectories in {tag_folder}: {e}")
        
        if len(all_candidates) == 0:
            return {
                "success": False,
                "error": f"No candidates found for tag '{tag_id}'",
                "candidates": [],
                "total_count": 0
            }
        
        return {
            "success": True,
            "tag_name": tag_name,
            "tag_id": tag_id,
            "candidates": all_candidates,
            "total_count": len(all_candidates)
        }
        
    except Exception as e:
        print(f"[CANDIDATES BY TAG ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "candidates": [],
            "total_count": 0
        }

@app.get("/candidates-by-tag-exact/{tag_name}")
async def get_candidates_by_exact_tag(tag_name: str):
    """Get candidates for EXACT tag name (case-sensitive)"""
    try:
        decoded_tag_name = urllib.parse.unquote(tag_name)
        print(f"[EXACT TAG SEARCH] Looking for EXACT tag: '{decoded_tag_name}'")
        
        all_candidates = []
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            return {
                "success": False,
                "error": f"No data directory found",
                "candidates": [],
                "total_count": 0
            }
        
        # Search all folders for EXACT tag name match
        for folder_name in os.listdir(pdf_data_dir):
            folder_path = os.path.join(pdf_data_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue
                
            candidates_file = os.path.join(folder_path, "candidates.json")
            if os.path.exists(candidates_file):
                try:
                    with open(candidates_file, 'r') as f:
                        data = json.load(f)
                    
                    # Check for EXACT tag name match (case-sensitive)
                    file_tag = data.get("tag") or data.get("metadata", {}).get("tag_name")
                    
                    if file_tag == decoded_tag_name:  # EXACT match
                        candidates = data.get("candidates", [])
                        print(f"[EXACT MATCH] Found {len(candidates)} candidates in {folder_name} for tag '{file_tag}'")
                        
                        for candidate in candidates:
                            candidate["tag"] = decoded_tag_name
                            candidate["batch_name"] = folder_name
                        
                        all_candidates.extend(candidates)
                        
                except Exception as e:
                    print(f"Error reading {candidates_file}: {e}")
                    continue
        
        print(f"[EXACT TAG SEARCH] Total candidates found for '{decoded_tag_name}': {len(all_candidates)}")
        
        if len(all_candidates) == 0:
            return {
                "success": False,
                "error": f"No candidates found for EXACT tag '{decoded_tag_name}'",
                "candidates": [],
                "total_count": 0
            }
        
        return {
            "success": True,
            "tag_name": decoded_tag_name,
            "candidates": all_candidates,
            "total_count": len(all_candidates)
        }
        
    except Exception as e:
        print(f"[EXACT TAG SEARCH ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "candidates": [],
            "total_count": 0
        }

@app.post("/search-candidates-exact")
async def search_candidates_exact(request: dict):
    """Search for candidates with EXACT tag name match"""
    try:
        tag_name = request.get("tag_name")
        case_sensitive = request.get("case_sensitive", True)
        
        print(f"[EXACT SEARCH] Looking for tag: '{tag_name}' (case_sensitive: {case_sensitive})")
        
        all_candidates = []
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            return {"success": False, "candidates": [], "error": "No data directory"}
        
        for folder_name in os.listdir(pdf_data_dir):
            folder_path = os.path.join(pdf_data_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue
                
            candidates_file = os.path.join(folder_path, "candidates.json")
            if os.path.exists(candidates_file):
                try:
                    with open(candidates_file, 'r') as f:
                        data = json.load(f)
                    
                    file_tag = data.get("tag") or data.get("metadata", {}).get("tag_name")
                    
                    # EXACT case-sensitive match
                    if case_sensitive and file_tag == tag_name:
                        candidates = data.get("candidates", [])
                        for candidate in candidates:
                            candidate["tag"] = tag_name
                            candidate["batch_name"] = folder_name
                        all_candidates.extend(candidates)
                        print(f"[EXACT MATCH] Found {len(candidates)} candidates in {folder_name}")
                    
                except Exception as e:
                    print(f"Error reading {candidates_file}: {e}")
                    continue
        
        return {
            "success": True,
            "candidates": all_candidates,
            "total_count": len(all_candidates),
            "search_tag": tag_name
        }
        
    except Exception as e:
        print(f"[EXACT SEARCH ERROR] ❌ {e}")
        return {"success": False, "candidates": [], "error": str(e)}

@app.get("/local-tags-summary-exact")
async def get_local_tags_summary_exact():
    """Get case-sensitive tag summary"""
    try:
        tags_summary = {}
        pdf_data_dir = "pdf-data"
        
        if not os.path.exists(pdf_data_dir):
            return {"success": True, "tags": []}
        
        for folder_name in os.listdir(pdf_data_dir):
            folder_path = os.path.join(pdf_data_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue
                
            candidates_file = os.path.join(folder_path, "candidates.json")
            if os.path.exists(candidates_file):
                try:
                    with open(candidates_file, 'r') as f:
                        data = json.load(f)
                    
                    # Get EXACT tag name
                    tag_name = data.get("tag") or data.get("metadata", {}).get("tag_name")
                    
                    if tag_name:
                        if tag_name not in tags_summary:
                            # Create tag_id from exact name for URL safety
                            tag_id = tag_name.lower().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                            tags_summary[tag_name] = {
                                "tag_id": tag_id,
                                "tag_name": tag_name,  # Keep EXACT case
                                "total_candidates": 0,
                                "total_batches": 0,
                                "folders": []
                            }
                        
                        candidates = data.get("candidates", [])
                        tags_summary[tag_name]["total_candidates"] += len(candidates)
                        tags_summary[tag_name]["total_batches"] += 1
                        tags_summary[tag_name]["folders"].append(folder_name)
                        
                except Exception as e:
                    print(f"Error reading {candidates_file}: {e}")
                    continue
        
        tags_list = list(tags_summary.values())
        print(f"[EXACT TAGS SUMMARY] Found {len(tags_list)} unique case-sensitive tags")
        
        return {
            "success": True,
            "tags": tags_list,
            "total_tags": len(tags_list)
        }
        
    except Exception as e:
        print(f"[EXACT TAGS SUMMARY ERROR] ❌ {e}")
        return {"success": False, "error": str(e), "tags": []}