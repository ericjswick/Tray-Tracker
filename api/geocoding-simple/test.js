// api/geocoding-simple/test.js
// Simple test endpoint for Vercel deployment

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: `Method ${req.method} not allowed. Use GET.`
        });
    }

    try {
        return res.json({
            success: true,
            message: 'Geocoding service test endpoint working',
            apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Simple geocoding test error:', error);
        return res.status(500).json({
            success: false,
            error: 'Simple geocoding test failed'
        });
    }
}