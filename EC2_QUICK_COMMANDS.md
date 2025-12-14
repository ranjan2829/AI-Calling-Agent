# EC2 Quick Commands Reference

## One-Line Setup

```bash
git clone https://github.com/ranjan2829/AI-Calling-Agent.git && cd AI-Calling-Agent && chmod +x setup-ec2.sh && ./setup-ec2.sh
```

## Essential Commands

### Setup Backend
```bash
cd Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
nano .env  # Add your credentials
```

### Setup Frontend
```bash
cd interview-bot-frontend
npm install
npm run build
```

### Start Services (Manual)
```bash
# Backend
cd Backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (in another terminal)
cd interview-bot-frontend && npx serve -s dist -l 3000
```

### Systemd Service Management
```bash
# Start
sudo systemctl start ai-calling-backend
sudo systemctl start ai-calling-frontend

# Stop
sudo systemctl stop ai-calling-backend
sudo systemctl stop ai-calling-frontend

# Restart
sudo systemctl restart ai-calling-backend
sudo systemctl restart ai-calling-frontend

# Status
sudo systemctl status ai-calling-backend
sudo systemctl status ai-calling-frontend

# Enable (auto-start on boot)
sudo systemctl enable ai-calling-backend
sudo systemctl enable ai-calling-frontend

# View logs
sudo journalctl -u ai-calling-backend -f
sudo journalctl -u ai-calling-frontend -f
```

### Update Code
```bash
cd ~/AI-Calling-Agent
git pull
cd Backend && source venv/bin/activate && pip install -r requirements.txt && deactivate
cd ../interview-bot-frontend && npm install && npm run build
sudo systemctl restart ai-calling-backend ai-calling-frontend
```

### Check What's Running
```bash
# Check ports
sudo lsof -i :8000
sudo lsof -i :3000
sudo lsof -i :80

# Check processes
ps aux | grep uvicorn
ps aux | grep serve
```

### Nginx
```bash
# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Get EC2 Public IP
```bash
curl ifconfig.me
# OR
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

