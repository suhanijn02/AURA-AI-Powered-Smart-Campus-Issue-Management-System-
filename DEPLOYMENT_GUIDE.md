# 🚀 Campus Issue Management System - Deployment Guide

## 📋 Overview

This is a comprehensive AI-powered campus issue management system built with the MERN stack. The system includes real-time notifications, advanced analytics, role-based access control, and AI-powered issue classification.

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with role-based access control
- **Real-time**: Socket.IO for live updates
- **AI Integration**: OpenAI/Gemini for issue classification
- **File Upload**: Multer for image attachments
- **Security**: Helmet, CORS, Rate Limiting

## 🛠️ Prerequisites

- Node.js 16+ 
- MongoDB 4.4+
- npm or yarn
- Git

## 📦 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd campus-issue-management
```

### 2. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/campus_issues
# OR for MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/campus_issues

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# AI API (Choose one)
OPENAI_API_KEY=your_openai_api_key_here
# OR
GEMINI_API_KEY=your_gemini_api_key_here

# Server
PORT=5000
NODE_ENV=production

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# CORS
FRONTEND_URL=https://yourdomain.com
```

### Frontend (client/.env)
```env
REACT_APP_API_URL=https://your-api-domain.com/api
REACT_APP_SOCKET_URL=https://your-api-domain.com
```

## 🚀 Deployment Options

### Option 1: Traditional VPS/Server

#### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 2. Application Deployment
```bash
# Clone and setup
git clone <repository-url>
cd campus-issue-management
npm install

# Build frontend
cd client
npm run build
cd ..

# Setup PM2 for process management
npm install -g pm2

# Create PM2 config
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'campus-issues',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir logs

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. Nginx Configuration
```bash
# Install Nginx
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/campus-issues
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend static files
    location / {
        root /path/to/campus-issue-management/client/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/campus-issues /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Create uploads directory
RUN mkdir uploads

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/campus_issues
      - JWT_SECRET=your_jwt_secret_here
    depends_on:
      - mongo
    volumes:
      - ./uploads:/app/uploads

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=campus_issues

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  mongo_data:
```

#### 3. Deploy with Docker
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option 3: Cloud Platform Deployment

#### Heroku
```bash
# Install Heroku CLI
# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=mongodb://...
heroku config:set JWT_SECRET=your_jwt_secret

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

#### Vercel (Frontend Only)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd client
vercel --prod
```

#### AWS EC2
1. Launch EC2 instance with Ubuntu
2. Follow Option 1 steps for server setup
3. Configure security groups for ports 80, 443, 5000
4. Set up Elastic IP
5. Configure Route 53 for domain

## 🔍 Testing

### 1. Backend Tests
```bash
# Run API tests
npm test

# Test endpoints
curl http://localhost:5000/api/health
```

### 2. Frontend Tests
```bash
cd client
npm test
```

### 3. Integration Tests
```bash
# Test authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Password123","role":"student"}'

# Test issue creation
curl -X POST http://localhost:5000/api/issues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Test Issue","description":"Test description","priority":"medium"}'
```

## 📊 Monitoring & Maintenance

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart campus-issues
```

### 2. Database Maintenance
```bash
# MongoDB backup
mongodump --db campus_issues --out /backup/$(date +%Y%m%d)

# MongoDB restore
mongorestore --db campus_issues /backup/20231201/campus_issues
```

### 3. Log Rotation
```bash
# Install logrotate
sudo apt install logrotate

# Create logrotate config
sudo nano /etc/logrotate.d/campus-issues
```

```
/path/to/campus-issue-management/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload campus-issues
    endscript
}
```

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secrets**: Use long, random secrets
3. **Database Security**: Use MongoDB authentication
4. **HTTPS**: Always use SSL in production
5. **Rate Limiting**: Configure appropriate limits
6. **Input Validation**: Validate all user inputs
7. **File Uploads**: Scan uploaded files for malware
8. **Regular Updates**: Keep dependencies updated

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check MongoDB service status
   - Verify connection string
   - Check network connectivity

2. **JWT Authentication Issues**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Verify token format

3. **Socket.IO Connection Issues**
   - Check CORS configuration
   - Verify WebSocket support
   - Check firewall settings

4. **File Upload Issues**
   - Check upload directory permissions
   - Verify file size limits
   - Check disk space

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Check environment variables
printenv | grep NODE_ENV
```

## 📈 Performance Optimization

1. **Database Indexing**: Ensure proper MongoDB indexes
2. **Caching**: Implement Redis for session storage
3. **CDN**: Use CDN for static assets
4. **Compression**: Enable gzip compression
5. **Load Balancing**: Use multiple app instances

## 🔄 Backup Strategy

1. **Database Backups**: Daily automated backups
2. **File Backups**: Regular file system backups
3. **Code Backups**: Git repository backups
4. **Configuration Backups**: Environment and config files

## 📞 Support

For issues and support:
1. Check application logs
2. Review this documentation
3. Contact system administrator
4. Create GitHub issues for bugs

---

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Application loads without errors
- ✅ Users can register and login
- ✅ Issues can be created and managed
- ✅ Real-time notifications work
- ✅ File uploads function correctly
- ✅ AI classification works
- ✅ SSL certificate is active
- ✅ Monitoring is configured

Good luck with your deployment! 🚀
