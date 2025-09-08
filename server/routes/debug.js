const express = require('express');
const router = express.Router();
const debugLogger = require('../utils/debugLogger');

// GET /api/debug - Debug endpoints info
router.get('/', (req, res) => {
  debugLogger.debug('Debug API root endpoint accessed', { 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  }, 'debug-api');
  
  res.json({
    message: 'Tray Tracker Debug API',
    endpoints: {
      logs: '/api/debug/logs',
      trayLogs: '/api/debug/logs/tray',
      surgeonEditLogs: '/api/debug/logs/surgeon-edit',
      stats: '/api/debug/stats',
      test: '/api/debug/test',
      clear: '/api/debug/clear',
      log: '/api/debug/log (POST)',
      'data-dump': '/api/debug/data-dump (POST)'
    },
    status: 'Debug logging is active'
  });
});

// POST /api/debug/log - Log custom debug information
router.post('/log', (req, res) => {
  try {
    const { level = 'debug', message, data, context } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Log the custom message
    switch (level.toLowerCase()) {
      case 'error':
        debugLogger.error(message, data, context || 'custom-log');
        break;
      case 'warn':
        debugLogger.warn(message, data, context || 'custom-log');
        break;
      case 'info':
        debugLogger.info(message, data, context || 'custom-log');
        break;
      case 'debug':
      default:
        debugLogger.debug(message, data, context || 'custom-log');
    }
    
    debugLogger.debug('Custom log entry created', {
      level,
      message,
      hasData: !!data,
      context: context || 'custom-log',
      ip: req.ip
    }, 'debug-api');
    
    res.json({
      success: true,
      message: 'Log entry created',
      data: {
        level,
        message,
        context: context || 'custom-log',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to create custom log entry', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create log entry',
        details: error.message
      }
    });
  }
});

// GET /api/debug/logs - Get recent log entries
router.get('/logs', async (req, res) => {
  try {
    const { type = 'debug', lines = 100, filter } = req.query;
    const logs = debugLogger.getRecentLogs(type, parseInt(lines));
    
    // Apply filter if provided
    let filteredLogs = logs;
    if (filter) {
      const filterLower = filter.toLowerCase();
      filteredLogs = logs.filter(log => 
        log.toLowerCase().includes(filterLower) ||
        log.toLowerCase().includes('🔧') ||
        log.toLowerCase().includes('tray')
      );
    }
    
    res.json({
      success: true,
      data: {
        type,
        lines: filteredLogs.length,
        logs: filteredLogs,
        totalLogsBeforeFilter: logs.length
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestedLines: parseInt(lines),
        filter: filter || null
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get debug logs', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve logs',
        details: error.message
      }
    });
  }
});

// GET /api/debug/logs/tray - Get tray-related log entries specifically
router.get('/logs/tray', async (req, res) => {
  try {
    const { type = 'debug', lines = 200 } = req.query;
    const logs = debugLogger.getRecentLogs(type, parseInt(lines));
    
    // Filter for tray-related logs
    const trayLogs = logs.filter(log => {
      const logLower = log.toLowerCase();
      return logLower.includes('🔧') ||
             logLower.includes('🔥') ||
             logLower.includes('tray') ||
             logLower.includes('dropdown') ||
             logLower.includes('populatetrayid') ||
             logLower.includes('gettrayids') ||
             logLower.includes('/api/trays') ||
             logLower.includes('case_type') ||
             logLower.includes('surgeonpreferencetrayid') ||
             logLower.includes('surgeon-edit') ||
             logLower.includes('modal') ||
             logLower.includes('preferences');
    });
    
    res.json({
      success: true,
      data: {
        type,
        lines: trayLogs.length,
        logs: trayLogs,
        totalLogsBeforeFilter: logs.length
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestedLines: parseInt(lines),
        filter: 'tray-related logs'
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get tray debug logs', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve tray logs',
        details: error.message
      }
    });
  }
});

// GET /api/debug/logs/surgeon-edit - Get surgeon edit related log entries
router.get('/logs/surgeon-edit', async (req, res) => {
  try {
    const { type = 'debug', lines = 100 } = req.query;
    const logs = debugLogger.getRecentLogs(type, parseInt(lines));
    
    // Filter for surgeon edit related logs
    const surgeonEditLogs = logs.filter(log => {
      const logLower = log.toLowerCase();
      return logLower.includes('🔥') ||
             logLower.includes('surgeon') ||
             logLower.includes('edit') ||
             logLower.includes('modal') ||
             logLower.includes('tray') ||
             logLower.includes('dropdown') ||
             logLower.includes('preferences') ||
             logLower.includes('case_type') ||
             logLower.includes('populatetrayid') ||
             logLower.includes('handlecasetypechange');
    });
    
    res.json({
      success: true,
      data: {
        type,
        lines: surgeonEditLogs.length,
        logs: surgeonEditLogs,
        totalLogsBeforeFilter: logs.length
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestedLines: parseInt(lines),
        filter: 'surgeon-edit-related logs'
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get surgeon edit debug logs', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve surgeon edit logs',
        details: error.message
      }
    });
  }
});

