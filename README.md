# Bosta Insight Hub v2

A comprehensive analytics and AI-powered chat interface for Bosta's logistics operations. This application provides natural language querying of logistics data with multi-agent AI processing, role-based access control, and real-time insights.

## 🚀 Features

### Phase 1 (Current)
- **Multi-Agent Chat System**: Natural language queries processed by specialized AI agents
- **Database Connectors**: Support for MySQL and MongoDB with secure connection management
- **Role-Based Access Control**: Fine-grained permissions for different user roles
- **PII Protection**: Automatic masking of sensitive data for non-admin users
- **Real-time Chat Interface**: Slack-like chat experience with persistent conversations
- **Data Visualization**: Automatic chart generation for query results
- **Forecasting**: Time-series analysis and prediction capabilities
- **Admin Management**: Comprehensive admin panels for system configuration

### Phase 2 (Planned)
- Dashboard creation and KPI monitoring
- Pre-built query templates
- WhatsApp integration
- Advanced analytics and reporting

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │   Node.js API   │    │   MySQL Meta    │
│   (Vite + TS)   │◄──►│   (Express)     │◄──►│   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Redis Cache   │    │   OpenAI API    │
                       │                 │    │   (GPT-4)       │
                       └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  External DBs   │
                       │ (MySQL/Mongo)   │
                       └─────────────────┘
```

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, TypeScript
- **Database**: MySQL (meta), Redis (cache)
- **AI**: OpenAI GPT-4, Multi-agent architecture
- **Deployment**: Docker, Kubernetes, Helm
- **Authentication**: JWT, SAML (production)

## 📦 Installation

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Redis 6+
- OpenAI API key

### Local Development

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd bosta-insight-hub
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start services**:
```bash
# Start MySQL and Redis (using Docker)
docker-compose up -d mysql redis

# Start development servers
npm run dev
```

4. **Access the application**:
- Frontend: http://localhost:5173
- API: http://localhost:3000

### Production Deployment

#### Docker
```bash
# Build image
docker build -t bosta/insight-hub:latest .

# Run with docker-compose
docker-compose up -d
```

#### Kubernetes
```bash
# Create namespace and secrets
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy infrastructure
kubectl apply -f k8s/mysql.yaml
kubectl apply -f k8s/redis.yaml

# Deploy application
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

#### Helm
```bash
# Install with Helm
helm install insight-hub ./helm \
  --set secrets.openaiApiKey="your-key" \
  --set secrets.jwtSecret="your-secret" \
  --set ingress.hosts[0].host="insighthub.yourdomain.com"
```

## 🔧 Configuration

### Database Connectors
1. Navigate to **Connectors** page (admin only)
2. Click **Add Connector**
3. Configure connection details:
   - **MySQL**: `mysql://user:pass@host:port/database`
   - **MongoDB**: `mongodb://user:pass@host:port/database`
4. Upload schema JSON (optional)
5. Test connection

### Agent Configuration
1. Navigate to **Agents** page (admin only)
2. Customize system prompts for each agent:
   - **AnalystAgent**: Data analysis and SQL queries
   - **VisualizerAgent**: Chart and graph generation
   - **ForecasterAgent**: Time-series forecasting
   - **SupervisorAgent**: Query routing and coordination

### Security Settings
1. Navigate to **Settings** page (admin only)
2. Configure:
   - **PII Columns**: Columns to mask for non-admin users
   - **Table Access**: Role-based table permissions
   - **Cache TTL**: Query result caching duration
   - **Feature Flags**: Enable/disable system features

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, configuration management |
| **Leader** | All data access, team management |
| **AM** | Client data, orders, delivery stats |
| **Analyst** | Orders, operational metrics, HR data |

## 🤖 AI Agents

### SupervisorAgent
Routes user queries to appropriate specialist agents based on intent analysis.

### AnalystAgent
- Executes SQL queries against connected databases
- Provides data analysis and insights
- Handles PII masking based on user roles

### VisualizerAgent
- Creates charts and visualizations
- Supports bar charts, line charts, pie charts
- Applies Bosta branding automatically

### ForecasterAgent
- Performs time-series analysis
- Generates forecasts with confidence intervals
- Creates forecast visualization charts

## 🔒 Security

- **Authentication**: JWT tokens with configurable expiration
- **Authorization**: Role-based access control (RBAC)
- **PII Protection**: Automatic data masking for sensitive columns
- **SQL Injection**: Parameterized queries and input validation
- **Rate Limiting**: API rate limiting and query timeouts
- **HTTPS**: TLS encryption for all communications

## 📊 Monitoring

### Health Checks
- **Application**: `GET /api/health`
- **Database**: Connection pool monitoring
- **Redis**: Cache connectivity checks

### Logging
- Structured logging with Winston
- Audit logs for all user actions
- Performance metrics and query timing

### Metrics
- Query execution times
- Cache hit rates
- User activity patterns
- Error rates and types

## 🚀 API Reference

### Authentication
```bash
# Demo login
POST /api/auth/demo-login
{
  "role": "admin|leader|am|analyst"
}

# Regular login
POST /api/auth/login
{
  "email": "user@bosta.co",
  "password": "password"
}
```

### Chat
```bash
# Send message
POST /api/chat
{
  "message": "Show me orders from last week",
  "conversationId": "optional-conversation-id"
}

# Get conversation history
GET /api/chat/history/:conversationId
```

### Connectors
```bash
# List connectors
GET /api/connectors

# Create connector
POST /api/connectors
{
  "name": "Production MySQL",
  "kind": "mysql",
  "conn_uri": "mysql://user:pass@host:port/db",
  "schema_json": "{...}"
}

# Test connection
POST /api/connectors/:id/test
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📈 Performance

- **Query Caching**: Redis-based result caching with configurable TTL
- **Connection Pooling**: Efficient database connection management
- **Lazy Loading**: On-demand component and data loading
- **Code Splitting**: Optimized bundle sizes with dynamic imports

## 🔄 Development Workflow

1. **Feature Development**: Create feature branch from `main`
2. **Testing**: Ensure all tests pass and coverage requirements met
3. **Code Review**: Submit PR with detailed description
4. **Deployment**: Automatic deployment to staging on merge
5. **Production**: Manual promotion to production environment

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Bosta. All rights reserved.

## 🆘 Support

For technical support or questions:
- **Email**: engineering@bosta.co
- **Slack**: #insight-hub-support
- **Documentation**: [Internal Wiki](https://wiki.bosta.co/insight-hub)

---

**Bosta Insight Hub v2** - Empowering data-driven decisions in MENA logistics 🚚📊