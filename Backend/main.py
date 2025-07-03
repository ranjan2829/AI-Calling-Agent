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

        elif step == 2:
            has_skills, found_skills, match_percentage = check_skills_match(transcription)
            validation_result["skills_match"] = has_skills
            validation_result["found_skills"] = found_skills
            validation_result["match_percentage"] = match_percentage
            basic_tech_words = ["programming", "development", "coding", "software", "technical"]
            has_basic_tech = any(word in transcription.lower() for word in basic_tech_words)
            
            if not has_skills and len(found_skills) == 0 and not has_basic_tech:
                validation_result["passed"] = False
                validation_result["reason"] = "No relevant technical skills mentioned"
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
            
            # More lenient validation - accept if ANY cloud experience is mentioned
            text_lower = transcription.lower()
            
            # Check for explicit "yes" responses
            explicit_yes = any(word in text_lower for word in ["yes", "yeah", "yep", "sure", "of course"])
            
            # Check for cloud-related terms (even with speech-to-text errors)
            cloud_terms_mentioned = any(term in text_lower for term in [
                "aws", "a w s", "amazon", "cloud", "azure", "gcp", "google cloud",
                "ec2", "e c", "s3", "s 3", "docker", "kubernetes", "deployment"
            ])
            
            # Check for experience indicators
            experience_indicators = any(phrase in text_lower for phrase in [
                "worked with", "experience", "used", "familiar", "know", "work with"
            ])
            
            # Pass validation if:
            # 1. Function detected cloud experience, OR
            # 2. Explicit yes + any cloud terms, OR  
            # 3. Experience indicators + cloud terms
            should_pass = (
                has_cloud_exp or
                (explicit_yes and cloud_terms_mentioned) or
                (experience_indicators and cloud_terms_mentioned) or
                len(cloud_concepts) > 0
            )
            
            if not should_pass:
                validation_result["passed"] = False
                validation_result["reason"] = "No cloud experience mentioned"
                validation_result["debug_info"] = {
                    "has_cloud_exp": has_cloud_exp,
                    "explicit_yes": explicit_yes,
                    "cloud_terms_mentioned": cloud_terms_mentioned,
                    "experience_indicators": experience_indicators,
                    "found_concepts": cloud_concepts
                }
                
                if "validation_results" not in interview_data:
                    interview_data["validation_results"] = {}
                interview_data["validation_results"][str(step)] = validation_result
                save_interview_session(call_sid, interview_data)
                return False, "no_cloud_experience", "No cloud experience found"
            else:
                print(f"[VALIDATION] Q6 PASSED: {transcription[:100]} -> detected: {cloud_concepts}")
                
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
            # Include ALL interview files, including terminated ones
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
                    
                    # Enhanced name extraction for terminated interviews
                    candidate_name = (interview_data.get("candidate_name") or 
                                     interview_data.get("name") or 
                                     interview_data.get("contact_name"))
                    
                    # If no name, try extracting from responses (even for terminated interviews)
                    if (not candidate_name or 
                        candidate_name == "Unknown" or 
                        candidate_name == "Unknown Candidate" or
                        candidate_name.startswith("Candidate_")):
                        
                        responses = interview_data.get("responses", [])
                        if responses and len(responses) > 0:
                            # Look for name in the first response (introduction)
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
                    
                    # Final fallback for name
                    if not candidate_name or candidate_name in ["Unknown", "Unknown Candidate"]:
                        phone_number = (interview_data.get("candidate_phone") or 
                                       interview_data.get("phone_number") or 
                                       call_sid[-8:])
                        phone_suffix = phone_number.replace('+', '')[-4:] if len(str(phone_number)) >= 4 else call_sid[-4:]
                        candidate_name = f"Candidate_{phone_suffix}"
                    
                    # Ensure we have phone number
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
        
        # Count different statuses
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
def terminate_interview(call_sid: str, reason_code: str, reason_message: str):
    try:
        resp = VoiceResponse()
        
        # Different messages based on termination reason
        if reason_code == "not_available":
            resp.say(
                "No problem at all! We completely understand. We'll reach out to you at a more convenient time. Thank you and have a great day!",
                voice='Polly.Aditi', rate='medium')
        elif reason_code == "call_later":
            resp.say(
                "Absolutely! We completely understand your schedule. We'll make sure to call you back at a more convenient time. Thank you for letting us know, and we'll be in touch soon!",
                voice='Polly.Aditi', rate='medium')
        else:
            resp.say(
                "Thank you so much for taking the time to speak with us today. We really appreciate your interest. We'll review everything and get back to you soon. Have a wonderful day!",
                voice='Polly.Aditi', rate='medium')
        
        resp.hangup()
        
        interview_data = load_interview_session(call_sid)
        if interview_data:
            if reason_code == "call_later":
                interview_data['status'] = 'CALLBACK_REQUESTED'
            else:
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
        candidate_name = data.get("name", "")
        
        if not phone_number:
            return {"error": "Phone number is required"}
        
        # Clean phone number
        clean_phone = phone_number.strip()
        if not clean_phone.startswith('+'):
            if clean_phone.startswith('91') and len(clean_phone) == 12:
                clean_phone = f"+{clean_phone}"
            elif len(clean_phone) == 10:
                clean_phone = f"+91{clean_phone}"
        
        # Generate meaningful name if missing
        if not candidate_name or candidate_name.strip() == "":
            phone_suffix = clean_phone.replace('+', '')[-4:] if len(clean_phone) >= 4 else "0000"
            candidate_name = f"Candidate_{phone_suffix}"
        
        call = client.calls.create(
            url=f"{WEBHOOK_BASE_URL}/voice",
            to=clean_phone,
            from_="+14787807480",
            record=True,
            recording_channels="dual",
            recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
        )
        
        print(f"Call initiated with recording: {call.sid} to {clean_phone}")
        
        # Store contact mapping with complete data
        contact_mappings_file = "contact_mappings.json"
        try:
            if os.path.exists(contact_mappings_file):
                with open(contact_mappings_file, 'r') as f:
                    all_mappings = json.load(f)
            else:
                all_mappings = {}
            
            all_mappings[call.sid] = {
                "candidate_name": candidate_name,
                "candidate_phone": clean_phone,
                "is_bulk_call": False,
                "recording_enabled": True,
                "candidate_data": {
                    "name": candidate_name,
                    "phone": clean_phone
                }
            }
            
            with open(contact_mappings_file, 'w') as f:
                json.dump(all_mappings, f, indent=2)
                
            print(f"[SINGLE CALL MAPPING] Stored data for {candidate_name} ({clean_phone})")
            
        except Exception as mapping_error:
            print(f"Error storing contact mapping: {mapping_error}")
        
        return {
            "success": True,
            "call_sid": call.sid,
            "status": call.status,
            "phone_number": clean_phone,
            "candidate_name": candidate_name,
            "recording_enabled": True,
            "message": f"Call initiated to {candidate_name} at {clean_phone} with recording enabled"
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
                            save_interview_session(call_sid, interview_data)
                            print(f"[RECORDING] Updated interview data for {call_sid}")
                    except Exception as update_error:
                        print(f"[ERROR] Failed to update interview data: {update_error}")
                    
                    break
                    
                else:
                    if attempt < max_wait_attempts - 1:
                        print(f"[RECORDING] Attempt {attempt + 1} failed, waiting {wait_interval}s...")
                        time.sleep(wait_interval)
                    else:
                        print(f"[ERROR] Failed to download recording after {max_wait_attempts} attempts")
                        
            except Exception as attempt_error:
                print(f"[ERROR] Recording attempt {attempt + 1} failed: {attempt_error}")
                if attempt < max_wait_attempts - 1:
                    time.sleep(wait_interval)
                
    except Exception as e:
        print(f"[ERROR] Recording download failed for {call_sid}: {e}")

def start_transcription_job_indian(call_sid: str, s3_key: str, recording_sid: str):
    try:
        import time
        job_name = f"transcribe_{call_sid}_{recording_sid}_{int(time.time())}"
        
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={
                'MediaFileUri': f's3://{S3_BUCKET}/{s3_key}'
            },
            MediaFormat='wav',
            LanguageCode='en-IN',
            Settings={
                'ShowSpeakerLabels': True,
                'MaxSpeakerLabels': 2
            }
        )
        
        print(f"[TRANSCRIPTION] Started job: {job_name}")
        
    except Exception as e:
        print(f"[ERROR] Transcription job failed: {e}")
