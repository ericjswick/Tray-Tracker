const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import routes
const caseRoutes = require('./routes/cases');
const surgeonRoutes = require('./routes/surgeons');
const facilityRoutes = require('./routes/facilities');
const caseTypeRoutes = require('./routes/caseTypes');
const trayRoutes = require('./routes/trays');
const physicianPreferencesRoutes = require('./routes/physicianPreferences');
const authRoutes = require('./routes/auth');
const debugRoutes = require('./routes/debug');
const testRoutes = require('./routes/test');
const migrationsRoutes = require('./routes/migrations');
// const geocodingRoutes = require('./routes/geocoding'); // Broken - has sendSuccess/sendError issues
const geocodingSimpleRoutes = require('./routes/geocoding-simple');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');
const firestoreMiddleware = require('./middleware/firestore');

// Import debug logger
const debugLogger = require('./utils/debugLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:9090', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting - COMMENTED OUT FOR DEBUGGING
// const debugLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 100, // 100 requests per minute for debug
//   message: 'Too many debug requests, please slow down.'
// });

// const generalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes  
//   max: 200, // 200 requests per 15 minutes for other APIs
//   message: 'Too many requests from this IP, please try again later.'
// });

// Apply different rate limits - COMMENTED OUT FOR DEBUGGING  
// app.use('/api/debug', debugLimiter);
// app.use('/api/', generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging middleware
app.use(logger);

// Health check endpoint (before Firestore middleware to avoid DB dependency)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint (before Firestore middleware to avoid DB dependency)
app.get('/', (req, res) => {
  res.json({
    message: 'Tray Tracker API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      cases: '/api/cases',
      surgeons: '/api/surgeons',
      facilities: '/api/facilities',
      caseTypes: '/api/case-types',
      trays: '/api/trays',
      physicianPreferences: '/api/physician-preferences',
      migrations: '/api/migrations',
      geocoding: '/api/geocoding'
    }
  });
});

// API root endpoints (before Firestore middleware)
const apiInfo = {
  message: 'Tray Tracker API',
  version: '1.0.0',
  endpoints: {
    auth: '/api/auth',
    debug: '/api/debug',
    debugLogs: '/api/debug/logs',
    debugHealth: '/api/debug/health',
    frontendErrors: '/api/debug/frontend-error',
    authLogging: '/api/debug/auth',
    cases: '/api/cases',
    surgeons: '/api/surgeons',
    facilities: '/api/facilities',
    caseTypes: '/api/case-types',
    trays: '/api/trays',
    physicianPreferences: '/api/physician-preferences',
    migrations: '/api/migrations',
    geocoding: '/api/geocoding'
  }
};

app.get('/api', (req, res) => res.json(apiInfo));
app.get('/api/', (req, res) => res.json(apiInfo));

// Debug routes FIRST (completely bypass Firestore)
app.use('/api/debug', debugRoutes);

// Test routes (for testing Firebase and Twilio connections)
app.use('/api/test', testRoutes);

// Geocoding routes (no auth required, no Firestore needed) - use working simple version
app.use('/api/geocoding', geocodingSimpleRoutes);
app.use('/api/geocoding-simple', geocodingSimpleRoutes);

// Migrations routes (with Firestore middleware for database operations)
app.use('/api/migrations', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on migrations', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, migrationsRoutes);

// API routes with Firestore middleware
app.use('/api/auth', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on auth', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authRoutes);

app.use('/api/cases', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on cases', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authMiddleware, caseRoutes);

app.use('/api/surgeons', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on surgeons', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authMiddleware, surgeonRoutes);

app.use('/api/facilities', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on facilities', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authMiddleware, facilityRoutes);

app.use('/api/case-types', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on case-types', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authMiddleware, caseTypeRoutes);

app.use('/api/trays', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on trays', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authMiddleware, trayRoutes);

app.use('/api/physician-preferences', (req, res, next) => {
  try {
    firestoreMiddleware(req, res, next);
  } catch (error) {
    debugLogger.error('Firestore middleware error on physician preferences', error, 'middleware');
    res.status(500).json({ success: false, error: { message: 'Database connection failed' } });
  }
}, authMiddleware, physicianPreferencesRoutes);


// Error handling middleware (must be last)
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tray Tracker API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🐛 Debug API: http://localhost:${PORT}/api/debug`);
  
  // Log server start
  debugLogger.info('Tray Tracker API Server started', {
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  }, 'server-startup');
});

module.exports = app;