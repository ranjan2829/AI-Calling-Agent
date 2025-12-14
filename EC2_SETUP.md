# EC2 Setup Guide

Quick setup commands for AWS EC2 instance.

## Quick Setup (Automated)

```bash
# 1. SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. Clone the repository (if not already cloned)
git clone https://github.com/ranjan2829/AI-Calling-Agent.git
cd AI-Calling-Agent

# 3. Run the setup script
chmod +x setup-ec2.sh
./setup-ec2.sh
```

## Manual Setup (Step by Step)

### 1. Install Dependencies

```bash
# Update system
sudo yum update -y  # Amazon Linux
# OR
sudo apt-get update -y  # Ubuntu

# Install Python 3.12+
sudo yum install -y python3 python3-pip python3-venv

# Install Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install nginx
sudo yum install -y nginx
```

### 2. Setup Backend

```bash
cd ~/AI-Calling-Agent/Backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
nano .env
```

Add to `.env`:
```env
# Twilio Configuration
account_sid=YOUR_TWILIO_ACCOUNT_SID
auth_token=YOUR_TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+1234567890
WEBHOOK_BASE_URL=https://your-ec2-ip-or-domain.com

# AWS Configuration
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
AWS_REGION=ap-south-1
S3_BUCKET=amzn-twillio-recordings

# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

### 3. Setup Frontend

```bash
cd ~/AI-Calling-Agent/interview-bot-frontend

# Install dependencies
npm install

# Build for production
npm run build
```

### 4. Create Systemd Services

**Backend Service:**
```bash
sudo nano /etc/systemd/system/ai-calling-backend.service
```

Add:
```ini
[Unit]
Description=AI Calling Agent Backend
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/AI-Calling-Agent/Backend
Environment="PATH=/home/ec2-user/AI-Calling-Agent/Backend/venv/bin"
ExecStart=/home/ec2-user/AI-Calling-Agent/Backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Frontend Service:**
```bash
sudo npm install -g serve
sudo nano /etc/systemd/system/ai-calling-frontend.service
```

Add:
```ini
[Unit]
Description=AI Calling Agent Frontend
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/AI-Calling-Agent/interview-bot-frontend
ExecStart=/usr/bin/npx serve -s dist -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 5. Start Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable ai-calling-backend
sudo systemctl enable ai-calling-frontend

# Start services
sudo systemctl start ai-calling-backend
sudo systemctl start ai-calling-frontend

# Check status
sudo systemctl status ai-calling-backend
sudo systemctl status ai-calling-frontend
```

### 6. Configure Nginx (Optional but Recommended)

```bash
sudo nano /etc/nginx/conf.d/ai-calling-agent.conf
```

Add:
```nginx
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Test nginx config
sudo nginx -t

# Start nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 7. Configure EC2 Security Group

In AWS Console:
- Go to EC2 → Security Groups
- Add inbound rules:
  - HTTP (port 80) from 0.0.0.0/0
  - HTTPS (port 443) from 0.0.0.0/0 (if using SSL)
  - Port 8000 from 0.0.0.0/0 (if not using nginx)
  - Port 3000 from 0.0.0.0/0 (if not using nginx)

## Useful Commands

### View Logs
```bash
# Backend logs
sudo journalctl -u ai-calling-backend -f

# Frontend logs
sudo journalctl -u ai-calling-frontend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart Services
```bash
sudo systemctl restart ai-calling-backend
sudo systemctl restart ai-calling-frontend
sudo systemctl restart nginx
```

### Stop Services
```bash
sudo systemctl stop ai-calling-backend
sudo systemctl stop ai-calling-frontend
```

### Check Service Status
```bash
sudo systemctl status ai-calling-backend
sudo systemctl status ai-calling-frontend
sudo systemctl status nginx
```

## Troubleshooting

### Backend not starting
```bash
# Check if port 8000 is in use
sudo lsof -i :8000

# Check backend logs
sudo journalctl -u ai-calling-backend -n 50

# Test manually
cd ~/AI-Calling-Agent/Backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend not loading
```bash
# Check if build was successful
ls -la ~/AI-Calling-Agent/interview-bot-frontend/dist

# Rebuild if needed
cd ~/AI-Calling-Agent/interview-bot-frontend
npm run build
```

### Nginx errors
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### Update Code
```bash
cd ~/AI-Calling-Agent
git pull
cd Backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../interview-bot-frontend
npm install
npm run build
sudo systemctl restart ai-calling-backend
sudo systemctl restart ai-calling-frontend
```

## Access URLs

- **Frontend:** `http://YOUR_EC2_IP`
- **Backend API:** `http://YOUR_EC2_IP/api`
- **Direct Backend:** `http://YOUR_EC2_IP:8000`
- **Direct Frontend:** `http://YOUR_EC2_IP:3000`

Replace `YOUR_EC2_IP` with your EC2 instance's public IP address.

