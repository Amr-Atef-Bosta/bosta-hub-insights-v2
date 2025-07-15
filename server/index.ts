import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import connectorRoutes from './routes/connectors.js';
import agentRoutes from './routes/agents.js';
import settingsRoutes from './routes/settings.js';
import validatedQueriesRoutes from './routes/validatedQueries.js';
import dashboardChatRoutes from './routes/dashboardChat.js';
import dashboardChatRoutes from './routes/dashboardChat.js';
import { initializeDatabase } from './database/init.js';
import { closeDatabase } from './database/init.js';
import { authenticateToken } from './middleware/auth.js';
import { logger } from './utils/logger.js';
import { ValidatedQueriesService } from './services/validatedQueries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.openai.com"],
    },
  } : false,
}));

// Configure CORS based on environment
let corsOrigins: string[] | boolean = false;
if (process.env.NODE_ENV === 'development') {
  corsOrigins = ['http://localhost:5173', 'http://localhost:3000'];
} else if (process.env.NODE_ENV === 'staging') {
  corsOrigins = ['https://stg-insights-hub.bosta.co'];
} else if (process.env.NODE_ENV === 'production') {
  corsOrigins = ['https://insights-hub.bosta.co']; // Update with your production domain
}

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (before routes)
app.use(logger.getExpressWinstonMiddleware());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/connectors', authenticateToken, connectorRoutes);
app.use('/api/agents', authenticateToken, agentRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/validated-queries', authenticateToken, validatedQueriesRoutes);
app.use('/api/dashboard-chat', authenticateToken, dashboardChatRoutes);
app.use('/api/dashboard-chat', authenticateToken, dashboardChatRoutes);

// Serve charts directory for all environments
app.use('/charts', express.static(path.join(process.cwd(), 'public/charts')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug route for deployment troubleshooting
app.get('/api/debug', (req, res) => {
  const staticPath = path.join(process.cwd(), 'dist');
  res.json({
    environment: process.env.NODE_ENV,
    staticPath,
    currentWorkingDirectory: process.cwd(),
    serverFile: __filename,
    serverDir: __dirname,
    timestamp: new Date().toISOString()
  });
});

// Chart debug endpoint
app.get('/api/debug/charts', async (req, res) => {
  try {
    const chartsDir = path.join(process.cwd(), 'public', 'charts');
    const fs = await import('fs/promises');
    
    // Check if charts directory exists
    let dirExists = false;
    let files: string[] = [];
    
    try {
      await fs.access(chartsDir);
      dirExists = true;
      const dirContents = await fs.readdir(chartsDir);
      files = dirContents.filter(file => file.endsWith('.png'));
    } catch (error) {
      // Directory doesn't exist or is not accessible
    }

    res.json({
      chartsDirectory: chartsDir,
      directoryExists: dirExists,
      chartFiles: files,
      chartCount: files.length,
      sampleUrls: files.slice(0, 3).map(file => `/charts/${file}`),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to check charts directory',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Serve static files in production and staging (AFTER API routes)
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  // In production, frontend files are in the dist directory at the root
  const staticPath = path.join(process.cwd(), 'dist');
  
  app.use(express.static(staticPath));
  
  // Catch-all handler: send back React's index.html file for non-API routes
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API endpoint not found' });
      return;
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Configure Socket.IO CORS based on environment
let socketCorsOrigins: string[] | boolean = false;
if (process.env.NODE_ENV === 'development') {
  socketCorsOrigins = ['http://localhost:5173'];
} else if (process.env.NODE_ENV === 'staging') {
  socketCorsOrigins = ['https://stg-insights-hub.bosta.co'];
} else if (process.env.NODE_ENV === 'production') {
  socketCorsOrigins = ['https://insights-hub.bosta.co']; // Update with your production domain
}

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigins,
    methods: ['GET', 'POST'],
  },
});

// Socket.IO for real-time features
io.on('connection', (socket) => {
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Error logging middleware (after routes, before error handlers)
app.use(logger.getExpressWinstonErrorMiddleware());

// Error handling middleware
app.use((req: any, res: any, _next: any) => {
  logger.error('Unhandled error:', req.error || new Error('Unhandled error'));
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Warm up filter cache after database initialization
    const validatedQueriesService = new ValidatedQueriesService();
    try {
      await validatedQueriesService.warmUpFilterCache();
      logger.info('Filter cache warm-up completed successfully');
    } catch (cacheError) {
      logger.warn('Filter cache warm-up failed (non-critical):', cacheError);
    }

    // Set up periodic filter cache refresh every 6 hours
    const FILTER_CACHE_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    setInterval(async () => {
      try {
        logger.info('Starting scheduled filter cache refresh...');
        await validatedQueriesService.warmUpFilterCache();
        logger.info('Scheduled filter cache refresh completed');
      } catch (error) {
        logger.warn('Scheduled filter cache refresh failed:', error);
      }
    }, FILTER_CACHE_REFRESH_INTERVAL);
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  try {
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  try {
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

startServer();

export { io };