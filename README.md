# 🇮🇳 AI Calling Agent - Comprehensive Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [🌟 Features](#-features)
3. [🛠️ Technology Stack](#️-technology-stack)
4. [🏗️ Architecture](#️-architecture)
5. [📁 Project Structure](#-project-structure)
6. [⚡ Quick Start](#-quick-start)
7. [🔧 Installation & Setup](#-installation--setup)
8. [📚 API Documentation](#-api-documentation)
9. [🎯 Frontend Components](#-frontend-components)
10. [🔄 Data Flow](#-data-flow)
11. [⚙️ Configuration](#️-configuration)
12. [🚀 Deployment](#-deployment)
13. [🐛 Troubleshooting](#-troubleshooting)
14. [🤝 Contributing](#-contributing)

## Project Overview

The **AI Calling Agent** is an intelligent interview automation platform developed by **Onelab Ventures** that conducts phone interviews using AI, transcribes responses in real-time, and provides comprehensive candidate analysis. Built specifically for the Indian market with cultural intelligence and local optimizations.

### 🎯 Key Capabilities
- 📞 **Automated Phone Interviews** - AI-powered structured interviews via Twilio
- 🎙️ **Real-time Transcription** - Live speech-to-text using AWS Transcribe
- 🤖 **Intelligent Analysis** - OpenAI GPT-powered response evaluation
- 📊 **Indian Market Focus** - INR salary insights, cultural context, local phone formats
- 📱 **Modern Dashboard** - React-based interface with Material-UI
- 🔄 **Bulk Processing** - Handle multiple candidates simultaneously

## 🌟 Features

### 🚀 Core Capabilities
- **FastAPI Framework**: High-performance async API with auto-documentation
- **Indian Telephony Services**: Twilio integration with +91 number validation
- **Multi-language Support**: English with Indian accent optimization
- **Cultural Intelligence**: Questions tailored for Indian workplace dynamics
- **Comprehensive Reports**: Detailed analysis with INR-based salary recommendations

### 🇮🇳 Indian Market Optimizations
- **Local Phone Format**: +91 mobile number validation and formatting
- **Cultural Context**: Interview questions adapted for Indian work culture
- **Salary Insights**: INR-based compensation analysis and recommendations
- **Work Culture Focus**: Remote work preferences, time zones, client interaction skills
- **Regional Considerations**: Relocation willingness, notice periods, visa status

### 📊 Advanced Analytics
- **Skills Detection**: Automatic identification of technical and soft skills
- **Experience Mapping**: Years of experience validation and assessment
- **JD Matching**: Job description compatibility scoring
- **Confidence Analysis**: Response quality and candidate confidence evaluation
- **Recommendation Engine**: Hire/reject recommendations with detailed reasoning

## 🛠️ Technology Stack

### Frontend Stack
- **React 18** - Modern React with hooks and TypeScript
- **Material-UI (MUI)** - Professional component library
- **Vite** - Lightning-fast build tool
- **TypeScript** - Type-safe development
- **React Router** - Client-side routing
- **Axios** - API communication
- **React Toastify** - User notifications

### Backend Stack
- **FastAPI** - Modern Python web framework with async support
- **Python 3.12+** - Latest Python features
- **Pydantic** - Data validation and serialization
- **Uvicorn** - ASGI server for production
- **SQLite/JSON** - Lightweight data storage

### External Services
- **Twilio** - Voice calls and telephony
- **AWS Transcribe** - Speech-to-text conversion
- **AWS S3** - Audio file storage
- **OpenAI GPT** - AI-powered text analysis

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   FastAPI       │    │    Twilio       │
│                 │    │                 │    │                 │
│ • Dashboard     │◄──►│ • REST APIs     │◄──►│ • Voice Calls   │
│ • Results View  │    │ • Validation    │    │ • Webhooks      │
│ • Bulk Ops      │    │ • Analysis      │    │ • Recording     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Material-UI   │    │   AWS Services  │    │   OpenAI GPT    │
│   Components    │    │ • Transcribe    │    │ • Analysis      │
│                 │    │ • S3 Storage    │    │ • Skills Match  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TypeScript    │    │   Interview     │    │   Indian        │
│   Type Safety   │    │   Engine        │    │   Candidates    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
AI-Calling-Agent/
├── 📁 Backend/                          # FastAPI Python backend
│   ├── 🐍 main.py                      # Main FastAPI application
│   ├── 📊 summary.py                   # AI analysis and reporting
│   ├── 📋 requirements.txt             # Python dependencies
│   ├── 🔐 .env                        # Environment variables
│   ├── 📁 config/                     # Configuration files
│   │   └── 📄 job_description.json    # Job requirements
│   ├── 📁 interviews/                 # Interview data storage
│   │   ├── 🎵 audio_recordings/       # Twilio call recordings
│   │   ├── 📝 transcriptions/         # AWS Transcribe outputs
│   │   └── 📄 *.json                  # Interview result files
│   ├── 📄 call_phone_mapping.json     # Phone number mappings
│   ├── 📄 contact_mappings.json       # Contact information
│   └── 📄 current_jd.json            # Active job description
│
└── 📁 interview-bot-frontend/          # React TypeScript frontend
    ├── 📁 src/                        # Source code
    │   ├── 📁 components/             # React components
    │   │   ├── 📞 CallDashboard.tsx   # Main calling interface
    │   │   ├── 📊 InterviewResults.tsx # Results & analytics
    │   │   ├── 📋 InterviewDetails.tsx # Individual interview view
    │   │   ├── 📜 CallHistory.tsx     # Historical call data
    │   │   └── 🔄 BulkCallDashboard.tsx # Bulk operations
    │   ├── 📁 api/                    # API layer
    │   │   └── 🔌 services.ts         # API service functions
    │   ├── 📱 App.tsx                 # Root application component
    │   ├── 🚀 main.tsx               # Application entry point
    │   └── 🎨 index.css              # Global styles
    ├── 📁 public/                     # Static assets
    ├── 📦 package.json               # Node.js dependencies
    ├── ⚡ vite.config.ts             # Vite build configuration
    └── 📝 tsconfig.json              # TypeScript configuration
```

## ⚡ Quick Start

### 🔥 1-Minute Setup
```bash
# Clone and setup backend
git clone <repository-url>
cd AI-Calling-Agent/Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Setup frontend (new terminal)
cd ../interview-bot-frontend
npm install && npm run dev
```

Visit `http://localhost:3000` - Your AI interviewer is ready! 🎉

## 🔧 Installation & Setup

### 📋 Prerequisites
```bash
✅ Python 3.12+
✅ Node.js 18+
✅ Twilio Account
✅ AWS Account (for Transcribe & S3)
✅ OpenAI API Key
```

### 🐍 Backend Setup

1. **Environment Setup**
```bash
cd Backend
python -m venv venv

# Activate virtual environment
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

pip install -r requirements.txt
```

2. **Environment Configuration**
```bash
# Create .env file with your credentials
cat > .env << EOF
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token  
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-interview-bucket

# Application Settings
ENVIRONMENT=development
DEBUG=true
EOF
```

3. **Start Backend Server**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
🎯 Backend running at `http://localhost:8000`

### ⚛️ Frontend Setup

1. **Install Dependencies**
```bash
cd interview-bot-frontend
npm install
```

2. **Environment Configuration**
```bash
# Create frontend environment file
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
```

3. **Start Development Server**
```bash
npm run dev
```
🎯 Frontend running at `http://localhost:3000`

## 📚 API Documentation

### 🔌 Core Endpoints

#### Phone Call Management
```typescript
// 📞 Initiate Interview Call
POST /make-call
{
  "phone_number": "+919876543210",
  "candidate_name": "Rahul Sharma"
}

// 📊 Get Call Status
GET /call-status/{call_sid}

// ⏹️ End Active Call
POST /end-call/{call_sid}

// 🔄 Handle Twilio Webhooks
POST /webhook
```

#### Interview Data & Analysis
```typescript
// 📋 Get All Interviews
GET /get-all-interviews-detailed
Response: {
  "interviews": [InterviewData[]],
  "total_count": number,
  "completed_count": number
}

// 📄 Get Specific Interview
GET /interview/{interview_id}

// 🤖 Run AI Analysis
POST /run-jd-analysis
Body: { "interview_ids": ["id1", "id2"] }

// 📊 Download JD Report
GET /jd-report/{interview_id}
```

#### Bulk Operations
```typescript
// 📁 Upload Contact CSV
POST /upload-contacts
Content-Type: multipart/form-data
Body: FormData with CSV file

// 🚀 Start Bulk Calling
POST /start-bulk-calling
{
  "contact_ids": ["id1", "id2", "id3"],
  "delay_between_calls": 30,
  "max_concurrent_calls": 3
}

// 📈 Get Bulk Call Status
GET /bulk-call-status/{bulk_id}
```

### 📊 Data Models

#### Interview Response Structure
```typescript
interface InterviewData {
  // Call Information
  call_sid: string;
  phone_number: string;
  candidate_name: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER';
  
  // Timing
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  
  // Responses
  responses: Array<{
    question: string;
    answer: string;
    confidence: number;        // 0.0 - 1.0
    timestamp: string;
    question_number: number;
    audio_url?: string;
  }>;
  
  // AI Analysis Results
  validation_results: {
    [step: string]: {
      step: number;
      passed: boolean;
      reason: string;
      confidence: number;
      
      // Skills Analysis
      skills_match?: boolean;
      found_skills?: string[];
      match_percentage?: number;
      
      // Experience Assessment
      experience_years?: number;
      experience_level?: 'junior' | 'mid' | 'senior';
      
      // Cultural Fit
      relocation_willing?: boolean;
      onsite_available?: boolean;
      notice_period_days?: number;
      
      // Compensation
      current_ctc_inr?: number;
      expected_ctc_inr?: number;
      negotiable?: boolean;
    };
  };
  
  // Metadata
  silence_prompts: number;
  last_activity: string;
  is_bulk_call: boolean;
  bulk_call_id?: string;
}
```

## 🎯 Frontend Components

### 📞 CallDashboard Component
**Purpose**: Main interface for initiating individual interviews

**Features**:
- 🔢 Phone number input with +91 validation
- ⏱️ Real-time call status monitoring  
- 📝 Live transcription display
- 🎛️ Call controls (start/end/pause)

**Usage**:
```tsx
import { CallDashboard } from './components/CallDashboard';

function App() {
  return <CallDashboard />;
}
```

### 📊 InterviewResults Component  
**Purpose**: Comprehensive candidate analysis and ranking

**Features**:
- 🏆 Sortable candidate leaderboard
- 📈 Skills analysis with visual charts
- 🔍 Expandable detailed interview views
- 📄 PDF/JSON report downloads
- 🎯 JD matching scores

**Key Functions**:
```tsx
// Skills detection from interview text
const extractSkillsFromText = (text: string): string[] => {
  const skillKeywords = [
    'python', 'java', 'javascript', 'react', 'node.js',
    'machine learning', 'data science', 'aws', 'docker'
  ];
  return skillKeywords.filter(skill => 
    text.toLowerCase().includes(skill)
  );
};

// Composite scoring algorithm
const calculateOverallScore = (interview: InterviewData) => {
  const skillsScore = interview.skills_percentage;
  const experienceScore = interview.experience_match;
  const responseQuality = interview.avg_confidence * 100;
  
  return Math.round(
    skillsScore * 0.4 + 
    experienceScore * 0.3 + 
    responseQuality * 0.3
  );
};
```

### 🔄 BulkCallDashboard Component
**Purpose**: Batch processing interface for multiple candidates

**Features**:
- 📁 CSV upload with validation
- 🚀 Batch call initiation with delays
- 📊 Real-time progress monitoring
- ⏸️ Individual call pause/resume
- 📈 Bulk operation analytics

### 📋 InterviewDetails Component  
**Purpose**: Deep-dive analysis of individual interviews

**Features**:
- 🗣️ Question-by-question breakdown
- 📊 Confidence scoring visualization
- 🎯 Skills gap analysis
- 💰 Salary recommendation (INR)
- 📝 Detailed feedback notes

## 🔄 Data Flow

### 📞 Interview Process Flow
```mermaid
graph TD
    A[User clicks 'Start Call'] --> B[FastAPI receives request]
    B --> C[Twilio initiates call]
    C --> D[Candidate answers]
    D --> E[AI asks questions]
    E --> F[Audio recorded to S3]
    F --> G[AWS Transcribe processes]
    G --> H[OpenAI analyzes response]
    H --> I[Next question or end]
    I --> J[Final analysis & scoring]
    J --> K[Results displayed in UI]
```

### 🤖 AI Analysis Pipeline
```mermaid
graph LR
    A[Raw Audio] --> B[AWS Transcribe]
    B --> C[Text Preprocessing]
    C --> D[Skills Extraction]
    C --> E[Experience Analysis]
    C --> F[Cultural Fit Assessment]
    D --> G[OpenAI GPT Analysis]
    E --> G
    F --> G
    G --> H[Composite Scoring]
    H --> I[Recommendation Engine]
    I --> J[Final Report Generation]
```

### 📊 Scoring Algorithm
```python
def calculate_final_score(interview_data):
    # Skills matching (40% weight)
    skills_score = len(found_skills) / len(required_skills) * 100
    
    # Experience relevance (30% weight)  
    exp_score = min(experience_years / required_years, 1.0) * 100
    
    # Response quality (30% weight)
    quality_score = sum(confidence_scores) / len(responses) * 100
    
    # Cultural fit bonus/penalty
    cultural_bonus = 0
    if relocation_willing: cultural_bonus += 5
    if notice_period <= 30: cultural_bonus += 5
    
    final_score = (
        skills_score * 0.4 + 
        exp_score * 0.3 + 
        quality_score * 0.3 + 
        cultural_bonus
    )
    
    return min(final_score, 100)
```

## ⚙️ Configuration

### 📋 Job Description Setup
Edit `Backend/config/job_description.json`:
```json
{
  "job_title": "Senior Python Developer",
  "company": "Onelab Ventures",
  "location": "Bangalore, India",
  "job_type": "Full-time",
  "experience_required": "3-5 years",
  
  "required_skills": [
    "python", "django", "fastapi", "postgresql", 
    "docker", "aws", "git", "rest apis"
  ],
  "preferred_skills": [
    "machine learning", "data science", "kubernetes", 
    "microservices", "redis", "elasticsearch"
  ],
  
  "responsibilities": [
    "Develop scalable web applications",
    "Design and implement REST APIs", 
    "Collaborate with cross-functional teams",
    "Mentor junior developers"
  ],
  
  "compensation": {
    "min_ctc_inr": 1200000,
    "max_ctc_inr": 2500000,
    "currency": "INR",
    "benefits": ["Health insurance", "WFH", "Learning budget"]
  },
  
  "cultural_preferences": {
    "remote_work": true,
    "relocation_required": false,
    "max_notice_period": 60,
    "interview_rounds": 3
  }
}
```

### 🎤 Interview Questions Customization
Modify questions in `Backend/main.py`:
```python
def get_interview_questions():
    return [
        {
            "id": 1,
            "question": "नमस्ते! Please introduce yourself and tell me about your background.",
            "type": "introduction",
            "max_duration": 120
        },
        {
            "id": 2, 
            "question": "What are your key technical skills relevant to this Python developer role?",
            "type": "skills_assessment",
            "max_duration": 180
        },
        {
            "id": 3,
            "question": "Are you open to relocation to Bangalore, or do you prefer remote work?",
            "type": "location_preference", 
            "max_duration": 60
        },
        {
            "id": 4,
            "question": "What is your current CTC and salary expectations in INR?",
            "type": "compensation",
            "max_duration": 90
        },
        {
            "id": 5,
            "question": "How many years of Python development experience do you have?",
            "type": "experience_validation",
            "max_duration": 120
        },
        {
            "id": 6,
            "question": "What is your current notice period?",
            "type": "availability",
            "max_duration": 30
        },
        {
            "id": 7,
            "question": "Do you have any questions about the role or our company?",
            "type": "candidate_questions",
            "max_duration": 120
        }
    ]
```

### 🎯 Scoring Configuration
Customize scoring weights in `Backend/summary.py`:
```python
SCORING_CONFIG = {
    "weights": {
        "skills_match": 0.35,
        "experience_relevance": 0.25, 
        "communication_quality": 0.20,
        "cultural_fit": 0.15,
        "salary_expectation": 0.05
    },
    
    "thresholds": {
        "excellent": 85,
        "good": 70,
        "average": 55,
        "below_average": 40
    },
    
    "bonuses": {
        "immediate_joiner": 5,
        "flexible_salary": 3,
        "relevant_domain": 5,
        "good_english": 3
    }
}
```

## 🚀 Deployment

### 🐳 Docker Deployment

**Backend Dockerfile**:
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend Dockerfile**:
```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  backend:
    build: ./Backend
    ports:
      - "8000:8000"
    environment:
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./Backend/interviews:/app/interviews

  frontend:
    build: ./interview-bot-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

### ☁️ AWS Deployment

**Backend on EC2**:
```bash
# Launch EC2 instance (t3.medium recommended)
# Install dependencies
sudo yum update -y
sudo yum install python3 python3-pip -y

# Deploy application
git clone <repository>
cd AI-Calling-Agent/Backend
pip3 install -r requirements.txt

# Run with systemd service
sudo systemctl enable ai-calling-agent
sudo systemctl start ai-calling-agent
```

**Frontend on S3 + CloudFront**:
```bash
# Build and upload
npm run build
aws s3 sync dist/ s3://your-frontend-bucket/
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

### 🔧 Production Environment Variables
```bash
# Production .env file
ENVIRONMENT=production
DEBUG=false

# Security
SECRET_KEY=your-super-secret-key
ALLOWED_HOSTS=your-domain.com,api.your-domain.com

# External Services
TWILIO_ACCOUNT_SID=prod_account_sid
TWILIO_AUTH_TOKEN=prod_auth_token
OPENAI_API_KEY=prod_openai_key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
```

## 🐛 Troubleshooting

### 🔥 Common Issues & Solutions

#### 1. 📞 Twilio Call Failures
```bash
# Check webhook URL accessibility
curl -X POST https://your-domain.com/webhook -H "Content-Type: application/x-www-form-urlencoded"

# Verify Twilio credentials
python -c "
from twilio.rest import Client
client = Client('your_sid', 'your_token')
print(client.api.accounts.list())
"

# Test phone number format
# ✅ Correct: +919876543210
# ❌ Wrong: 9876543210, +91 9876543210
```

#### 2. 🎙️ AWS Transcription Issues
```python
# Test AWS credentials
import boto3
client = boto3.client('transcribe', region_name='us-east-1')
try:
    response = client.list_transcription_jobs()
    print("✅ AWS credentials working")
except Exception as e:
    print(f"❌ AWS Error: {e}")

# Check S3 bucket permissions
aws s3 ls s3://your-bucket-name/
aws s3 cp test-file.txt s3://your-bucket-name/
```

#### 3. 🌐 CORS & API Issues
```typescript
// Frontend: Check API connection
const testAPI = async () => {
  try {
    const response = await fetch('http://localhost:8000/health');
    console.log('✅ Backend connected:', response.status);
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
  }
};

// Backend: Update CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 4. 💾 File Storage Issues
```bash
# Check directory permissions
ls -la Backend/interviews/
chmod -R 755 Backend/interviews/

# Verify storage space
df -h
du -sh Backend/interviews/

# Clean old recordings (optional)
find Backend/interviews/audio_recordings/ -type f -mtime +30 -delete
```

#### 5. 🤖 OpenAI API Errors
```python
# Test OpenAI connection
import openai
openai.api_key = "your-api-key"

try:
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=50
    )
    print("✅ OpenAI working")
except Exception as e:
    print(f"❌ OpenAI Error: {e}")
```

### 📊 Health Check Endpoints
```bash
# Backend health check
curl http://localhost:8000/health
# Expected: {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}

# Database connection check  
curl http://localhost:8000/health/db
# Expected: {"database": "connected", "interviews_count": 42}

# External services check
curl http://localhost:8000/health/services
# Expected: {"twilio": "ok", "aws": "ok", "openai": "ok"}
```

### 🔍 Debug Mode
Enable detailed logging:
```python
# In main.py
import logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Enable Twilio debug logs
from twilio.http.http_client import TwilioHttpClient
client = Client(username, password, http_client=TwilioHttpClient(logger=logging.getLogger()))
```

### 📱 Mobile Testing
Test with various Indian mobile networks:
```bash
# Test numbers (replace with real numbers)
+919876543210  # Airtel
+918765432109  # Jio  
+917654321098  # Vi/Vodafone
+919123456789  # BSNL
```

## 🤝 Contributing

### 🛠️ Development Setup
1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/indian-language-support`
3. **Make changes with tests**
4. **Follow code style**: `black Backend/` and `prettier --write frontend/`
5. **Commit**: `git commit -m "feat: add Hindi language support"`
6. **Push**: `git push origin feature/indian-language-support`
7. **Create Pull Request**

### 📋 Code Standards
```bash
# Python formatting
black Backend/ --line-length 88
isort Backend/ --profile black

# TypeScript formatting
cd interview-bot-frontend
npm run lint
npm run format

# Type checking
npm run type-check
```

### 🧪 Testing
```bash
# Backend tests
cd Backend
pytest tests/ -v --cov=.

# Frontend tests  
cd interview-bot-frontend
npm run test
npm run test:coverage
```

## 📄 License

This project is developed by **Onelab Ventures**. All rights reserved.

## 📞 Support & Contact

- **🏢 Company**: Onelab Ventures
- **🌐 Website**: [onelab.ventures](https://onelab.ventures)
- **📧 Email**: support@onelab.ventures
- **📱 Phone**: +