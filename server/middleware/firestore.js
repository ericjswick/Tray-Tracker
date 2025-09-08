const { injectFirestore } = require('../shared_backend/utils/vercelHelpers');
const debugLogger = require('../utils/debugLogger');

// Middleware to inject Firestore into all requests
const firestoreMiddleware = (req, res, next) => {
  try {
    injectFirestore(req, res, () => {
      debugLogger.debug('Firestore injected into request', {
        url: req.originalUrl,
        method: req.method
      }, 'firestore-middleware');
      next();
    });
  } catch (error) {
    debugLogger.error('Failed to inject Firestore', error, 'firestore-middleware');
    res.status(500).json({
      success: false,
      error: {
        message: 'Database connection failed',
        statusCode: 500
      }
    });
  }
};

module.exports = firestoreMiddleware;