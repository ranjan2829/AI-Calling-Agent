"""Configuration and environment variables"""
import os
from dotenv import load_dotenv

load_dotenv()

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("account_sid")
TWILIO_AUTH_TOKEN = os.getenv("auth_token")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+14787807480")
WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL")

# AWS Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET = os.getenv("S3_BUCKET", "ai-calling-agent")

# Interview Settings
TRANSCRIPTION_TIMEOUT = 10
SILENCE_TIMEOUT = 5
MAX_SILENCE_PROMPTS = 1

# Interview Questions
INTERVIEW_QUESTIONS = {
    0: "Is this a good time to speak for a 3-4 minute interview?",
    1: "Introduce yourself.",
    2: "What are your key skills for this role?",
    3: "What is your current notice period?",
    4: "What is your current CTC and expected salary?",
    5: "Tell us about your experience with APIs.",
    6: "What is your understanding of cloud platforms? Have you worked with AWS, Azure, or GCP?",
    7: "Describe your experience with deployments, including the use of Docker and Kubernetes.",
    8: "What is your experience with AI and machine learning? Mention any GenAI, deep learning technologies, or frameworks you've used.",
}

