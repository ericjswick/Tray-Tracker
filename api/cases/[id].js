// Vercel API endpoint for specific case operations
const CaseService = require('../../shared_backend/services/CaseService');
const { initializeFirestore, authenticateUser } = require('../../shared_backend/utils/vercelHelpers');

let caseService;

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
    if (!caseService) {
      const firestore = initializeFirestore();
      caseService = new CaseService(firestore);
    }

    // Get case ID from query
    const { id: caseId } = req.query;
    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Case ID is required',
          statusCode: 400
        }
      });
    }

    // Authenticate user for write operations
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
        await handleGetCase(req, res, caseId);
        break;
      case 'PUT':
        await handleUpdateCase(req, res, caseId, user);
        break;
      case 'DELETE':
        await handleDeleteCase(req, res, caseId, user);
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
    console.error('Case API error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json(error.success === false ? error : {
      success: false,
      error: {
        message: 'Internal server error',
        details: error.message,
        statusCode
      }
    });
  }
}

async function handleGetCase(req, res, caseId) {
  const result = await caseService.getCaseById(caseId);
  res.json(result);
}

async function handleUpdateCase(req, res, caseId, user) {
  const userId = user?.uid || user?.id;
  const result = await caseService.updateCase(caseId, req.body, userId);
  res.json(result);
}

async function handleDeleteCase(req, res, caseId, user) {
  const userId = user?.uid || user?.id;
  const result = await caseService.deleteCase(caseId, userId);
  res.json(result);
}