// api/geocoding-simple/address.js
// Vercel serverless function for geocoding addresses using direct Google Maps API
// This matches the Express route response format exactly

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
        return res.status(405).json({
            success: false,
            error: `Method ${req.method} not allowed. Use POST.`
        });
    }

    try {
        const { address } = req.body;

        // Validate request
        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required'
            });
        }

        if (typeof address !== 'string' || address.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid address string is required'
            });
        }

        console.log(`📍 [Vercel Simple] Geocoding request for address: "${address}"`);

        // Get Google Maps API key
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!googleMapsApiKey) {
            return res.status(500).json({
                success: false,
                error: 'Google Maps API key not configured'
            });
        }

        // Call Google Maps Geocoding API directly
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
        
        const response = await fetch(geocodeUrl);
        
        if (!response.ok) {
            return res.status(500).json({
                success: false,
                error: `Google Maps API HTTP error: ${response.status}`
            });
        }

        const data = await response.json();

        // Check API response status
        if (data.status !== 'OK') {
            console.warn(`[Vercel Simple] Google Maps API error: ${data.status}`, data.error_message);
            
            if (data.status === 'ZERO_RESULTS') {
                return res.status(404).json({
                    success: false,
                    error: 'No results found for the provided address',
                    errorCode: 'ZERO_RESULTS'
                });
            }
            
            return res.status(400).json({
                success: false,
                error: `Address geocoding failed: ${data.status}`,
                errorCode: data.status
            });
        }

        // Extract the best result
        if (data.results && data.results.length > 0) {
            const result = data.results[0];

            console.log(`✅ [Vercel Simple] Geocoding successful: ${result.geometry.location.lat}, ${result.geometry.location.lng}`);

            // Return in the same format as Express simple route
            return res.json({
                success: true,
                data: {
                    address: address,
                    formattedAddress: result.formatted_address,
                    latitude: result.geometry.location.lat,
                    longitude: result.geometry.location.lng,
                    placeId: result.place_id,
                    addressComponents: result.address_components,
                    locationType: result.geometry.location_type,
                    partialMatch: result.partial_match || false
                },
                message: 'Address geocoded successfully'
            });
        } else {
            return res.status(404).json({
                success: false,
                error: 'No geocoding results returned',
                errorCode: 'NO_RESULTS'
            });
        }

    } catch (error) {
        console.error('[Vercel Simple] Geocoding address error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during geocoding'
        });
    }
}