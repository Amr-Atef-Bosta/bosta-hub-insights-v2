# 🚀 Bosta Insight Hub v2 - Quick Start Guide

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **pnpm** (latest version)
- **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
- **Redis** (v6 or higher) - [Download](https://redis.io/download)
- **Git** - [Download](https://git-scm.com/)

## 🏁 Quick Start (5 minutes)

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd bosta-insight-hub

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

**Required Environment Variables:**

```env
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=bosta_insight_hub

# Redis
REDIS_HOSTNAME=localhost
REDIS_PORT=6379

# OpenAI (Required for AI features)
OPENAI_API_KEY=your_openai_api_key

# Authentication
JWT_SECRET=your_jwt_secret_key
```

### 3. Database Setup

```bash
# Start MySQL service
# On macOS with Homebrew:
brew services start mysql

# On Ubuntu/Debian:
sudo systemctl start mysql

# Create database
mysql -u root -p -e "CREATE DATABASE bosta_insight_hub;"

# Run migrations (tables will be created automatically on first run)
```

### 4. Start Redis

```bash
# On macOS with Homebrew:
brew services start redis

# On Ubuntu/Debian:
sudo systemctl start redis

# Or run Redis in Docker:
docker run -d -p 6379:6379 redis:7-alpine
```

### 5. Run the Application

```bash
# Start both frontend and backend
npm run dev

# Or start them separately:
# Frontend (React):
npm run dev:frontend

# Backend (Node.js):
npm run dev:backend
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## 🔑 First Login

The application includes demo accounts for testing:

| Role | Email | Access Level |
|------|-------|--------------|
| Admin | admin@bosta.co | Full system access |
| Leader | leader@bosta.co | All data access |
| AM | am@bosta.co | Client data, orders |
| Analyst | analyst@bosta.co | Orders, operations |

**Demo Login:**
1. Go to http://localhost:5173/login
2. Click any of the demo role buttons
3. You'll be automatically logged in

## ⚙️ Configuration Steps

### 1. Add Database Connectors (Admin Only)

1. Login as **Admin**
2. Go to **Connectors** page
3. Click **Add Connector**
4. Configure your database connection:

**MySQL Example:**
```
Name: Production MySQL
Type: MySQL
Connection URI: mysql://user:password@host:3306/database
```

**MongoDB Example:**
```
Name: Analytics MongoDB
Type: MongoDB
Connection URI: mongodb://user:password@host:27017/database
```

5. Click **Test** to verify connection
6. Upload schema JSON (optional)

### 2. Configure AI Agents (Admin Only)

1. Go to **Agents** page
2. Customize system prompts for each agent:
   - **AnalystAgent**: Data analysis and SQL queries
   - **VisualizerAgent**: Chart and graph generation
   - **ForecasterAgent**: Time-series forecasting

### 3. Security Settings (Admin Only)

1. Go to **Settings** page
2. Configure:
   - **PII Columns**: Mark sensitive columns for masking
   - **Table Access**: Role-based table permissions
   - **Cache TTL**: Query result caching duration

## 🧪 Testing the Chat Interface

1. Go to **Chat** page
2. Try these example queries:

```
Show me orders from last week
Create a chart of delivery performance by city
What's the trend in order volume?
Predict next month's order count
```

## 🐳 Docker Setup (Alternative)

If you prefer using Docker:

```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Troubleshooting

### Common Issues

**1. Database Connection Error**
```bash
# Check MySQL is running
brew services list | grep mysql
# or
systemctl status mysql

# Verify credentials
mysql -u root -p -h localhost
```

**2. Redis Connection Error**
```bash
# Check Redis is running
redis-cli ping
# Should return "PONG"

# Start Redis if not running
brew services start redis
```

**3. OpenAI API Errors**
- Verify your API key is correct
- Check your OpenAI account has sufficient credits
- Ensure the API key has correct permissions

**4. Port Conflicts**
- Frontend (5173): `lsof -i :5173`
- Backend (3000): `lsof -i :3000`
- Kill conflicting processes: `kill -9 <PID>`

**5. Environment Variables Not Loading**
```bash
# Verify .env file exists and has correct format
cat .env

# Restart the development server
npm run dev
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
export DEBUG=bosta:*
npm run dev:backend
```

### Database Reset

If you need to reset the database:

```bash
# Drop and recreate database
mysql -u root -p -e "DROP DATABASE bosta_insight_hub; CREATE DATABASE bosta_insight_hub;"

# Restart the application (migrations will re-run)
npm run dev
```

## 📚 Additional Resources

- **API Documentation**: http://localhost:3000/api/health
- **Project Structure**: See `README.md`
- **Deployment Guide**: See `k8s/` directory for Kubernetes deployment
- **Database Schema**: See `mysql/migrations/` directory

## 🆘 Getting Help

If you encounter issues:

1. Check the application logs in your terminal
2. Verify all prerequisites are installed and running
3. Ensure environment variables are correctly set
4. Check firewall settings for required ports

**Development Team Contact:**
- Engineering: engineering@bosta.co
- Slack: #insight-hub-support

---

**🎉 You're ready to start using Bosta Insight Hub v2!**

The platform is now running locally and ready for data analysis and AI-powered insights.