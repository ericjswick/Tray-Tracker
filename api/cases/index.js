// Vercel API endpoint for cases
const CaseService = require('../../shared_backend/services/CaseService');
const { validateCaseQuery } = require('../../shared_backend/validators/caseValidators');
const { parsePagination, parseDateRange, parseFilters, parseSort, createMetadata } = require('../../shared_backend/utils/responseHelpers');
const { initializeFirestore, authenticateUser } = require('../../shared_backend/utils/vercelHelpers');

let caseService;

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Initialize Firestore if not already done
    if (!caseService) {
      const firestore = initializeFirestore();
      caseService = new CaseService(firestore);
    }

    // Authenticate user (except for OPTIONS)
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
        await handleGetCases(req, res);
        break;
      case 'POST':
        await handleCreateCase(req, res, user);
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
    console.error('Cases API error:', error);
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

async function handleGetCases(req, res) {
  // Validate query parameters
  const queryValidation = validateCaseQuery(req.query);
  if (!queryValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid query parameters',
        details: queryValidation.errors,
        statusCode: 400
      }
    });
  }

  // Parse query parameters
  const pagination = parsePagination(req.query);
  const filters = parseFilters(req.query);
  
  // Add date range to filters if provided
  if (req.query.startDate || req.query.endDate) {
    const dateRange = parseDateRange(req.query);
    filters.startDate = dateRange.startDate;
    filters.endDate = dateRange.endDate;
  }

  // Get cases
  const result = await caseService.getAllCases(filters, pagination);
  
  // Add metadata
  result.meta = createMetadata(result.data, pagination, filters);

  res.json(result);
}

async function handleCreateCase(req, res, user) {
  const userId = user?.uid || user?.id;
  const result = await caseService.createCase(req.body, userId);
  res.status(201).json(result);
}