// api/geocoding/reverse.js
// Vercel serverless function for reverse geocoding coordinates using direct Google Maps API

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
        const { latitude, longitude } = req.body;

        // Validate request
        if (latitude === undefined || longitude === undefined) {
            return sendError(res, 'Latitude and longitude are required', 400);
        }

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return sendError(res, 'Latitude and longitude must be numbers', 400);
        }

        console.log(`🔄 [Vercel] Reverse geocoding request for coordinates: ${latitude}, ${longitude}`);

        // Get Google Maps API key
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!googleMapsApiKey) {
            return sendError(res, 'Google Maps API key not configured', 500);
        }

        // Call Google Maps Geocoding API directly for reverse geocoding
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapsApiKey}`;
        
        const response = await fetch(geocodeUrl);
        
        if (!response.ok) {
            return sendError(res, `Google Maps API HTTP error: ${response.status}`, 500);
        }

        const data = await response.json();

        // Check API response status
        if (data.status !== 'OK') {
            console.warn(`[Vercel] Google Maps API error: ${data.status}`, data.error_message);
            return sendError(res, `Reverse geocoding failed: ${data.status}`, 400, data.status);
        }

        // Extract the best result
        if (data.results && data.results.length > 0) {
            const result = data.results[0];

            console.log(`✅ [Vercel] Reverse geocoding successful: "${result.formatted_address}"`);

            const reverseResult = {
                latitude: latitude,
                longitude: longitude,
                formattedAddress: result.formatted_address,
                placeId: result.place_id,
                addressComponents: result.address_components,
                locationType: result.geometry.location_type
            };

            return sendSuccess(res, reverseResult, 'Coordinates reverse geocoded successfully');
        } else {
            return sendError(res, 'No reverse geocoding results returned', 404, 'NO_RESULTS');
        }

    } catch (error) {
        console.error('[Vercel] Reverse geocoding endpoint error:', error);
        return sendError(res, 'Internal server error during reverse geocoding', 500);
    }
}