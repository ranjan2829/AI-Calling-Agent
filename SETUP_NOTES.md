# Setup Notes - Port Configuration & Environment Variables

## ✅ Changes Completed

### Backend Server Port
- **Changed from port 8000 to 8001**
- Updated `Backend/main.py` to run on port 8001
- Updated `Backend/.env` WEBHOOK_BASE_URL to `http://localhost:8001`
- Updated `README.md` documentation

### Frontend API Configuration
- Updated all API endpoints from `localhost:8000` to `localhost:8001` in:
  - `interview-bot-frontend/src/api/services.ts`
  - `interview-bot-frontend/src/components/Dashboard.tsx`
  - `interview-bot-frontend/src/components/CallDashboard.tsx` (6 endpoints updated)

### CORS Configuration
- Updated CORS middleware to allow:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  - `http://localhost:5173` (Vite default port)

## 📋 Environment Variables

### Required Variables (in `Backend/.env`)

```env
# Twilio Configuration (REQUIRED)
account_sid=your_twilio_account_sid
auth_token=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Webhook Base URL (REQUIRED)
# ⚠️ IMPORTANT: For local development with Twilio webhooks, you need a public URL
# Use ngrok or similar: ngrok http 8001
# Then set: WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
WEBHOOK_BASE_URL=http://localhost:8001
```

### Optional Variables

```env
# AWS Configuration (only if using AWS services)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET=ai-calling-agent
```

## 🚀 Running the Servers

### Backend (Port 8001)
```bash
cd Backend
python3 main.py
# Or: uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend (Port 3000)
```bash
cd interview-bot-frontend
npm run dev
```

## ⚠️ Important Notes

1. **Webhook URL for Twilio**: 
   - The `WEBHOOK_BASE_URL` in `.env` is currently set to `http://localhost:8001`
   - **This won't work for actual Twilio webhooks** because Twilio needs a public URL
   - For local development, use **ngrok**:
     ```bash
     ngrok http 8001
     ```
   - Then update `.env` with the ngrok URL: `WEBHOOK_BASE_URL=https://xxxx.ngrok.io`

2. **Environment File**:
   - A `.env.example` template has been created in `Backend/`
   - Copy it to `.env` and fill in your actual credentials
   - The `.env` file is gitignored and won't be committed

3. **Testing**:
   - Backend server tested and responding on port 8001 ✅
   - Frontend dependencies are installed ✅
   - All API endpoints updated to use port 8001 ✅

## 🔍 Verification

Test the backend:
```bash
curl http://localhost:8001/interviews-detailed
```

Expected response:
```json
{"success":true,"interviews":[],"total_count":0,"completed_count":0}
```

