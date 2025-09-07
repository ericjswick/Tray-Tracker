// RoutingDetector.js - Detect environment and choose URL strategy
export class RoutingDetector {
    constructor() {
        this.routingStrategy = null;
        this.isCleanUrlsSupported = null;
    }

    // Detect if clean URLs are supported in current environment
    async detectRoutingStrategy() {
        if (this.routingStrategy) {
            return this.routingStrategy;
        }

        // Check environment indicators
        const isVercel = this.isVercelEnvironment();
        const isDockerWithNginx = this.isDockerWithNginxSupport();
        const hasCleanUrlsFlag = this.hasCleanUrlsEnvironmentFlag();
        
        // Check if server supports clean URLs by testing
        const supportsCleanUrls = await this.testCleanUrlSupport();

        // Determine strategy
        if (isVercel || isDockerWithNginx || hasCleanUrlsFlag || supportsCleanUrls) {
            this.routingStrategy = 'clean';
            this.isCleanUrlsSupported = true;
            console.log('🌍 Using clean URLs (/locations, /trays, etc.)');
        } else {
            this.routingStrategy = 'hash';
            this.isCleanUrlsSupported = false;
            console.log('🔗 Using hash URLs (/#locations, /#trays, etc.)');
        }

        return this.routingStrategy;
    }

    // Check if running on Vercel
    isVercelEnvironment() {
        // Vercel sets specific headers and environment indicators
        return (
            window.location.hostname.includes('vercel.app') ||
            window.location.hostname.includes('vercel.com') ||
            // Check for Vercel-specific headers (if available in client)
            document.querySelector('meta[name="vercel-deployment-url"]') !== null
        );
    }

    // Check if Docker with nginx support
    isDockerWithNginxSupport() {
        // Look for nginx-specific indicators
        return (
            // Check if running on a port that suggests Docker (8080, 80, etc.)
            (window.location.port === '8080' || window.location.port === '80') ||
            // Look for nginx server headers (if accessible)
            this.hasNginxServerHeader() ||
            // Check for environment variable indicator
            window.NGINX_CONFIGURED === true
        );
    }

    // Check for explicit environment flag
    hasCleanUrlsEnvironmentFlag() {
        // Check various ways this might be configured
        return (
            // Global variables
            window.CLEAN_URLS_ENABLED === true ||
            window.USE_CLEAN_URLS === true ||
            // Configuration object
            window.TRAY_TRACKER_CONFIG?.CLEAN_URLS_ENABLED === true ||
            window.TRAY_TRACKER_CONFIG?.USE_CLEAN_URLS === true ||
            // Local storage override
            localStorage.getItem('forceCleanUrls') === 'true'
        );
    }

    // Check for nginx server header
    hasNginxServerHeader() {
        // This is limited in client-side JS, but we can try
        try {
            // In some cases, server headers might be accessible
            return false; // Placeholder - limited by CORS
        } catch (e) {
            return false;
        }
    }

    // Test if clean URLs actually work by making a test request
    async testCleanUrlSupport() {
        try {
            // Create a test URL that should return the same index.html
            const testPath = '/routing-test-' + Date.now();
            const response = await fetch(testPath, { 
                method: 'HEAD', // Just check headers, don't download content
                redirect: 'manual' // Don't follow redirects
            });
            
            // If we get a successful response or a redirect (not 404), clean URLs likely work
            return response.ok || (response.status >= 300 && response.status < 400);
        } catch (error) {
            // If fetch fails, assume clean URLs don't work
            console.log('Clean URL test failed, using hash routing');
            return false;
        }
    }

    // Get current routing strategy
    getRoutingStrategy() {
        return this.routingStrategy || 'hash'; // Default to hash
    }

    // Check if clean URLs are supported
    supportsCleanUrls() {
        return this.isCleanUrlsSupported === true;
    }

    // Force a specific routing strategy (for testing)
    forceRoutingStrategy(strategy) {
        if (strategy === 'clean' || strategy === 'hash') {
            this.routingStrategy = strategy;
            this.isCleanUrlsSupported = strategy === 'clean';
            console.log(`🔧 Forced routing strategy: ${strategy}`);
        }
    }
}

// Export singleton instance
export const routingDetector = new RoutingDetector();