#!/bin/bash

# AI Calling Agent - EC2 Setup Script
# Run this script on your EC2 instance to set up the project

set -e  # Exit on error

echo "🚀 Starting AI Calling Agent Setup on EC2..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root. Run as a regular user.${NC}"
   exit 1
fi

# Update system packages
echo -e "${GREEN}📦 Updating system packages...${NC}"
sudo yum update -y || sudo apt-get update -y

# Install Python 3.12+ and pip
echo -e "${GREEN}🐍 Installing Python 3.12+...${NC}"
if command -v python3.12 &> /dev/null; then
    echo "Python 3.12+ already installed"
else
    # For Amazon Linux 2/2023
    sudo yum install -y python3.12 python3.12-pip python3.12-venv || \
    sudo apt-get install -y python3.12 python3.12-pip python3.12-venv || \
    echo -e "${YELLOW}⚠️  Python 3.12 not available in default repos. Installing Python 3.11...${NC}" && \
    sudo yum install -y python3 python3-pip || sudo apt-get install -y python3 python3-pip
fi

# Install Node.js 18+
echo -e "${GREEN}📦 Installing Node.js 18+...${NC}"
if command -v node &> /dev/null && [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -ge 18 ]; then
    echo "Node.js 18+ already installed: $(node -v)"
else
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - || \
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs || sudo apt-get install -y nodejs
fi

# Install nginx (optional, for reverse proxy)
echo -e "${GREEN}🌐 Installing nginx...${NC}"
sudo yum install -y nginx || sudo apt-get install -y nginx

# Install git if not present
if ! command -v git &> /dev/null; then
    echo -e "${GREEN}📥 Installing git...${NC}"
    sudo yum install -y git || sudo apt-get install -y git
fi

# Navigate to home directory
cd ~

# Clone or navigate to project directory
if [ -d "AI-Calling-Agent" ]; then
    echo -e "${GREEN}📁 Project directory exists, updating...${NC}"
    cd AI-Calling-Agent
    git pull
else
    echo -e "${YELLOW}⚠️  Project directory not found. Please clone the repository first:${NC}"
    echo "git clone https://github.com/ranjan2829/AI-Calling-Agent.git"
    echo "cd AI-Calling-Agent"
    exit 1
fi

# ============================================
# BACKEND SETUP
# ============================================
echo -e "${GREEN}🔧 Setting up Backend...${NC}"
cd Backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
echo -e "${GREEN}📦 Installing Python dependencies...${NC}"
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env file template...${NC}"
    cat > .env << 'EOF'
# Twilio Configuration
account_sid=YOUR_TWILIO_ACCOUNT_SID
auth_token=YOUR_TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+1234567890
WEBHOOK_BASE_URL=https://your-domain.com

# AWS Configuration
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
AWS_REGION=ap-south-1
S3_BUCKET=amzn-twillio-recordings

# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
EOF
    echo -e "${YELLOW}⚠️  Please edit Backend/.env and add your credentials!${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

deactivate
cd ..

# ============================================
# FRONTEND SETUP
# ============================================
echo -e "${GREEN}🎨 Setting up Frontend...${NC}"
cd interview-bot-frontend

# Install Node dependencies
echo -e "${GREEN}📦 Installing Node.js dependencies...${NC}"
npm install

# Build frontend for production
echo -e "${GREEN}🏗️  Building frontend...${NC}"
npm run build

cd ..

# ============================================
# CREATE SYSTEMD SERVICES
# ============================================
echo -e "${GREEN}⚙️  Creating systemd services...${NC}"

PROJECT_DIR=$(pwd)
USER=$(whoami)

# Backend service
sudo tee /etc/systemd/system/ai-calling-backend.service > /dev/null << EOF
[Unit]
Description=AI Calling Agent Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR/Backend
Environment="PATH=$PROJECT_DIR/Backend/venv/bin"
ExecStart=$PROJECT_DIR/Backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (serving built files with a simple HTTP server)
sudo tee /etc/systemd/system/ai-calling-frontend.service > /dev/null << EOF
[Unit]
Description=AI Calling Agent Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR/interview-bot-frontend
ExecStart=/usr/bin/npx serve -s dist -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Install serve for frontend
sudo npm install -g serve

# Reload systemd
sudo systemctl daemon-reload

# ============================================
# NGINX CONFIGURATION (Optional)
# ============================================
echo -e "${GREEN}🌐 Configuring nginx...${NC}"

sudo tee /etc/nginx/conf.d/ai-calling-agent.conf > /dev/null << 'EOF'
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
EOF

# Test nginx configuration
sudo nginx -t

# Enable and start services
echo -e "${GREEN}🚀 Enabling and starting services...${NC}"
sudo systemctl enable ai-calling-backend
sudo systemctl enable ai-calling-frontend
sudo systemctl enable nginx

# Start services
sudo systemctl start ai-calling-backend
sudo systemctl start ai-calling-frontend
sudo systemctl start nginx

# ============================================
# FIREWALL CONFIGURATION
# ============================================
echo -e "${GREEN}🔥 Configuring firewall...${NC}"

# For Amazon Linux 2
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
fi

# For EC2 Security Groups - remind user
echo -e "${YELLOW}⚠️  Don't forget to configure EC2 Security Group:${NC}"
echo "   - Allow inbound HTTP (port 80)"
echo "   - Allow inbound HTTPS (port 443)"
echo "   - Allow inbound port 8000 (backend) if not using nginx"
echo "   - Allow inbound port 3000 (frontend) if not using nginx"

# ============================================
# FINAL INSTRUCTIONS
# ============================================
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Edit Backend/.env and add your credentials:"
echo "   - Twilio Account SID and Auth Token"
echo "   - Twilio Phone Number"
echo "   - WEBHOOK_BASE_URL (your EC2 public IP or domain)"
echo "   - AWS Access Key ID and Secret"
echo "   - OpenAI API Key"
echo ""
echo "2. Restart backend service:"
echo "   sudo systemctl restart ai-calling-backend"
echo ""
echo "3. Check service status:"
echo "   sudo systemctl status ai-calling-backend"
echo "   sudo systemctl status ai-calling-frontend"
echo "   sudo systemctl status nginx"
echo ""
echo "4. View logs:"
echo "   sudo journalctl -u ai-calling-backend -f"
echo "   sudo journalctl -u ai-calling-frontend -f"
echo ""
echo "5. Access the application:"
echo "   Frontend: http://$(curl -s ifconfig.me || echo 'YOUR_EC2_IP')"
echo "   Backend API: http://$(curl -s ifconfig.me || echo 'YOUR_EC2_IP')/api"
echo ""
echo -e "${GREEN}🎉 All done!${NC}"

