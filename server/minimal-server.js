const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Import specific routes that work
const trayRoutes = require('./routes/trays');
const physicianPreferencesRoutes = require('./routes/physicianPreferences');
const debugRoutes = require('./routes/debug');

// Import middleware
const logger = require('./middleware/logger');

// Import debug logger
const debugLogger = require('./utils/debugLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:9090', 'http://localhost:3000', 'https://traytracker.com'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging middleware
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Tray Tracker API Server (Minimal)',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      trays: '/api/trays',
      physicianPreferences: '/api/physician-preferences',
      debug: '/api/debug'
    }
  });
});

// API root endpoint
const apiInfo = {
  message: 'Tray Tracker API (Minimal)',
  version: '1.0.0',
  endpoints: {
    debug: '/api/debug',
    debugLogs: '/api/debug/logs',
    trayLogs: '/api/debug/logs/tray',
    trays: '/api/trays',
    physicianPreferences: '/api/physician-preferences'
  }
};

app.get('/api', (req, res) => res.json(apiInfo));

// Debug routes FIRST (completely bypass Firestore for debugging)
app.use('/api/debug', debugRoutes);

// Mock Firestore middleware for testing (replace with real one when available)
const mockFirestoreMiddleware = (req, res, next) => {
  // Mock Firestore instance - replace with real Firebase initialization
  req.firestore = {
    collection: (collectionName) => ({
      add: async (data) => ({ id: 'mock-id-' + Date.now() }),
      doc: (id) => ({
        get: async () => ({ 
          exists: false,
          data: () => null
        }),
        update: async (data) => {},
        delete: async () => {}
      }),
      where: (field, operator, value) => ({
        where: (field2, operator2, value2) => ({
          get: async () => ({
            size: 0,
            forEach: (callback) => {}
          })
        }),
        get: async () => ({
          size: 0,
          forEach: (callback) => {}
        })
      }),
      orderBy: (field, direction) => ({
        limit: (num) => ({
          get: async () => ({
            size: 0,
            forEach: (callback) => {}
          })
        }),
        get: async () => ({
          size: 0,
          forEach: (callback) => {}
        })
      }),
      get: async () => ({
        size: 0,
        forEach: (callback) => {}
      })
    })
  };
  next();
};

// Add simple auth middleware that always passes for debugging
const mockAuthMiddleware = (req, res, next) => {
  req.user = { id: 'mock-user', email: 'test@example.com' };
  next();
};

// API routes with mock middleware
app.use('/api/trays', mockFirestoreMiddleware, mockAuthMiddleware, trayRoutes);
app.use('/api/physician-preferences', mockFirestoreMiddleware, mockAuthMiddleware, physicianPreferencesRoutes);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

// Error handling
app.use((error, req, res, next) => {
  debugLogger.error('Unhandled error', error, 'error-handler');
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      details: error.message
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tray Tracker Minimal API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🐛 Debug API: http://localhost:${PORT}/api/debug`);
  console.log(`🔧 Tray API: http://localhost:${PORT}/api/trays`);
  
  // Log server start
  debugLogger.info('Tray Tracker Minimal API Server started', {
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  }, 'server-startup');
});

module.exports = app;