// Frontend Logger - Sends logs to API debug endpoint
export class FrontendLogger {
    constructor(apiBaseUrl = '/api') {
        this.apiBaseUrl = apiBaseUrl;
        this.logQueue = [];
        this.isProcessing = false;
        this.maxQueueSize = 100;
        
        // Send logs every 10 seconds or when queue gets full
        setInterval(() => this.flushLogs(), 10000);
    }

    async sendLog(level, message, data = null, context = 'frontend') {
        // Check global API logging toggle - skip API logging if disabled but still console log
        if (!window.is_enable_api_logging) {
            // Only log to console if API logging is disabled
            console[level] || console.log(`[${level.toUpperCase()}] ${message}`, data);
            return;
        }
        
        const logEntry = {
            level,
            message,
            data: {
                ...data,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                sessionId: this.getSessionId()
            },
            context
        };

        // Add to queue
        this.logQueue.push(logEntry);
        
        // If queue is getting full, flush immediately
        if (this.logQueue.length >= this.maxQueueSize) {
            await this.flushLogs();
        }

        // Also log to console for immediate visibility
        console[level] || console.log(`[${level.toUpperCase()}] ${message}`, data);
    }

    async flushLogs() {
        if (this.isProcessing || this.logQueue.length === 0 || !window.is_enable_api_logging) {
            return;
        }

        this.isProcessing = true;
        const logsToSend = [...this.logQueue];
        this.logQueue = [];

        try {
            // Send each log entry
            for (const logEntry of logsToSend) {
                await fetch(`${this.apiBaseUrl}/debug/log`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(logEntry)
                });
            }
        } catch (error) {
            console.warn('Failed to send logs to API:', error);
            // Put failed logs back in queue (but limit to prevent infinite growth)
            if (this.logQueue.length < this.maxQueueSize / 2) {
                this.logQueue.unshift(...logsToSend.slice(-10)); // Keep only last 10 failed logs
            }
        } finally {
            this.isProcessing = false;
        }
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('frontend-session-id');
        if (!sessionId) {
            sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('frontend-session-id', sessionId);
        }
        return sessionId;
    }

    // Convenience methods
    debug(message, data = null, context = 'frontend') {
        return this.sendLog('debug', message, data, context);
    }

    info(message, data = null, context = 'frontend') {
        return this.sendLog('info', message, data, context);
    }

    warn(message, data = null, context = 'frontend') {
        return this.sendLog('warn', message, data, context);
    }

    error(message, data = null, context = 'frontend') {
        return this.sendLog('error', message, data, context);
    }

    // Log case-related events
    logCaseAction(action, data = null) {
        return this.info(`Case ${action}`, data, 'surgical_cases');
    }

    // Log dropdown population events
    logDropdownPopulation(dropdownType, count, data = null) {
        return this.debug(`Dropdown populated: ${dropdownType}`, {
            count,
            ...data
        }, 'dropdowns');
    }

    // Log Firebase events
    logFirebaseEvent(event, data = null) {
        return this.debug(`Firebase ${event}`, data, 'firebase');
    }

    // Log DataManager events
    logDataManagerEvent(event, data = null) {
        return this.debug(`DataManager ${event}`, data, 'datamanager');
    }

    // Cleanup method
    cleanup() {
        this.flushLogs();
    }
}

// Create global instance
window.frontendLogger = new FrontendLogger();