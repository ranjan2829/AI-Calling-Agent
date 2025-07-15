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
        # Text based - NLP/LLM/RAG, agents, chatbots, hugging face
        "nlp", "natural language processing", "llm", "large language model", 
        "rag", "retrieval augmented generation", "agents", "chatbot", "chatbots",
        "hugging face", "transformers", "bert", "gpt", "openai", "text processing", 
        "language models", "text based", "huggingface",
        
        # Deep Learning/CNN - YOLO, stable diffusion etc image based models
        "deep learning", "neural network", "cnn", "convolutional neural network",
        "yolo", "stable diffusion", "computer vision", "image processing", 
        "object detection", "image based models", "convolutional", "pytorch", 
        "tensorflow", "keras", "generative ai", "diffusion models", "image models",
        
        # ML - regression, clustering algorithms, unsupervised/supervised algorithms
        "machine learning", "ml", "regression", "clustering", "clustering algorithms",
        "supervised", "unsupervised", "supervised algorithms", "unsupervised algorithms",
        "classification", "random forest", "svm", "decision tree", "xgboost",
        "k-means", "linear regression", "logistic regression", "naive bayes",
        
        # Knowledge of fine-tuning/training of any model (ML,DL,NLP/LLM)
        "fine-tuning", "fine tuning", "model training", "training", "transfer learning",
        "hyperparameter tuning", "optimization", "model fine-tuning", "training models",
        "fine tuned", "model optimization", "training algorithms",
        
        # Cloud knowledge and experience - AWS (ec2,s3,sagemaker,ecr), Azure, GCP
        "aws", "amazon web services", "ec2", "s3", "sagemaker", "ecr", 
        "azure", "microsoft azure", "gcp", "google cloud", "google cloud platform",
        "cloud computing", "cloud", "cloud knowledge", "cloud experience",
        
        # Deployment knowledge - docker, kubernetes etc
        "docker", "kubernetes", "deployment", "containerization", "k8s",
        "container", "orchestration", "ci/cd", "devops", "deployment knowledge",
        
        # API knowledge and experience - FastAPI, REST API, Flask API or AI/ML APIs
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
                        
                        # Callback fields
                        "callback_requested": interview_data.get("callback_requested", False),
                        "callback_response": interview_data.get("callback_response", ""),
                        "callback_request_time": interview_data.get("callback_request_time", ""),
                        "preferred_time": interview_data.get("preferred_time", "")
                    }
                    
                    print(f"📊 Processed interview {call_sid}: status='{processed_interview['status']}', name='{candidate_name}'")
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
                        # Process session data similar to above
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
                            
                            # Callback fields
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
# Add this to your main.py file
@app.get("/interview-details/{interview_id}")
async def get_interview_details(interview_id: str):
    """Get detailed information for a specific interview"""
    try:
        print(f"[INTERVIEW DETAILS] Loading details for interview: {interview_id}")
        
        # Search in completed interview files
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
        
        # Check session files
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
            
            if not name and clean_phone:
                phone_suffix = clean_phone.replace('+', '')[-4:] if len(clean_phone) >= 4 else "0000"
                name = f"Candidate_{phone_suffix}"
            
            processed_contacts.append({
                "name": name or "Unknown",
                "phone": clean_phone or "",
                "email": email,
                "experience": experience,
                "skills": skills
            })
        
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
                
                print(f"[BULK CALL] 📞 Processing {index + 1}/{len(contacts)}: {name} ({phone})")
                
                if not phone:
                    print(f"[BULK CALL] ⚠️  Skipping {name} - No phone number")
                    failed_calls += 1
                    results.append({
                        "name": name or "Unknown",
                        "phone": "N/A",
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
                    
                    # Store contact mapping for the interview
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
                            "candidate_email": email,
                            "candidate_experience": experience,
                            "candidate_skills": skills,
                            "is_bulk_call": True,
                            "bulk_call_id": bulk_call_id,
                            "recording_enabled": True,
                            "candidate_data": {
                                "name": name,
                                "phone": phone,
                                "email": email,
                                "experience": experience,
                                "skills": skills
                            }
                        }
                        
                        with open(contact_mappings_file, 'w') as f:
                            json.dump(all_mappings, f, indent=2)
                            
                        print(f"[BULK MAPPING] 💾 Stored data for {name} ({phone})")
                        
                    except Exception as mapping_error:
                        print(f"[MAPPING ERROR] ❌ {mapping_error}")
                    
                    successful_calls += 1
                    results.append({
                        "name": name,
                        "phone": phone,
                        "success": True,
                        "call_sid": call.sid,
                        "status": call.status,
                        "error": None
                    })
                    
                    print(f"[BULK SUCCESS] ✅ {name} ({phone}): Call SID {call.sid}")
                    
                    # Small delay between calls to avoid rate limiting
                    import time
                    time.sleep(1)
                    
                except Exception as call_error:
                    print(f"[TWILIO ERROR] ❌ Failed to call {name} ({phone}): {call_error}")
                    failed_calls += 1
                    results.append({
                        "name": name,
                        "phone": phone,
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
@app.post("/make-call")
async def make_single_call(request: Request):
    """Make a single AI interview call"""
    try:
        data = await request.json()
        phone_number = data.get("phone_number", "").strip()
        
        if not phone_number:
            return {"success": False, "error": "Phone number is required"}
        
        # Clean phone number format
        clean_phone = phone_number
        if phone_number.startswith('+'):
            clean_phone = phone_number
        elif phone_number.startswith('91') and len(phone_number) == 12:
            clean_phone = f"+{phone_number}"
        elif len(phone_number) == 10:
            clean_phone = f"+91{phone_number}"
        
        print(f"[SINGLE CALL] 📞 Making call to {clean_phone}")
        
        # Make the actual Twilio call
        call = client.calls.create(
            url=f"{WEBHOOK_BASE_URL}/voice",
            to=clean_phone,
            from_="+14787807480",
            record=True,
            recording_channels="dual",
            recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
        )
        
        print(f"[SINGLE CALL] ✅ Call created: {call.sid}")
        
        return {
            "success": True,
            "call_sid": call.sid,
            "status": call.status,
            "to": clean_phone,
            "from": "+14787807480",
            "message": f"Call initiated successfully to {clean_phone}"
        }
        
    except Exception as e:
        print(f"[SINGLE CALL ERROR] ❌ {e}")
        return {
            "success": False,
            "error": str(e),
            "call_sid": None
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
        
        # Initialize interview session
        interview_data = {
            "interview_id": call_sid,
            "call_sid": call_sid,
            "candidate_phone": from_number,
            "phone_number": from_number,
            "twilio_number": to_number,
            "candidate_name": contact_info.get("candidate_name", f"Candidate_{call_sid[-8:]}"),
            "candidate_email": contact_info.get("candidate_email", ""),
            "candidate_experience": contact_info.get("candidate_experience", ""),
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

@app.post("/voice/speech/{call_sid}")
async def handle_speech(call_sid: str, request: Request):
    """Handle speech responses from candidates"""
    try:
        form_data = await request.form()
        speech_result = form_data.get('SpeechResult', '')
        confidence = form_data.get('Confidence', '0')
        
        print(f"[SPEECH] 🎤 Call {call_sid}: '{speech_result}' (confidence: {confidence})")
        
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return Response(content=handle_error("Interview session not found"), media_type="application/xml")
        
        current_question = interview_data.get('current_question', 0)
        
        # Save response
        response_data = {
            "question_number": current_question,
            "question": INTERVIEW_QUESTIONS.get(current_question, "Unknown question"),
            "answer": speech_result,
            "confidence": float(confidence) if confidence else 0.0,
            "timestamp": datetime.now().isoformat()
        }
        
        interview_data['responses'].append(response_data)
        interview_data['last_activity'] = datetime.now().isoformat()
        interview_data['silence_prompts'] = 0  # Reset silence counter
        
        # Validate response
        is_valid, action, reason = validate_response_selected_questions(call_sid, current_question, speech_result)
        
        if not is_valid:
            if action == "call_later":
                resp = VoiceResponse()
                resp.say("I understand you'd like to reschedule. We'll call you back at a more convenient time. Thank you!", 
                        voice='Polly.Aditi')
                resp.hangup()
                
                interview_data['status'] = 'CALLBACK_REQUESTED'
                interview_data['end_time'] = datetime.now().isoformat()
                save_incomplete_interview(call_sid, interview_data, "call_later")
                return Response(content=str(resp), media_type="application/xml")
                
            elif action == "not_available":
                resp = VoiceResponse()
                resp.say("I understand this isn't a good time. Thank you for your time. Have a great day!", 
                        voice='Polly.Aditi')
                resp.hangup()
                
                interview_data['status'] = 'NOT_STARTED'
                interview_data['end_time'] = datetime.now().isoformat()
                save_incomplete_interview(call_sid, interview_data, "not_available")
                return Response(content=str(resp), media_type="application/xml")
        
        # Move to next question
        next_question = current_question + 1
        interview_data['current_question'] = next_question
        save_interview_session(call_sid, interview_data)
        
        # Check if interview is complete
        if next_question > len(INTERVIEW_QUESTIONS) - 1:
            return Response(content=complete_interview(call_sid), media_type="application/xml")
        
        # Ask next question using the existing function
        return Response(content=ask_next_question_immediately(call_sid, next_question), media_type="application/xml")
        
    except Exception as e:
        print(f"[SPEECH ERROR] ❌ Call {call_sid}: {e}")
        return Response(content=handle_error("Sorry, there was an error processing your response."), media_type="application/xml")

@app.post("/recording-status")
async def recording_status_callback(request: Request):
    """Handle Twilio recording status callbacks"""
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        recording_sid = form_data.get('RecordingSid')
        recording_url = form_data.get('RecordingUrl')
        recording_status = form_data.get('RecordingStatus')
        recording_duration = form_data.get('RecordingDuration')
        
        print(f"[RECORDING] 🎙️ Call {call_sid}: Recording {recording_sid} status: {recording_status}")
        
        if recording_status == 'completed' and recording_url:
            print(f"[RECORDING] ✅ Recording completed: {recording_url}")
            
            # Save recording info to interview session if it exists
            try:
                interview_data = load_interview_session(call_sid)
                if interview_data:
                    interview_data['recording_sid'] = recording_sid
                    interview_data['recording_url'] = recording_url
                    interview_data['recording_duration'] = recording_duration
                    interview_data['recording_status'] = recording_status
                    save_interview_session(call_sid, interview_data)
                    print(f"[RECORDING] 💾 Saved recording info to session {call_sid}")
                else:
                    # Try to find completed interview file and update it
                    pattern = f"interviews/*{call_sid}*.json"
                    files = glob.glob(pattern)
                    for file_path in files:
                        if "session_" not in file_path:
                            try:
                                with open(file_path, 'r') as f:
                                    data = json.load(f)
                                data['recording_sid'] = recording_sid
                                data['recording_url'] = recording_url
                                data['recording_duration'] = recording_duration
                                data['recording_status'] = recording_status
                                with open(file_path, 'w') as f:
                                    json.dump(data, f, indent=2)
                                print(f"[RECORDING] 💾 Updated completed interview file: {file_path}")
                                break
                            except Exception as e:
                                print(f"[RECORDING] ❌ Error updating file {file_path}: {e}")
            except Exception as e:
                print(f"[RECORDING] ❌ Error saving recording info: {e}")
        
        return {"status": "received"}
        
    except Exception as e:
        print(f"[RECORDING ERROR] ❌ {e}")
        return {"status": "error", "message": str(e)}

@app.post("/voice/no-response/{call_sid}")
async def handle_no_response_webhook(call_sid: str, request: Request):
    """Handle when candidate doesn't respond"""
    try:
        print(f"[NO RESPONSE] 🔇 Call {call_sid} - No response detected")
        return Response(content=handle_no_response(call_sid), media_type="application/xml")
    except Exception as e:
        print(f"[NO RESPONSE ERROR] ❌ Call {call_sid}: {e}")
        return Response(content=handle_error("Technical difficulty occurred."), media_type="application/xml")
@app.get("/contact-mappings")
async def get_contact_mappings():
    """Get contact mappings from contact_mappings.json"""
    try:
        mappings_file = 'contact_mappings.json'
        if os.path.exists(mappings_file):
            with open(mappings_file, 'r') as f:
                mappings = json.load(f)
            print(f"✅ Loaded {len(mappings)} contact mappings from file")
            
            # Debug: Print first few mappings
            for call_id, data in list(mappings.items())[:3]:
                candidate_name = data.get('candidate_name') or (data.get('candidate_data', {}).get('name', 'No Name'))
                candidate_phone = data.get('candidate_phone') or (data.get('candidate_data', {}).get('phone', 'No Phone'))
                print(f"📋 Sample mapping: {call_id} -> {candidate_name} ({candidate_phone})")
            
            return {
                'success': True,
                'mappings': mappings,
                'count': len(mappings)
            }
        else:
            print("❌ contact_mappings.json not found")
            return {
                'success': True,
                'mappings': {},
                'count': 0
            }
    except Exception as e:
        print(f"❌ Error loading contact mappings: {e}")
        return {
            'success': False,
            'error': str(e),
            'mappings': {},
            'count': 0
        }

@app.get("/interview-questions")
async def get_interview_questions():
    """Get current interview questions"""
    try:
        questions = []
        for q_id, question_text in INTERVIEW_QUESTIONS.items():
            questions.append({
                "id": q_id,
                "question": question_text
            })
        
        print(f"✅ Returning {len(questions)} interview questions")
        return {
            "success": True,
            "questions": questions
        }
    except Exception as e:
        print(f"❌ Error getting interview questions: {e}")
        return {
            "success": False,
            "error": str(e),
            "questions": []
        }
@app.post("/update-interview-questions")
async def update_interview_questions(request: Request):
    """Update interview questions"""
    try:
        data = await request.json()
        questions = data.get("questions", [])
        
        print(f"📝 Received {len(questions)} questions to update")
        
        if not questions:
            return {"success": False, "error": "No questions provided"}
        global INTERVIEW_QUESTIONS
        
        for question in questions:
            q_id = question.get("id")
            q_text = question.get("question", "").strip()
            if q_id is not None and q_text:
                INTERVIEW_QUESTIONS[q_id] = q_text
                print(f"📝 Updated Q{q_id}: {q_text[:50]}...")
        try:
            questions_config = {
                "questions": INTERVIEW_QUESTIONS,
                "updated_at": datetime.now().isoformat()
            }
            
            with open("interview_questions.json", "w") as f:
                json.dump(questions_config, f, indent=2)
            
            print(f"💾 Saved questions to interview_questions.json")
            
        except Exception as save_error:
            print(f"⚠️ Warning: Could not save questions to file: {save_error}")
        
        print(f"✅ Successfully updated {len(questions)} interview questions")
        
        return {
            "success": True,
            "message": "Interview questions updated successfully",
            "updated_count": len(questions)
        }
        
    except Exception as e:
        print(f"❌ Error updating interview questions: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/bulk-results")
async def get_bulk_results():
    """Get all saved bulk call results"""
    try:
        results_folder = "bulk_results"
        if not os.path.exists(results_folder):
            return {"success": True, "bulk_results": []}

        all_results = []
        for filename in os.listdir(results_folder):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(results_folder, filename), 'r') as f:
                        data = json.load(f)
                        all_results.append(data)
                except Exception as e:
                    print(f"Error reading bulk result file {filename}: {e}")
                    continue
        
        # Sort by creation date, newest first
        all_results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {"success": True, "bulk_results": all_results}
    except Exception as e:
        print(f"Error getting bulk results: {e}")
        return {"success": False, "error": str(e)}

def load_questions_from_file():
    """Load questions from file if it exists"""
    try:
        if os.path.exists("interview_questions.json"):
            with open("interview_questions.json", "r") as f:
                data = json.load(f)
                questions = data.get("questions", {})
                
                print(f"📂 Found saved questions file with {len(questions)} questions")
                
                # Convert string keys to integers and update global INTERVIEW_QUESTIONS
                global INTERVIEW_QUESTIONS
                old_questions = INTERVIEW_QUESTIONS.copy()
                
                for key, value in questions.items():
                    INTERVIEW_QUESTIONS[int(key)] = value
                    if old_questions.get(int(key)) != value:
                        print(f"🔄 Updated Q{key}: {value[:50]}...")
                
                print(f"✅ Loaded {len(questions)} interview questions from file")
                print("📋 Questions loaded from file:")
                for q_id in sorted(INTERVIEW_QUESTIONS.keys()):
                    print(f"  Q{q_id}: {INTERVIEW_QUESTIONS[q_id][:60]}...")
        else:
            print("📝 No saved questions file found - using default interview questions")
            print("📋 Using default questions:")
            for q_id in sorted(INTERVIEW_QUESTIONS.keys()):
                print(f"  Q{q_id}: {INTERVIEW_QUESTIONS[q_id][:60]}...")
    except Exception as e:
        print(f"❌ Error loading questions from file: {e}")
        print("📝 Using default interview questions")

@app.get("/twilio-balance")
async def get_twilio_balance():
    """Get Twilio account balance"""
    try:
        print("[TWILIO BALANCE] 💳 Fetching account balance...")
        
        if not client:
            return {
                "success": False,
                "error": "Twilio client not initialized"
            }
        
        balance = client.api.v2010.accounts(account_sid).balance.fetch()
        
        print(f"[TWILIO BALANCE] ✅ Raw balance: {balance.balance} {balance.currency}")
        balance_amount = float(balance.balance)
        
        return {
            "success": True,
            "balance": f"{balance_amount:.2f}",
            "currency": balance.currency,
            "raw_balance": balance.balance
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# Add this near your other imports
from email.message import EmailMessage
import smtplib
from pydantic import BaseModel
from typing import Optional

# Define a model for the request data
class EmailLinkRequest(BaseModel):
    email: str
    link: str
    candidate_name: Optional[str] = None
    role: Optional[str] = None

@app.post("/send-interview-link")
async def send_interview_link(request: EmailLinkRequest):
    """Send interview link to candidate via email"""
    try:
        print(f"[EMAIL] 📧 Sending interview link to {request.email}")
        
        # Create email message
        msg = EmailMessage()
        
        # Format candidate name
        candidate_name = request.candidate_name or "Candidate"
        
        # Set email headers
        msg['Subject'] = f"Your AI Interview Link - Onelab Ventures"
        msg['From'] = "ranjan.shitole3129@gmail.com"
        msg['To'] = request.email
        
        # Prepare a professional email body
        role_text = f" for the {request.role} position" if request.role else ""
        
        # Create HTML content for better formatting
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <h2 style="color: #1976d2;">AI Interview - Onelab Ventures</h2>
                <p>Hello {candidate_name},</p>
                <p>Thank you for your interest in Onelab Ventures{role_text}. Your AI interview has been scheduled.</p>
                <p>Please click the button below to start your interview:</p>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{request.link}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                        Start Your Interview
                    </a>
                </div>
                <p>Alternatively, you can copy and paste this link into your browser:</p>
                <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
                    {request.link}
                </p>
                <p>Important tips for your interview:</p>
                <ul>
                    <li>Make sure you have a stable internet connection</li>
                    <li>Use a quiet space with minimal background noise</li>
                    <li>Ensure your webcam and microphone are working properly</li>
                    <li>Have your resume handy for reference</li>
                </ul>
                <p>Best of luck with your interview!</p>
                <p>Regards,<br>Onelab Ventures Team</p>
            </div>
        </body>
        </html>
        """
        msg.set_content(f"""Hello {candidate_name},

Thank you for your interest in Onelab Ventures{role_text}. Your AI interview has been scheduled.

Please use this link to start your interview: {request.link}

Best of luck with your interview!

Regards,
Onelab Ventures Team
""")
        
        # Add HTML version
        msg.add_alternative(html_content, subtype='html')
        
        # Send the email
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login("ranjan.shitole3129@gmail.com", "mikcnsvzyyjshozh")
            smtp.send_message(msg)
        
        print(f"[EMAIL] ✅ Successfully sent interview link to {request.email}")
        
        return {
            "success": True,
            "message": f"Interview link sent to {request.email} successfully"
        }
        
    except Exception as e:
        print(f"[EMAIL ERROR] ❌ Failed to send email: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to send interview link email"
        }
# Add these simplified endpoints to your main.py
# Add these endpoints to your main.py file

@app.get("/api/assessments")
async def get_assessments():
    """Get all assessments from external API"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        
        response = requests.get(
            "https://api.onelabventur.us/node/api/assessment/?page=1&limit=100&sortOrder=DESC&sortBy=createdAt",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            assessments = data.get("result", {}).get("assessments", [])
            
            # Process assessments
            processed_assessments = []
            for assessment in assessments:
                processed_assessments.append({
                    "id": assessment["id"],
                    "testName": assessment["title"],
                    "jobRole": assessment["designation"],
                    "experience": assessment.get("experience", 0),
                    "duration": assessment.get("duration", 0),
                    "totalTopics": assessment.get("totalTopics", 0),
                    "status": "active" if assessment["isActive"] else "inactive",
                    "assessmentLink": f"https://api.onelabventur.us/assessment/{assessment['id']}"
                })
            
            return {"success": True, "assessments": processed_assessments}
        else:
            return {"success": False, "error": "Failed to fetch assessments", "assessments": []}
            
    except Exception as e:
        print(f"[ASSESSMENTS ERROR] ❌ {e}")
        return {"success": False, "error": str(e), "assessments": []}

@app.get("/api/candidates")
async def get_candidates():
    """Get candidates from interviews"""
    try:
        # Get interviews data using your existing function
        interviews_data = []
        try:
            response = requests.get(f"{API_BASE_URL}/interviews-detailed", timeout=30)
            if response.status_code == 200:
                data = response.json()
                interviews_data = data.get("interviews", [])
        except Exception as e:
            print(f"Error fetching interviews: {e}")
            return {"success": False, "error": "Failed to fetch interviews", "candidates": []}
        
        # Process candidates
        candidates = []
        for interview in interviews_data:
            candidate_email = interview.get("candidate_email")
            if not candidate_email:
                phone = interview.get("candidate_phone", "")
                clean_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
                candidate_email = f"candidate{clean_phone[-6:] if len(clean_phone) >= 6 else interview['interview_id'][-6:]}@example.com"
            
            candidates.append({
                "id": interview["interview_id"],
                "name": interview["candidate_name"],
                "phone": interview["candidate_phone"],
                "email": candidate_email,
                "status": interview["status"]
            })
        
        return {"success": True, "candidates": candidates}
        
    except Exception as e:
        print(f"[CANDIDATES ERROR] ❌ {e}")
        return {"success": False, "error": str(e), "candidates": []}

@app.post("/api/send-assessment-bulk")
async def send_assessment_bulk(request: Request):
    """Send assessment link to all candidates"""
    try:
        data = await request.json()
        
        assessment_name = data.get('assessmentName')
        job_role = data.get('jobRole')
        assessment_link = data.get('assessmentLink')
        candidates = data.get('candidates', [])
        
        if not assessment_link or not candidates:
            return {"success": False, "error": "Assessment link and candidates are required"}
        
        results = []
        success_count = 0
        failed_count = 0
        
        for candidate in candidates:
            try:
                # Create personalized email
                subject = f"{assessment_name} - Assessment Invitation"
                message = f"""Hello {candidate['name']},

You have been invited to take the {assessment_name} assessment for the {job_role} position.

Please click the link below to start your assessment:
{assessment_link}

Best regards,
Onelab Ventures Team"""
                
                # Create email
                msg = EmailMessage()
                msg['Subject'] = subject
                msg['From'] = "ranjan.shitole3129@gmail.com"
                msg['To'] = candidate['email']
                
                # HTML version
                html_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1976d2;">Assessment Invitation</h2>
                        <p>Hello {candidate['name']},</p>
                        <p>You have been invited to take the <strong>{assessment_name}</strong> assessment for the <strong>{job_role}</strong> position.</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{assessment_link}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                Start Assessment
                            </a>
                        </div>
                        <p>Direct link: <a href="{assessment_link}">{assessment_link}</a></p>
                        <p>Best regards,<br>Onelab Ventures Team</p>
                    </div>
                </body>
                </html>
                """
                
                msg.set_content(message)
                msg.add_alternative(html_content, subtype='html')
                
                # Send email
                with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                    smtp.login("ranjan.shitole3129@gmail.com", "mikcnsvzyyjshozh")
                    smtp.send_message(msg)
                
                results.append({
                    "name": candidate['name'],
                    "email": candidate['email'],
                    "status": "sent"
                })
                success_count += 1
                print(f"✅ Email sent to {candidate['name']} ({candidate['email']})")
                
            except Exception as e:
                results.append({
                    "name": candidate['name'],
                    "email": candidate['email'],
                    "status": "failed",
                    "error": str(e)
                })
                failed_count += 1
                print(f"❌ Failed to send email to {candidate['name']}: {e}")
        
        return {
            "success": True,
            "message": f"Sent {success_count} emails, {failed_count} failed",
            "results": results,
            "stats": {
                "total": len(candidates),
                "sent": success_count,
                "failed": failed_count
            }
        }
        
    except Exception as e:
        print(f"[BULK EMAIL ERROR] ❌ {e}")
        return {"success": False, "error": str(e)}
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting AI Interview Bot Server...")
    print("📝 Loading saved interview questions...")
    load_questions_from_file()
    uvicorn.run(app, host="0.0.0.0", port=8000)

