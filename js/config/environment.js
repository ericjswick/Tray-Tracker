// Default environment configuration
// This file will be replaced by Docker or other environments as needed

window.TRAY_TRACKER_CONFIG = {
    // Default: Auto-detect URL strategy
    CLEAN_URLS_ENABLED: null, // null = auto-detect
    
    // Environment settings
    ENVIRONMENT: 'default',
    USE_CLEAN_URLS: null, // null = auto-detect
    
    // API configuration
    API_BASE_URL: '/api',
    
    // Debug settings
    DEBUG_ROUTING: false
};

console.log('⚙️ Default configuration loaded - Auto-detecting URL strategy');