# AI Interview Platform

An intelligent voice interview system that conducts automated phone interviews, understands candidate responses, and provides comprehensive analysis—all without human intervention.

---

## The Journey of an Interview

### The Beginning

A recruiter opens the dashboard, enters a phone number, and clicks "Start Interview." Behind the scenes, the system reaches out through Twilio, connecting with the candidate in real-time.

The candidate answers their phone. A warm, natural voice greets them—powered by Amazon Polly's Aditi voice, optimized for Indian accents. The conversation begins.

### The Conversation

The AI asks the first question: "Is this a good time to speak for a 3-4 minute interview?"

The candidate responds. Their words flow through Twilio's voice recognition, captured in real-time. The system listens, processes, and understands—not just the words, but the intent.

If the candidate isn't available, the system gracefully ends the call, scheduling a callback. If they're ready, the interview continues.

### The Flow

Question by question, the conversation unfolds:

1. **Availability Check** — Ensures the candidate is ready
2. **Introduction** — Candidate shares their background
3. **Skills Assessment** — Technical capabilities are explored
4. **Experience Validation** — Years of experience and expertise
5. **Notice Period** — Availability and timeline
6. **Compensation** — Current and expected salary
7. **Technical Deep Dive** — APIs, cloud platforms, deployments
8. **AI & ML Experience** — Specialized knowledge areas

Each response is captured, transcribed, and analyzed. The system doesn't just hear—it understands context, extracts skills, validates experience, and builds a comprehensive profile.

### The Understanding

As responses come in, the system works in the background:

- **Skills Extraction** — Identifies technical competencies from natural language
- **Experience Mapping** — Validates years of experience and seniority level
- **JD Matching** — Compares candidate responses against job requirements
- **Availability Analysis** — Determines notice period and start date flexibility
- **Compensation Intelligence** — Understands current CTC and expectations

The candidate never knows this analysis is happening. They simply have a conversation.

### The Completion

When all questions are answered, the system thanks the candidate warmly and ends the call. The interview is complete, but the work continues.

### The Analysis

Behind the scenes, the system processes everything:

- Transcriptions are analyzed for skills, experience, and fit
- Responses are scored for confidence and clarity
- A comprehensive report is generated
- The candidate is ranked against job requirements
- Recommendations are prepared for the recruiter

### The Dashboard

The recruiter returns to their dashboard. They see:

- **Recent Interviews** — All completed conversations
- **Candidate Rankings** — Sorted by match score
- **Detailed Analysis** — Question-by-question breakdown
- **Skills Matrix** — Visual representation of competencies
- **Recommendations** — Hire, maybe, or pass—with reasoning

Everything is ready. The recruiter can review, compare, and make informed decisions.

---

## How It Works

### The Architecture

**Frontend** — A sleek, dark-themed React dashboard where recruiters manage interviews, view results, and configure questions.

**Backend** — A FastAPI server that orchestrates everything: initiating calls, processing responses, running analysis, and serving data.

**Twilio** — Handles the actual phone calls, voice recognition, and real-time transcription.

**Storage** — Interview data, transcripts, and analysis results are stored locally in JSON format, organized and accessible.

### The Flow

```
Recruiter → Dashboard → Backend → Twilio → Candidate
                                    ↓
                            Voice Recognition
                                    ↓
                            Transcription
                                    ↓
                            Analysis Engine
                                    ↓
                            Results Dashboard
```

### Key Features

- **Real-time Transcription** — Candidate responses are captured and transcribed instantly
- **Intelligent Analysis** — Skills, experience, and fit are automatically extracted
- **JD Matching** — Candidates are scored against job requirements
- **Bulk Processing** — Handle multiple interviews simultaneously via CSV upload
- **Question Configuration** — Customize interview questions through the dashboard
- **Comprehensive Reports** — Detailed analysis with visualizations and recommendations

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Twilio Account
- AWS Account (for transcription)

### Setup

**Backend:**
```bash
cd Backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file with your Twilio credentials:
```
account_sid=your_account_sid
auth_token=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
WEBHOOK_BASE_URL=your_webhook_url
```

Start the server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd interview-bot-frontend
npm install
npm run dev
```

Visit `http://localhost:5173` and sign in to begin.

---

## Configuration

### Interview Questions

Questions are configured through the dashboard. Navigate to the Call Dashboard, scroll to "Interview Questions," and customize as needed. Questions are saved to the backend and used for all future interviews.

### Job Description

Set your job requirements through the dashboard's Job Description tab. This becomes the benchmark for candidate matching and analysis.

---

## The Experience

For **Recruiters**: A powerful tool that automates initial screening, saves hours of time, and provides data-driven insights for hiring decisions.

For **Candidates**: A natural, conversational interview experience—no awkward video calls, no scheduling hassles, just a phone conversation at their convenience.

---

## Technology

- **Frontend**: React, TypeScript, Material-UI
- **Backend**: FastAPI, Python
- **Voice**: Twilio Voice API
- **Transcription**: Twilio Speech Recognition
- **Storage**: Local JSON files

---

*Built for efficiency. Designed for clarity. Powered by intelligence.*
