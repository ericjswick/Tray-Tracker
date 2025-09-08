const fs = require('fs');
const path = require('path');

class DebugLogger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    this.debugFile = path.join(this.logsDir, 'debug.log');
    this.errorFile = path.join(this.logsDir, 'error.log');
    this.apiFile = path.join(this.logsDir, 'api.log');
    
    // Ensure logs directory exists
    this.ensureLogsDirectory();
    
    // Initialize log files
    this.initializeLogFiles();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      console.log('📁 Created logs directory:', this.logsDir);
    }
  }

  initializeLogFiles() {
    const initMessage = `\n=== DEBUG LOGGER INITIALIZED: ${new Date().toISOString()} ===\n`;
    
    // Initialize each log file with error handling
    [this.debugFile, this.errorFile, this.apiFile].forEach(file => {
      try {
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, initMessage);
        } else {
          fs.appendFileSync(file, initMessage);
        }
      } catch (error) {
        console.warn(`⚠️  Could not initialize log file ${file}:`, error.message);
        // Disable file logging for this instance
        this.fileLoggingEnabled = false;
      }
    });
    
    if (this.fileLoggingEnabled !== false) {
      this.fileLoggingEnabled = true;
    }
  }

  formatMessage(level, message, data = null, context = null) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    const dataStr = data ? `\nDATA: ${JSON.stringify(data, null, 2)}` : '';
    
    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}${dataStr}\n`;
  }

  debug(message, data = null, context = null) {
    const logMessage = this.formatMessage('debug', message, data, context);
    console.log('🐛', logMessage.trim());
    
    try {
      fs.appendFileSync(this.debugFile, logMessage);
    } catch (error) {
      console.error('Failed to write to debug log:', error);
    }
  }

  info(message, data = null, context = null) {
    const logMessage = this.formatMessage('info', message, data, context);
    console.log('ℹ️', logMessage.trim());
    
    try {
      fs.appendFileSync(this.debugFile, logMessage);
    } catch (error) {
      console.error('Failed to write to debug log:', error);
    }
  }

  warn(message, data = null, context = null) {
    const logMessage = this.formatMessage('warn', message, data, context);
    console.warn('⚠️', logMessage.trim());
    
    try {
      fs.appendFileSync(this.debugFile, logMessage);
    } catch (error) {
      console.error('Failed to write to debug log:', error);
    }
  }

  error(message, error = null, context = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code
    } : null;
    
    const logMessage = this.formatMessage('error', message, errorData, context);
    console.error('❌', logMessage.trim());
    
    try {
      fs.appendFileSync(this.errorFile, logMessage);
      fs.appendFileSync(this.debugFile, logMessage);
    } catch (writeError) {
      console.error('Failed to write to error log:', writeError);
    }
  }

  apiRequest(req, res, duration) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    };

    const message = `API ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`;
    const logMessage = this.formatMessage('api', message, logData);
    
    try {
      fs.appendFileSync(this.apiFile, logMessage);
    } catch (error) {
      console.error('Failed to write to API log:', error);
    }
  }

  // Get recent log entries
  getRecentLogs(type = 'debug', lines = 100) {
    try {
      let file;
      switch (type) {
        case 'error':
          file = this.errorFile;
          break;
        case 'api':
          file = this.apiFile;
          break;
        case 'debug':
        default:
          file = this.debugFile;
          break;
      }

      if (!fs.existsSync(file)) {
        return [];
      }

      const content = fs.readFileSync(file, 'utf8');
      const logLines = content.split('\n').filter(line => line.trim());
      
      // Return last N lines
      return logLines.slice(-lines);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  // Clear log files
  clearLogs(type = null) {
    try {
      const files = [];
      
      if (type === 'debug' || !type) files.push(this.debugFile);
      if (type === 'error' || !type) files.push(this.errorFile);
      if (type === 'api' || !type) files.push(this.apiFile);
      
      files.forEach(file => {
        if (fs.existsSync(file)) {
          const clearMessage = `\n=== LOG CLEARED: ${new Date().toISOString()} ===\n`;
          fs.writeFileSync(file, clearMessage);
        }
      });
      
      return { success: true, message: `Cleared ${type || 'all'} logs` };
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return { success: false, error: error.message };
    }
  }

  // Get log file stats
  getLogStats() {
    try {
      const stats = {};
      
      [
        { key: 'debug', file: this.debugFile },
        { key: 'error', file: this.errorFile },
        { key: 'api', file: this.apiFile }
      ].forEach(({ key, file }) => {
        if (fs.existsSync(file)) {
          const stat = fs.statSync(file);
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\n').filter(line => line.trim()).length;
          
          stats[key] = {
            size: stat.size,
            sizeFormatted: this.formatBytes(stat.size),
            lines: lines,
            lastModified: stat.mtime.toISOString(),
            exists: true
          };
        } else {
          stats[key] = { exists: false };
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return {};
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Enhanced authentication logging
  authAttempt(email, method, userAgent, ip, result = 'started') {
    const authData = {
      email: email || 'unknown',
      method,
      userAgent,
      ip,
      result,
      timestamp: new Date().toISOString()
    };
    
    const message = `Auth ${result}: ${method} for ${email || 'unknown'}`;
    const logMessage = this.formatMessage('auth', message, authData, 'authentication');
    
    console.log(`🔐 ${message}`);
    
    try {
      fs.appendFileSync(this.debugFile, logMessage);
      // Also log to API file for correlation
      fs.appendFileSync(this.apiFile, logMessage);
    } catch (error) {
      console.error('Failed to write auth log:', error);
    }
  }

  // Frontend error logging
  frontendError(error, userInfo = {}) {
    const errorData = {
      message: error.message || error,
      stack: error.stack,
      url: error.url || userInfo.url,
      line: error.line || userInfo.line,
      column: error.column || userInfo.column,
      userAgent: userInfo.userAgent,
      userId: userInfo.userId,
      timestamp: new Date().toISOString()
    };
    
    const message = `Frontend Error: ${error.message || error}`;
    const logMessage = this.formatMessage('frontend-error', message, errorData, 'frontend');
    
    console.error('🌐❌', message);
    
    try {
      fs.appendFileSync(this.errorFile, logMessage);
      fs.appendFileSync(this.debugFile, logMessage);
    } catch (writeError) {
      console.error('Failed to write frontend error log:', writeError);
    }
  }

  // System monitoring
  systemHealth() {
    const healthData = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString()
    };
    
    const message = `System Health Check - Uptime: ${Math.floor(process.uptime())}s`;
    this.debug(message, healthData, 'system-health');
  }
}

// Create singleton instance
const debugLogger = new DebugLogger();

module.exports = debugLogger;