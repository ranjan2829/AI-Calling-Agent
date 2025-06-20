# 🇮🇳 AI Calling Interviewer 

An intelligent phone-based interview system built with **FastAPI** 

## 🌟 Features

### 🚀 Core Capabilities
- **FastAPI Framework**: High-performance async API
- **Indian Telephony Services**: Twillio
- **Multi-language Support**: English
- **Cultural Intelligence**: Indian workplace and market insights
- **Comprehensive Reports**: Detailed analysis with salary recommendations

### 🇮🇳 Indian Market Optimizations
- **Local Phone Format**: +91 mobile number validation
- **Cultural Context**: Questions tailored for Indian workplace
- **Salary Insights**: INR-based compensation recommendations
- **Work Culture**: Remote work, time zones, client interaction focus
## 🛠️ Technology Stack
- **Backend**: FastAPI + Python 3.8+
- **Telephony**: Twillio
- **Database**: S3
- **Validation**: Pydantic models
- **Documentation**: Auto-generated

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI       │    │     Interviewer │    │    Twillio.     │
│                 │    │                 │    │                 │
│ • REST APIs     │◄──►│ • Question Gen  │◄──►│ • Voice Calls   │
│ • Validation    │    │ • Analysis      │    │ • Webhooks      │
│ • Documentation │    │ • Reports       │    │ • Recording     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pydantic      │    │   Ask Question  │    │   Indian        │
│   Models        │    │                 │    │   Candidates    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```