@app.post("/voice")
async def handle_voice_call(request: Request):
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid')
        from_number = form_data.get('From', 'unknown')
        to_number = form_data.get('To', '+14787807480')       
        print(f"[VOICE] Incoming call {call_sid} from {from_number}")
        contact_info = None
        candidate_name = None
        candidate_phone = from_number
        
        try:
            contact_mappings_file = "contact_mappings.json"
            if os.path.exists(contact_mappings_file):
                with open(contact_mappings_file, 'r') as f:
                    all_mappings = json.load(f)
                contact_info = all_mappings.get(call_sid, {})
                if contact_info:
                    candidate_name = contact_info.get('candidate_name')
                    candidate_phone = contact_info.get('candidate_phone', from_number)
                    print(f"[CONTACT INFO] Found mapping: {candidate_name} - {candidate_phone}")
        except Exception as e:
            print(f"Error loading contact mapping: {e}")
        if not candidate_name or candidate_name == "Unknown":
            clean_phone = from_number.replace('+', '').replace('-', '').replace(' ', '')
            if len(clean_phone) >= 4:
                candidate_name = f"Candidate_{clean_phone[-4:]}"
            else:
                candidate_name = f"Candidate_{call_sid[-8:]}"
            print(f"[VOICE] Generated candidate name: {candidate_name}")
        
        if not candidate_phone or candidate_phone == "unknown":
            candidate_phone = from_number if from_number != "unknown" else f"Phone_{call_sid[-8:]}"
        interview_data = {
            'call_sid': call_sid,
            'interview_id': call_sid,
            'phone_number': candidate_phone,
            'candidate_phone': candidate_phone,
            'candidate_name': candidate_name,
            'name': candidate_name,
            'twilio_number': to_number,
            'start_time': datetime.now().isoformat(),
            'status': 'IN_PROGRESS',
            'current_question': 0,
            'responses': [],
            'validation_results': {},
            'silence_prompts': 0,
            'last_activity': datetime.now().isoformat()
        }
        if contact_info:
            interview_data.update({
                'bulk_call_id': contact_info.get('bulk_call_id'),
                'is_bulk_call': contact_info.get('is_bulk_call', False),
                'candidate_data': contact_info.get('candidate_data', ''),
                'candidate_email': contact_info.get('candidate_email', ''),
                'candidate_experience': contact_info.get('candidate_experience', ''),
                'candidate_skills': contact_info.get('candidate_skills', '')
            })
        
        save_interview_session(call_sid, interview_data)
        conversation_state[call_sid] = interview_data       
        print(f"[VOICE] Interview session created for {call_sid} - {candidate_name} ({candidate_phone})")
        
        resp = VoiceResponse()
        resp.say("Hello! Thank you for your interest in our position. I'm your AI interviewer from Onelab Ventures.", 
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
            return {"success": False, "error": "Only CSV files are allowed"}
        
        # Read CSV content
        content = await file.read()
        csv_data = content.decode('utf-8')
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        candidates = list(csv_reader)
        
        if not candidates:
            return {"success": False, "error": "No candidates found in CSV"}
        
        # Generate bulk call ID
        bulk_call_id = f"bulk_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        results = []
        
        # Process each candidate
        for candidate in candidates:
            try:
                name = candidate.get("name", candidate.get("Name", ""))
                phone = candidate.get("phone", candidate.get("Phone", candidate.get("mobile", candidate.get("Mobile", ""))))
                email = candidate.get("email", candidate.get("Email", ""))
                experience = candidate.get("experience", candidate.get("Experience", ""))
                skills = candidate.get("skills", candidate.get("Skills", ""))
                
                if not phone:
                    results.append({
                        "name": name or "Unknown",
                        "phone": phone,
                        "success": False,
                        "error": "No phone number provided"
                    })
                    continue
                
                
                # Clean phone number
                clean_phone = phone.strip()
                if not clean_phone.startswith('+'):
                    if clean_phone.startswith('91') and len(clean_phone) == 12:
                        clean_phone = f"+{clean_phone}"
                    elif len(clean_phone) == 10:
                        clean_phone = f"+91{clean_phone}"
                
                # Generate meaningful name if missing
                if not name or name.strip() == "":
                    phone_suffix = clean_phone.replace('+', '')[-4:] if len(clean_phone) >= 4 else "0000"
                    name = f"Candidate_{phone_suffix}"
                
                call = client.calls.create(
                    url=f"{WEBHOOK_BASE_URL}/voice",
                    to=clean_phone,
                    from_="+14787807480",
                    record=True,
                    recording_channels="dual",
                    recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
                )
                
                # Store comprehensive contact mapping
                contact_mappings_file = "contact_mappings.json"
                try:
                    if os.path.exists(contact_mappings_file):
                        with open(contact_mappings_file, 'r') as f:
                            all_mappings = json.load(f)
                    else:
                        all_mappings = {}
                    
                    all_mappings[call.sid] = {
                        "candidate_name": name,
                        "candidate_phone": clean_phone,
                        "candidate_email": email,
                        "candidate_experience": experience,
                        "candidate_skills": skills,
                        "is_bulk_call": True,
                        "bulk_call_id": bulk_call_id,
                        "recording_enabled": True,
                        "candidate_data": {
                            "name": name,
                            "phone": clean_phone,
                            "email": email,
                            "experience": experience,
                            "skills": skills
                        }
                    }
                    
                    with open(contact_mappings_file, 'w') as f:
                        json.dump(all_mappings, f, indent=2)
                        
                    print(f"[BULK MAPPING] Stored complete data for {name} ({clean_phone})")
                    
                except Exception as mapping_error:
                    print(f"Error storing contact mapping: {mapping_error}")
                
                results.append({
                    "name": name,
                    "phone": clean_phone,
                    "success": True,
                    "call_sid": call.sid,
                    "status": call.status
                })
                print(f"[BULK CALL] {name} ({clean_phone}): {call.sid}")
                
            except Exception as call_error:
                results.append({
                    "name": candidate.get("name", candidate.get("Name", "Unknown")),
                    "phone": candidate.get("phone", candidate.get("Phone", "")),
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
@app.get("/callback-requests")
async def get_callback_requests():
    try:
        callback_requests = []
        pattern = "interviews/*_ONELAB_CALLBACK_REQUESTED_*.json"
        files = glob.glob(pattern)
        
        for file_path in files:
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    callback_requests.append({
                        "interview_id": data.get("interview_id", "unknown"),
                        "candidate_name": data.get("candidate_name", "Unknown"),
                        "candidate_phone": data.get("candidate_phone", "Unknown"),
                        "callback_response": data.get("callback_response", ""),
                        "callback_request_time": data.get("callback_request_time", ""),
                        "preferred_time": data.get("preferred_time", ""),
                        "start_time": data.get("start_time", ""),
                        "status": data.get("status", "CALLBACK_REQUESTED"),
                        "bulk_call_id": data.get("bulk_call_id"),
                        "is_bulk_call": data.get("is_bulk_call", False)
                    })
            except Exception as e:
                print(f"Error loading callback request file {file_path}: {e}")
                continue
        
        callback_requests.sort(key=lambda x: x["callback_request_time"], reverse=True)
        return {
            "success": True,
            "callback_requests": callback_requests,
            "total_count": len(callback_requests)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "callback_requests": []
        }

@app.post("/reschedule-callback/{interview_id}")
async def reschedule_callback(interview_id: str, request: Request):
    try:
        data = await request.json()
        phone_number = data.get("phone_number")
        candidate_name = data.get("candidate_name", "Candidate")
        
        if not phone_number:
            return {"success": False, "error": "Phone number is required"}
        
        # Make the rescheduled call
        call = client.calls.create(
            url=f"{WEBHOOK_BASE_URL}/voice",
            to=phone_number,
            from_="+14787807480",
            record=True,
            recording_channels="dual",
            recording_status_callback=f"{WEBHOOK_BASE_URL}/recording-status"
        )
        
        # Store contact mapping
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
                "recording_enabled": True,
                "is_rescheduled_call": True,
                "original_interview_id": interview_id
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
            "message": f"Rescheduled call initiated to {candidate_name} at {phone_number}"
        }
        
    except Exception as e:
        print(f"[ERROR] Reschedule callback error: {e}")
        return {"success": False, "error": str(e)}
@app.post("/save-bulk-results")
async def save_bulk_results(request: Request):
    try:
        data = await request.json()
        bulk_call_id = data.get("bulk_call_id")
        results = data.get("results", [])
        
        if not bulk_call_id:
            return {"success": False, "error": "Bulk call ID required"}
        
        # Save to persistent storage
        bulk_results_file = f"bulk_results/{bulk_call_id}.json"
        os.makedirs("bulk_results", exist_ok=True)
        
        bulk_data = {
            "bulk_call_id": bulk_call_id,
            "total_candidates": data.get("total_candidates", 0),
            "successful_calls": data.get("successful_calls", 0),
            "failed_calls": data.get("failed_calls", 0),
            "results": results,
            "created_at": datetime.now().isoformat(),
            "status": "completed"
        }
        
        with open(bulk_results_file, 'w') as f:
            json.dump(bulk_data, f, indent=2)
        
        print(f"[BULK RESULTS] Saved {len(results)} results to {bulk_results_file}")
        
        return {
            "success": True,
            "message": "Bulk call results saved successfully",
            "bulk_call_id": bulk_call_id
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to save bulk results: {e}")
        return {"success": False, "error": str(e)}

@app.get("/bulk-results/{bulk_call_id}")
async def get_bulk_results(bulk_call_id: str):
    try:
        bulk_results_file = f"bulk_results/{bulk_call_id}.json"
        
        if os.path.exists(bulk_results_file):
            with open(bulk_results_file, 'r') as f:
                data = json.load(f)
            return {"success": True, "data": data}
        else:
            return {"success": False, "error": "Bulk call results not found"}
            
    except Exception as e:
        print(f"[ERROR] Failed to load bulk results: {e}")
        return {"success": False, "error": str(e)}

@app.get("/bulk-results")
async def get_all_bulk_results():
    try:
        bulk_results = []
        bulk_results_folder = "bulk_results"
        
        if os.path.exists(bulk_results_folder):
            json_files = glob.glob(f"{bulk_results_folder}/*.json")
            for file_path in json_files:
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                    bulk_results.append(data)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
                    continue
        
        # Sort by creation date
        bulk_results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "success": True,
            "bulk_results": bulk_results,
            "total_count": len(bulk_results)
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to get bulk results: {e}")
        return {"success": False, "error": str(e), "bulk_results": []}
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