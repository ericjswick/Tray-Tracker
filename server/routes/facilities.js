const express = require('express');
const router = express.Router();
const { FacilityService } = require('../shared_backend/services/FacilityService');
const debugLogger = require('../utils/debugLogger');

// Initialize facility service
let facilityService;

// Middleware to initialize service with Firestore instance
router.use((req, res, next) => {
  if (!facilityService && req.firestore) {
    facilityService = new FacilityService(req.firestore);
    debugLogger.debug('FacilityService initialized', { hasFirestore: !!req.firestore }, 'facilities-api');
  }
  next();
});

// GET /api/facilities - Get all facilities
router.get('/', async (req, res) => {
  try {
    debugLogger.debug('Getting all facilities', { 
      ip: req.ip,
      query: req.query 
    }, 'facilities-api');
    
    if (!facilityService) {
      debugLogger.error('FacilityService not initialized', { hasFirestore: !!req.firestore }, 'facilities-api');
      return res.status(500).json({
        success: false,
        error: {
          message: 'Service not initialized',
          statusCode: 500
        }
      });
    }

    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      sortBy: req.query.sortBy || 'account_name',
      sortOrder: req.query.sortOrder || 'asc',
      filters: {
        active: req.query.active !== undefined ? req.query.active === 'true' : true,
        type: req.query.type,
        specialty: req.query.specialty,
        territory: req.query.territory
      }
    };

    const facilities = await facilityService.getAllFacilities(options);
    
    debugLogger.debug('Facilities retrieved successfully', { 
      count: facilities.data.length,
      ip: req.ip 
    }, 'facilities-api');
    
    res.json({
      success: true,
      data: facilities.data,
      meta: {
        count: facilities.data.length,
        timestamp: new Date().toISOString(),
        filters: options.filters
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get facilities', error, 'facilities-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve facilities',
        details: error.message,
        statusCode: 500
      }
    });
  }
});

// GET /api/facilities/search - Search facilities
router.get('/search', async (req, res) => {
  try {
    debugLogger.debug('Searching facilities', { 
      query: req.query,
      ip: req.ip 
    }, 'facilities-api');
    
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const searchTerm = req.query.q || req.query.search || '';
    const filters = {
      active: req.query.active !== undefined ? req.query.active === 'true' : true,
      type: req.query.type,
      specialty: req.query.specialty,
      territory: req.query.territory
    };

    const results = await facilityService.searchFacilities(searchTerm, filters);
    
    res.json({
      success: true,
      data: results.data,
      meta: {
        count: results.data.length,
        searchTerm,
        filters,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to search facilities', error, 'facilities-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search facilities',
        details: error.message,
        statusCode: 500
      }
    });
  }
});

// GET /api/facilities/stats - Get facility statistics
router.get('/stats', async (req, res) => {
  try {
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const stats = await facilityService.getStats();
    
    res.json({
      success: true,
      data: stats.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get facility stats', error, 'facilities-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get facility statistics',
        details: error.message,
        statusCode: 500
      }
    });
  }
});

// GET /api/facilities/:id - Get facility by ID
router.get('/:id', async (req, res) => {
  try {
    debugLogger.debug('Getting facility by ID', { 
      facilityId: req.params.id,
      ip: req.ip 
    }, 'facilities-api');
    
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const facility = await facilityService.getFacility(req.params.id);
    
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Facility not found',
          statusCode: 404
        }
      });
    }

    res.json({
      success: true,
      data: facility.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to get facility', error, 'facilities-api');
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        message: error.message,
        statusCode
      }
    });
  }
});

// POST /api/facilities - Create new facility
router.post('/', async (req, res) => {
  try {
    debugLogger.debug('Creating new facility', { 
      data: { name: req.body.name, type: req.body.type },
      ip: req.ip 
    }, 'facilities-api');
    
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const userId = req.user?.uid || 'system'; // Assuming auth middleware sets req.user
    const facility = await facilityService.createFacility(req.body, userId);
    
    debugLogger.debug('Facility created successfully', { 
      facilityId: facility.data.id,
      name: facility.data.name,
      ip: req.ip 
    }, 'facilities-api');
    
    res.status(201).json({
      success: true,
      data: facility.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to create facility', error, 'facilities-api');
    res.status(400).json({
      success: false,
      error: {
        message: error.message,
        statusCode: 400
      }
    });
  }
});

// PUT /api/facilities/:id - Update facility
router.put('/:id', async (req, res) => {
  try {
    debugLogger.debug('Updating facility', { 
      facilityId: req.params.id,
      updates: Object.keys(req.body),
      ip: req.ip 
    }, 'facilities-api');
    
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const userId = req.user?.uid || 'system';
    const facility = await facilityService.updateFacility(req.params.id, req.body, userId);
    
    res.json({
      success: true,
      data: facility.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to update facility', error, 'facilities-api');
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      error: {
        message: error.message,
        statusCode
      }
    });
  }
});

// DELETE /api/facilities/:id - Delete facility
router.delete('/:id', async (req, res) => {
  try {
    debugLogger.debug('Deleting facility', { 
      facilityId: req.params.id,
      ip: req.ip 
    }, 'facilities-api');
    
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const userId = req.user?.uid || 'system';
    const result = await facilityService.deleteFacility(req.params.id, userId);
    
    res.json({
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to delete facility', error, 'facilities-api');
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        message: error.message,
        statusCode
      }
    });
  }
});

// POST /api/facilities/initialize - Initialize default facilities
router.post('/initialize', async (req, res) => {
  try {
    debugLogger.debug('Initializing default facilities', { ip: req.ip }, 'facilities-api');
    
    if (!facilityService) {
      return res.status(500).json({
        success: false,
        error: { message: 'Service not initialized', statusCode: 500 }
      });
    }

    const result = await facilityService.initializeDefaults('system');
    
    debugLogger.debug('Default facilities initialized', { 
      created: result.data.created.length,
      ip: req.ip 
    }, 'facilities-api');
    
    res.json({
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    debugLogger.error('Failed to initialize default facilities', error, 'facilities-api');
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to initialize default facilities',
        details: error.message,
        statusCode: 500
      }
    });
  }
});

module.exports = router;