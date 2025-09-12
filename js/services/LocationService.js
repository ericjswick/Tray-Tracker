// LocationService.js - GPS location tracking service
export class LocationService {
    constructor() {
        this.lastKnownPosition = null;
        this.watchId = null;
    }

    /**
     * Get current GPS coordinates
     * @param {Object} options - Geolocation options
     * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
     */
    async getCurrentPosition(options = {}) {
        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds
            maximumAge: 5 * 60 * 1000, // 5 minutes
            ...options
        };

        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    
                    this.lastKnownPosition = locationData;
                    console.log('📍 GPS Location obtained:', locationData);
                    resolve(locationData);
                },
                (error) => {
                    console.error('📍 GPS Location error:', error);
                    let errorMessage = 'Failed to get location';
                    
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                    }
                    
                    reject(new Error(errorMessage));
                },
                defaultOptions
            );
        });
    }

    /**
     * Get location with fallback to last known position
     * @param {Object} options - Geolocation options
     * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number, source: string}>}
     */
    async getLocationWithFallback(options = {}) {
        try {
            const location = await this.getCurrentPosition(options);
            return { ...location, source: 'gps' };
        } catch (error) {
            console.warn('📍 GPS failed, checking for fallback:', error.message);
            
            // If we have a recent position (within 30 minutes), use it
            if (this.lastKnownPosition && 
                (Date.now() - this.lastKnownPosition.timestamp) < 30 * 60 * 1000) {
                console.log('📍 Using last known position as fallback');
                return { ...this.lastKnownPosition, source: 'cached' };
            }
            
            throw error;
        }
    }

    /**
     * Check if geolocation is available and user has granted permission
     * @returns {Promise<boolean>}
     */
    async checkLocationPermission() {
        if (!navigator.geolocation) {
            return false;
        }

        try {
            if (navigator.permissions) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                return permission.state === 'granted';
            }
            
            // Fallback: try to get position with short timeout
            await this.getCurrentPosition({ timeout: 1000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Request location permission from user
     * @returns {Promise<boolean>}
     */
    async requestLocationPermission() {
        try {
            await this.getCurrentPosition({ timeout: 15000 });
            return true;
        } catch (error) {
            console.error('📍 Location permission denied:', error.message);
            return false;
        }
    }

    /**
     * Format coordinates for display
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} precision - Decimal places
     * @returns {string}
     */
    formatCoordinates(lat, lng, precision = 4) {
        return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
    }

    /**
     * Calculate distance between two points in meters
     * @param {number} lat1 - First point latitude
     * @param {number} lng1 - First point longitude  
     * @param {number} lat2 - Second point latitude
     * @param {number} lng2 - Second point longitude
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    /**
     * Clean up location watching
     */
    cleanup() {
        if (this.watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }
}