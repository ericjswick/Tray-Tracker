// shared_backend/services/GeocodingService.js
// Shared geocoding service for both Express and Vercel

class GeocodingService {
    constructor() {
        this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    }

    /**
     * Geocode an address to get latitude/longitude coordinates
     * @param {string} address - The address to geocode
     * @returns {Promise<Object>} - Geocoding result with lat/lng and formatted address
     */
    async geocodeAddress(address) {
        if (!this.googleMapsApiKey) {
            throw new Error('Google Maps API key not configured');
        }

        if (!address || typeof address !== 'string' || address.trim().length === 0) {
            throw new Error('Valid address is required');
        }

        const trimmedAddress = address.trim();
        
        try {
            // Build the geocoding URL
            const url = new URL(this.baseUrl);
            url.searchParams.append('address', trimmedAddress);
            url.searchParams.append('key', this.googleMapsApiKey);

            console.log(`🔍 Geocoding address: "${trimmedAddress}"`);

            // Make the API request
            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`Google Maps API HTTP error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Check if the API returned an error
            if (data.status !== 'OK') {
                console.warn(`Google Maps API error: ${data.status}`, data.error_message);
                
                // Handle different error types
                switch (data.status) {
                    case 'ZERO_RESULTS':
                        return {
                            success: false,
                            error: 'No results found for the provided address',
                            errorCode: 'ZERO_RESULTS'
                        };
                    case 'OVER_QUERY_LIMIT':
                        return {
                            success: false,
                            error: 'API quota exceeded',
                            errorCode: 'OVER_QUERY_LIMIT'
                        };
                    case 'REQUEST_DENIED':
                        return {
                            success: false,
                            error: 'API request denied - check API key',
                            errorCode: 'REQUEST_DENIED'
                        };
                    case 'INVALID_REQUEST':
                        return {
                            success: false,
                            error: 'Invalid request parameters',
                            errorCode: 'INVALID_REQUEST'
                        };
                    default:
                        return {
                            success: false,
                            error: `Geocoding failed: ${data.status}`,
                            errorCode: data.status
                        };
                }
            }

            // Extract the best result (first result is usually most relevant)
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                const location = result.geometry.location;

                console.log(`✅ Geocoded "${trimmedAddress}" to: ${location.lat}, ${location.lng}`);

                return {
                    success: true,
                    address: trimmedAddress,
                    formattedAddress: result.formatted_address,
                    latitude: location.lat,
                    longitude: location.lng,
                    placeId: result.place_id,
                    addressComponents: result.address_components,
                    locationType: result.geometry.location_type,
                    viewport: result.geometry.viewport,
                    bounds: result.geometry.bounds,
                    partialMatch: result.partial_match || false
                };
            } else {
                return {
                    success: false,
                    error: 'No geocoding results returned',
                    errorCode: 'NO_RESULTS'
                };
            }

        } catch (error) {
            console.error('Geocoding error:', error);
            
            return {
                success: false,
                error: `Geocoding failed: ${error.message}`,
                errorCode: 'NETWORK_ERROR'
            };
        }
    }

    /**
     * Reverse geocode coordinates to get an address
     * @param {number} latitude - Latitude coordinate
     * @param {number} longitude - Longitude coordinate
     * @returns {Promise<Object>} - Reverse geocoding result with address
     */
    async reverseGeocode(latitude, longitude) {
        if (!this.googleMapsApiKey) {
            throw new Error('Google Maps API key not configured');
        }

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            throw new Error('Valid latitude and longitude coordinates are required');
        }

        if (latitude < -90 || latitude > 90) {
            throw new Error('Latitude must be between -90 and 90 degrees');
        }

        if (longitude < -180 || longitude > 180) {
            throw new Error('Longitude must be between -180 and 180 degrees');
        }

        try {
            // Build the reverse geocoding URL
            const url = new URL(this.baseUrl);
            url.searchParams.append('latlng', `${latitude},${longitude}`);
            url.searchParams.append('key', this.googleMapsApiKey);

            console.log(`🔄 Reverse geocoding coordinates: ${latitude}, ${longitude}`);

            // Make the API request
            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`Google Maps API HTTP error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Check if the API returned an error
            if (data.status !== 'OK') {
                console.warn(`Google Maps API error: ${data.status}`, data.error_message);
                return {
                    success: false,
                    error: `Reverse geocoding failed: ${data.status}`,
                    errorCode: data.status
                };
            }

            // Extract the best result
            if (data.results && data.results.length > 0) {
                const result = data.results[0];

                console.log(`✅ Reverse geocoded ${latitude}, ${longitude} to: "${result.formatted_address}"`);

                return {
                    success: true,
                    latitude: latitude,
                    longitude: longitude,
                    formattedAddress: result.formatted_address,
                    placeId: result.place_id,
                    addressComponents: result.address_components,
                    locationType: result.geometry.location_type
                };
            } else {
                return {
                    success: false,
                    error: 'No reverse geocoding results returned',
                    errorCode: 'NO_RESULTS'
                };
            }

        } catch (error) {
            console.error('Reverse geocoding error:', error);
            
            return {
                success: false,
                error: `Reverse geocoding failed: ${error.message}`,
                errorCode: 'NETWORK_ERROR'
            };
        }
    }

    /**
     * Validate and standardize an address using geocoding
     * @param {string} address - The address to validate
     * @returns {Promise<Object>} - Validation result with standardized address
     */
    async validateAddress(address) {
        const geocodeResult = await this.geocodeAddress(address);
        
        if (!geocodeResult.success) {
            return geocodeResult;
        }

        return {
            success: true,
            isValid: true,
            originalAddress: address,
            standardizedAddress: geocodeResult.formattedAddress,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            confidence: geocodeResult.partialMatch ? 'partial' : 'high',
            addressComponents: geocodeResult.addressComponents
        };
    }
}

module.exports = GeocodingService;