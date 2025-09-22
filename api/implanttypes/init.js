// Vercel API endpoint for initializing default implant types
const ImplantTypeService = require('../../shared_backend/services/ImplantTypeService');
const { initializeFirestore, authenticateUser } = require('../../shared_backend/utils/vercelHelpers');

let implantTypeService;

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: {
          message: `Method ${req.method} not allowed`,
          statusCode: 405
        }
      });
    }

    // Initialize Firestore if not already done
    if (!implantTypeService) {
      const firestore = initializeFirestore();
      implantTypeService = new ImplantTypeService(firestore);
    }

    // Authenticate user
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    const userId = user?.uid || user?.id;
    const result = await implantTypeService.initializeDefaults(userId);

    res.status(200).json(result);
  } catch (error) {
    console.error('Initialize Implant Types API error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        details: error.message,
        statusCode: 500
      }
    });
  }
}