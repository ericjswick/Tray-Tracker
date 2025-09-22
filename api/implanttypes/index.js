// Vercel API endpoint for implant types
const ImplantTypeService = require('../../shared_backend/services/ImplantTypeService');
const { validateImplantType, validateImplantTypeQuery } = require('../../shared_backend/validators/implantTypeValidators');
const { parsePagination, parseFilters, parseSort, createMetadata } = require('../../shared_backend/utils/responseHelpers');
const { initializeFirestore, authenticateUser } = require('../../shared_backend/utils/vercelHelpers');

let implantTypeService;

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
    if (!implantTypeService) {
      const firestore = initializeFirestore();
      implantTypeService = new ImplantTypeService(firestore);
    }

    // Authenticate user (except for OPTIONS and GET)
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
        await handleGetImplantTypes(req, res);
        break;
      case 'POST':
        await handleCreateImplantType(req, res, user);
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
    console.error('Implant Types API error:', error);
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

async function handleGetImplantTypes(req, res) {
  // Handle search requests
  if (req.query.search) {
    const result = await implantTypeService.searchImplantTypes(req.query.search, {
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    });
    return res.json(result);
  }

  // Handle stats requests
  if (req.query.stats === 'true') {
    const result = await implantTypeService.getImplantTypeStats();
    return res.json(result);
  }

  // Handle manufacturer-specific requests
  if (req.query.manufacturer) {
    const result = await implantTypeService.getImplantTypesByManufacturer(req.query.manufacturer, {
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    });
    return res.json(result);
  }

  // Validate query parameters
  const queryValidation = validateImplantTypeQuery(req.query);
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
  const sort = parseSort(req.query);

  // Handle active-only requests
  if (req.query.activeOnly === 'true') {
    const result = await implantTypeService.getActiveImplantTypes({
      ...pagination,
      ...sort
    });
    result.meta = createMetadata(result.data, pagination, filters);
    return res.json(result);
  }

  // Get all implant types
  const result = await implantTypeService.getAllImplantTypes({
    ...pagination,
    ...sort,
    filters
  });

  // Add metadata
  result.meta = createMetadata(result.data, pagination, filters);

  res.json(result);
}

async function handleCreateImplantType(req, res, user) {
  // Validate input
  const validation = validateImplantType(req.body);
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
  const result = await implantTypeService.createImplantType(req.body, userId);
  res.status(201).json(result);
}