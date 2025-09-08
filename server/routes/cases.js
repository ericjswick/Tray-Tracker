const express = require('express');
const router = express.Router();
const CaseService = require('../shared_backend/services/CaseService');
const { validateCaseQuery } = require('../shared_backend/validators/caseValidators');
const { parsePagination, parseDateRange, parseFilters, parseSort, createMetadata } = require('../shared_backend/utils/responseHelpers');

// Initialize case service (Firestore will be injected via middleware)
let caseService;

// Middleware to initialize service with Firestore instance
router.use((req, res, next) => {
  if (!caseService && req.firestore) {
    caseService = new CaseService(req.firestore);
  }
  next();
});

// GET /api/cases - Get all cases with filtering, pagination, and sorting
router.get('/', async (req, res, next) => {
  try {
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
    const sort = parseSort(req.query);

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
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:id - Get specific case
router.get('/:id', async (req, res, next) => {
  try {
    const result = await caseService.getCaseById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/cases - Create new case
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const result = await caseService.createCase(req.body, userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// PUT /api/cases/:id - Update case
router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const result = await caseService.updateCase(req.params.id, req.body, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cases/:id - Delete case (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const result = await caseService.deleteCase(req.params.id, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/by-surgeon/:surgeonId - Get cases by surgeon
router.get('/by-surgeon/:surgeonId', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const result = await caseService.getCasesBySurgeon(req.params.surgeonId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/by-facility/:facilityId - Get cases by facility
router.get('/by-facility/:facilityId', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const result = await caseService.getCasesByFacility(req.params.facilityId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/by-date-range - Get cases by date range
router.get('/by-date-range', async (req, res, next) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Both startDate and endDate are required',
          statusCode: 400
        }
      });
    }

    const filters = parseFilters(req.query);
    const result = await caseService.getCasesByDateRange(startDate, endDate, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;