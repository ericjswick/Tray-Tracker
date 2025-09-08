const express = require('express');
const router = express.Router();
const CaseTypeService = require('../shared_backend/services/CaseTypeService');
const debugLogger = require('../utils/debugLogger');

// Initialize case type service
let caseTypeService;

// Middleware to initialize service with Firestore instance
router.use((req, res, next) => {
  if (!caseTypeService && req.firestore) {
    caseTypeService = new CaseTypeService(req.firestore);
    debugLogger.debug('CaseTypeService initialized', { hasFirestore: !!req.firestore }, 'case-types-api');
  }
  next();
});

// GET /api/case-types - Get all case types
router.get('/', async (req, res) => {
  try {
    debugLogger.debug('Getting all case types', { ip: req.ip }, 'case-types-api');
    
    if (!caseTypeService) {
      debugLogger.error('CaseTypeService not initialized', { hasFirestore: !!req.firestore }, 'case-types-api');
      return res.status(500).json({
        success: false,
        error: {
          message: 'Service not initialized',
          statusCode: 500
        }
      });
    }

    const caseTypes = await caseTypeService.getAllCaseTypes();
    
    debugLogger.debug('Case types retrieved successfully', { 
      count: caseTypes.length,
      ip: req.ip 
    }, 'case-types-api');
    
    res.json({
      success: true,
      data: caseTypes,
      meta: {
        count: caseTypes.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get case types', error, 'case-types-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve case types',
        details: error.message,
        statusCode: 500
      }
    });
  }
});

router.get('/:id', async (req, res) => {
  res.json({
    success: true,
    data: { id: req.params.id },
    message: 'Case type by ID endpoint - to be implemented'
  });
});

router.post('/', async (req, res) => {
  res.json({
    success: true,
    data: { created: true },
    message: 'Create case type endpoint - to be implemented'
  });
});

router.put('/:id', async (req, res) => {
  res.json({
    success: true,
    data: { id: req.params.id, updated: true },
    message: 'Update case type endpoint - to be implemented'
  });
});

router.delete('/:id', async (req, res) => {
  res.json({
    success: true,
    data: { id: req.params.id, deleted: true },
    message: 'Delete case type endpoint - to be implemented'
  });
});

// POST /api/case-types/initialize - Initialize default case types
router.post('/initialize', async (req, res) => {
  try {
    debugLogger.debug('Initializing default case types', { ip: req.ip }, 'case-types-api');
    
    if (!caseTypeService) {
      debugLogger.error('CaseTypeService not initialized', { hasFirestore: !!req.firestore }, 'case-types-api');
      return res.status(500).json({
        success: false,
        error: {
          message: 'Service not initialized',
          statusCode: 500
        }
      });
    }

    const result = await caseTypeService.initializeDefaults('system');
    
    debugLogger.debug('Default case types initialized', { 
      created: result.data.created.length,
      ip: req.ip 
    }, 'case-types-api');
    
    res.json({
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to initialize default case types', error, 'case-types-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to initialize default case types',
        details: error.message,
        statusCode: 500
      }
    });
  }
});

module.exports = router;