// api/geocoding/validate.js
// Vercel serverless function for address validation using direct Google Maps API

// Helper functions for responses
const sendSuccess = (res, data, message = 'Success') => {
    return res.status(200).json({
        success: true,
        data: data,
        message: message
    });
};

const sendError = (res, error, statusCode = 400, errorCode = null) => {
    return res.status(statusCode).json({
        success: false,
        error: error,
        errorCode: errorCode
    });
};

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return sendError(res, `Method ${req.method} not allowed. Use POST.`, 405);
    }

    try {
        const { address } = req.body;

        // Validate request
        if (!address) {
            return sendError(res, 'Address is required', 400);
        }

        if (typeof address !== 'string' || address.trim().length === 0) {
            return sendError(res, 'Valid address string is required', 400);
        }

        console.log(`✔️ [Vercel] Address validation request for: "${address}"`);

        // Get Google Maps API key
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!googleMapsApiKey) {
            return sendError(res, 'Google Maps API key not configured', 500);
        }

        // Call Google Maps Geocoding API directly for validation
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
        
        const response = await fetch(geocodeUrl);
        
        if (!response.ok) {
            return sendError(res, `Google Maps API HTTP error: ${response.status}`, 500);
        }

        const data = await response.json();

        // Check API response status
        if (data.status !== 'OK') {
            console.warn(`[Vercel] Google Maps API error: ${data.status}`, data.error_message);
            
            if (data.status === 'ZERO_RESULTS') {
                return sendError(res, 'No results found for the provided address', 404, 'ZERO_RESULTS');
            }
            
            return sendError(res, `Address validation failed: ${data.status}`, 400, data.status);
        }

        // Extract the best result for validation
        if (data.results && data.results.length > 0) {
            const result = data.results[0];

            console.log(`✅ [Vercel] Address validation successful: "${result.formatted_address}"`);

            const validationResult = {
                success: true,
                isValid: true,
                originalAddress: address,
                standardizedAddress: result.formatted_address,
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
                confidence: result.partial_match ? 'partial' : 'high',
                addressComponents: result.address_components,
                placeId: result.place_id,
                locationType: result.geometry.location_type
            };

            return sendSuccess(res, validationResult, 'Address validated successfully');
        } else {
            return sendError(res, 'No validation results returned', 404, 'NO_RESULTS');
        }

    } catch (error) {
        console.error('[Vercel] Address validation endpoint error:', error);
        return sendError(res, 'Internal server error during address validation', 500);
    }
}