// GET /api/debug/stats - Get log file statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = debugLogger.getLogStats();
    
    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get debug stats', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve stats',
        details: error.message
      }
    });
  }
});


// DELETE /api/debug/logs - Clear log files
router.delete('/logs', async (req, res) => {
  try {
    const { type } = req.query;
    const result = debugLogger.clearLogs(type);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          message: result.message,
          clearedType: type || 'all',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to clear logs',
          details: result.error
        }
      });
    }
  } catch (error) {
    debugLogger.error('Failed to clear debug logs', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to clear logs',
        details: error.message
      }
    });
  }
});

// GET /api/debug/test - Test endpoint for debugging
router.get('/test', async (req, res) => {
  try {
    debugLogger.info('Debug test endpoint called', {
      query: req.query,
      headers: req.headers,
      timestamp: new Date().toISOString()
    }, 'debug-test');
    
    res.json({
      success: true,
      data: {
        message: 'Debug test successful',
        timestamp: new Date().toISOString(),
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
          platform: process.platform
        },
        request: {
          method: req.method,
          url: req.originalUrl,
          query: req.query,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      }
    });
  } catch (error) {
    debugLogger.error('Debug test endpoint failed', error, 'debug-test');
    res.status(500).json({
      success: false,
      error: {
        message: 'Debug test failed',
        details: error.message
      }
    });
  }
});

// GET /api/debug/firebase-test - Test Firebase connection
router.get('/firebase-test', async (req, res) => {
  try {
    debugLogger.info('Firebase connection test started', null, 'firebase-test');
    
    // Test Firebase connection if available
    if (req.firestore) {
      const testDoc = await req.firestore.collection('_test').add({
        message: 'Connection test',
        timestamp: new Date()
      });
      
      await req.firestore.collection('_test').doc(testDoc.id).delete();
      
      debugLogger.info('Firebase connection test successful', { docId: testDoc.id }, 'firebase-test');
      
      res.json({
        success: true,
        data: {
          message: 'Firebase connection successful',
          testDocId: testDoc.id,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      debugLogger.warn('Firebase not available in request', null, 'firebase-test');
      res.json({
        success: false,
        error: {
          message: 'Firebase not available'
        }
      });
    }
  } catch (error) {
    debugLogger.error('Firebase connection test failed', error, 'firebase-test');
    res.status(500).json({
      success: false,
      error: {
        message: 'Firebase connection test failed',
        details: error.message
      }
    });
  }
});

// POST /api/debug/frontend-error - Log frontend errors
router.post('/frontend-error', (req, res) => {
  try {
    const { error, userInfo = {} } = req.body;
    
    if (!error) {
      return res.status(400).json({
        success: false,
        error: 'Error information is required'
      });
    }
    
    // Add request info to user info
    const enhancedUserInfo = {
      ...userInfo,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
    
    debugLogger.frontendError(error, enhancedUserInfo);
    
    res.json({
      success: true,
      message: 'Frontend error logged successfully',
      timestamp: new Date().toISOString()
    });
  } catch (logError) {
    debugLogger.error('Failed to log frontend error', logError, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to log frontend error',
        details: logError.message
      }
    });
  }
});

// POST /api/debug/auth - Log authentication events
router.post('/auth', (req, res) => {
  try {
    const { email, method, result, additionalData } = req.body;
    
    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'Authentication method is required'
      });
    }
    
    debugLogger.authAttempt(
      email,
      method,
      req.get('User-Agent'),
      req.ip,
      result || 'attempt'
    );
    
    if (additionalData) {
      debugLogger.debug('Additional auth data', additionalData, 'auth-details');
    }
    
    res.json({
      success: true,
      message: 'Authentication event logged',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    debugLogger.error('Failed to log auth event', error, 'debug-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to log authentication event',
        details: error.message
      }
    });
  }
});

// POST /api/debug/data-dump - Accept Firebase data dump and save to file
router.post('/data-dump', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const dumpData = req.body;
    if (!dumpData || !dumpData.collections) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data dump format'
      });
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `firebase-dump-${timestamp}.json`;
    const filePath = path.join(__dirname, '../../', filename); // Save to project root

    // Write data to file
    await fs.writeFile(filePath, JSON.stringify(dumpData, null, 2));

    // Log the dump event
    debugLogger.info('Firebase data dump saved', {
      filename: filename,
      filePath: filePath,
      collections: Object.keys(dumpData.collections),
      totalItems: Object.values(dumpData.collections).reduce((sum, col) => sum + (col.count || 0), 0),
      user: dumpData.dump_info?.user || 'unknown',
      timestamp: dumpData.timestamp
    }, 'data-dump');

    res.json({
      success: true,
      message: 'Data dump saved successfully',
      filePath: filePath,
      filename: filename,
      summary: {
        collections: Object.keys(dumpData.collections).length,
        totalItems: Object.values(dumpData.collections).reduce((sum, col) => sum + (col.count || 0), 0)
      }
    });

  } catch (error) {
    debugLogger.error('Failed to save data dump', {
      error: error.message,
      stack: error.stack
    }, 'data-dump-error');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to save data dump',
        details: error.message
      }
    });
  }
});

// GET /api/debug/health - System health monitoring
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Debug health endpoint working',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;