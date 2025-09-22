// Vercel API endpoint for individual implant type operations
const ImplantTypeService = require('../../shared_backend/services/ImplantTypeService');
const { validateImplantTypeUpdate } = require('../../shared_backend/validators/implantTypeValidators');
const { initializeFirestore, authenticateUser } = require('../../shared_backend/utils/vercelHelpers');

let implantTypeService;

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Initialize Firestore if not already done
    if (!implantTypeService) {
      const firestore = initializeFirestore();
      implantTypeService = new ImplantTypeService(firestore);
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Implant type ID is required',
          statusCode: 400
        }
      });
    }

    // Authenticate user (except for GET and OPTIONS)
    const user = await authenticateUser(req);
    if (!user && req.method !== 'GET') {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    switch (req.method) {
      case 'GET':
        await handleGetImplantType(req, res, id);
        break;
      case 'PUT':
        await handleUpdateImplantType(req, res, id, user);
        break;
      case 'DELETE':
        await handleDeleteImplantType(req, res, id, user);
        break;
      default:
        res.status(405).json({
          success: false,
          error: {
            message: `Method ${req.method} not allowed`,
            statusCode: 405
          }
        });
    }
  } catch (error) {
    console.error('Implant Type API error:', error);

    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          message: error.message,
          statusCode: 404
        }
      });
    }

    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          statusCode: 400
        }
      });
    }

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

async function handleGetImplantType(req, res, id) {
  const result = await implantTypeService.getImplantType(id);
  res.json(result);
}

async function handleUpdateImplantType(req, res, id, user) {
  // Validate input
  const validation = validateImplantTypeUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: validation.errors,
        statusCode: 400
      }
    });
  }

  const userId = user?.uid || user?.id;
  const result = await implantTypeService.updateImplantType(id, req.body, userId);
  res.json(result);
}

async function handleDeleteImplantType(req, res, id, user) {
  const userId = user?.uid || user?.id;
  const result = await implantTypeService.deleteImplantType(id, userId);
  res.json(result);
}