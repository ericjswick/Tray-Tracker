const debugLogger = require('../utils/debugLogger');

const logger = (req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Add request ID to request object for tracking
  req.requestId = requestId;
  
  // Log detailed request info
  const requestInfo = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    contentType: req.get('Content-Type'),
    timestamp: new Date().toISOString()
  };
  
  // Log authentication attempts specifically
  if (req.originalUrl.includes('/auth/') || req.originalUrl.includes('/login')) {
    debugLogger.info(`Authentication attempt: ${req.method} ${req.originalUrl}`, requestInfo, 'auth-attempt');
  }
  
  // Log request start
  console.log(`${new Date().toISOString()} - [${requestId}] ${req.method} ${req.url}`);
  debugLogger.debug(`Request started: ${req.method} ${req.url}`, requestInfo, 'request-start');
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    
    console.log(`${new Date().toISOString()} - [${requestId}] ${req.method} ${req.url} ${statusColor}${status}\x1b[0m ${duration}ms`);
    
    // Enhanced response info
    const responseInfo = {
      ...requestInfo,
      status,
      duration,
      contentLength: res.get('Content-Length'),
      responseTime: `${duration}ms`
    };
    
    // Log to file using debug logger
    debugLogger.apiRequest(req, res, duration);
    
    // Log authentication results
    if (req.originalUrl.includes('/auth/') || req.originalUrl.includes('/login')) {
      const authResult = status >= 400 ? 'failed' : 'successful';
      debugLogger.info(`Authentication ${authResult}: ${req.method} ${req.originalUrl}`, responseInfo, 'auth-result');
    }
    
    // Enhanced error logging
    if (status >= 400) {
      const errorLevel = status >= 500 ? 'error' : 'warn';
      debugLogger[errorLevel](`API ${errorLevel.toUpperCase()}: ${req.method} ${req.url}`, responseInfo, 'api-error');
      
      // Log request body for failed requests (excluding sensitive data)
      if (req.body && Object.keys(req.body).length > 0) {
        const sanitizedBody = { ...req.body };
        // Remove sensitive fields
        ['password', 'token', 'secret', 'key'].forEach(field => {
          if (sanitizedBody[field]) {
            sanitizedBody[field] = '[REDACTED]';
          }
        });
        debugLogger[errorLevel](`Failed request body`, sanitizedBody, `api-error-body-${requestId}`);
      }
    }
    
    // Log slow requests (>1000ms)
    if (duration > 1000) {
      debugLogger.warn(`Slow request detected: ${req.method} ${req.url}`, responseInfo, 'slow-request');
    }
  });
  
  next();
};

module.exports = logger;