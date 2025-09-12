// server/routes/geocoding-simple.js
// Simplified geocoding routes using real Google Maps API

const express = require('express');
const GeocodingService = require('../shared_backend/services/GeocodingService');

const router = express.Router();
const geocodingService = new GeocodingService();

/**
 * GET /api/geocoding-simple/test
 * Simple test endpoint
 */
router.get('/test', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Geocoding service test endpoint working',
            apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Simple geocoding test error:', error);
        res.status(500).json({
            success: false,
            error: 'Simple geocoding test failed'
        });
    }
});

/**
 * POST /api/geocoding-simple/address
 * Real address geocoding endpoint using Google Maps API
 */
router.post('/address', async (req, res) => {
    try {
        const { address } = req.body;

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

        console.log(`📍 [Simple] Geocoding request for address: "${address}"`);

        // Call the real Google Maps geocoding service
        const result = await geocodingService.geocodeAddress(address);

        if (result.success) {
            console.log(`✅ [Simple] Geocoding successful: ${result.latitude}, ${result.longitude}`);
            
            // Return in the same format as before, but with real data
            res.json({
                success: true,
                data: {
                    address: result.address,
                    formattedAddress: result.formattedAddress,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    placeId: result.placeId,
                    addressComponents: result.addressComponents,
                    locationType: result.locationType,
                    partialMatch: result.partialMatch
                },
                message: 'Address geocoded successfully'
            });
        } else {
            console.log(`❌ [Simple] Geocoding failed: ${result.error}`);
            res.status(result.errorCode === 'ZERO_RESULTS' ? 404 : 400).json({
                success: false,
                error: result.error,
                errorCode: result.errorCode
            });
        }

    } catch (error) {
        console.error('[Simple] Geocoding address error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during geocoding'
        });
    }
});

module.exports = router;