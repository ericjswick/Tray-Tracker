// api/geocoding/address.js
// Vercel serverless function for geocoding addresses using direct Google Maps API

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

        console.log(`📍 [Vercel] Geocoding request for address: "${address}"`);

        // Get Google Maps API key
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!googleMapsApiKey) {
            return sendError(res, 'Google Maps API key not configured', 500);
        }

        // Call Google Maps Geocoding API directly
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
        
        const response = await fetch(geocodeUrl);
        
        if (!response.ok) {
            return sendError(res, `Google Maps API HTTP error: ${response.status}`, 500);
        }

        const data = await response.json();

        // Check API response status
        if (data.status !== 'OK') {
            console.warn(`[Vercel] Google Maps API error: ${data.status}`, data.error_message);
            
            switch (data.status) {
                case 'ZERO_RESULTS':
                    return sendError(res, 'No results found for the provided address', 404, 'ZERO_RESULTS');
                case 'OVER_QUERY_LIMIT':
                    return sendError(res, 'API quota exceeded', 429, 'OVER_QUERY_LIMIT');
                case 'REQUEST_DENIED':
                    return sendError(res, 'API request denied - check API key', 403, 'REQUEST_DENIED');
                case 'INVALID_REQUEST':
                    return sendError(res, 'Invalid request parameters', 400, 'INVALID_REQUEST');
                default:
                    return sendError(res, `Geocoding failed: ${data.status}`, 400, data.status);
            }
        }

        // Extract the best result
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const location = result.geometry.location;

            console.log(`✅ [Vercel] Geocoding successful: ${location.lat}, ${location.lng}`);

            const geocodeResult = {
                address: address,
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

            return sendSuccess(res, geocodeResult, 'Address geocoded successfully');
        } else {
            return sendError(res, 'No geocoding results returned', 404, 'NO_RESULTS');
        }

    } catch (error) {
        console.error('[Vercel] Geocoding endpoint error:', error);
        return sendError(res, 'Internal server error during geocoding', 500);
    }
}