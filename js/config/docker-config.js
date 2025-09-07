// Docker-specific configuration
// This file can be mounted or replaced in Docker containers

// Set Firebase configuration environment
window.ENVIRONMENT_VARIABLE_FILE = 'dino-dev-1';

window.TRAY_TRACKER_CONFIG = {
    // Force clean URLs in Docker environment
    CLEAN_URLS_ENABLED: true,
    
    // Docker-specific settings
    ENVIRONMENT: 'docker',
    USE_CLEAN_URLS: true,
    
    // API configuration
    API_BASE_URL: '/api',
    
    // Debug settings
    DEBUG_ROUTING: true
};

console.log('🐳 Docker configuration loaded - Clean URLs enabled');