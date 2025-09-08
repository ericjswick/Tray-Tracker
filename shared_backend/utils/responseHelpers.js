// Standard API response format
const formatResponse = (data, message = 'Success', meta = {}) => {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
};

// Standard API error format
const formatError = (message, details = null, statusCode = 500) => {
  return {
    success: false,
    error: {
      message,
      details,
      statusCode,
      timestamp: new Date().toISOString()
    }
  };
};

// Handle and format errors
const handleError = (message, error) => {
  console.error(`${message}:`, error);
  
  // Extract meaningful error information
  let details = null;
  let statusCode = 500;

  if (error.message) {
    details = error.message;
  }

  // Handle specific Firebase errors
  if (error.code) {
    switch (error.code) {
      case 'not-found':
        statusCode = 404;
        break;
      case 'permission-denied':
        statusCode = 403;
        break;
      case 'unauthenticated':
        statusCode = 401;
        break;
      case 'invalid-argument':
        statusCode = 400;
        break;
      case 'already-exists':
        statusCode = 409;
        break;
      default:
        statusCode = 500;
    }
  }

  // Handle validation errors
  if (message.includes('Validation failed')) {
    statusCode = 400;
  }

  const formattedError = formatError(message, details, statusCode);
  formattedError.statusCode = statusCode; // Add statusCode at root level for middleware
  
  return formattedError;
};

// Pagination helpers
const parsePagination = (query) => {
  const limit = query.limit ? parseInt(query.limit, 10) : 50;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;
  const page = query.page ? parseInt(query.page, 10) : Math.floor(offset / limit) + 1;

  return {
    limit: Math.min(Math.max(limit, 1), 1000), // Between 1 and 1000
    offset: Math.max(offset, 0),
    page: Math.max(page, 1)
  };
};

// Date range helpers
const parseDateRange = (query) => {
  let startDate = null;
  let endDate = null;

  if (query.startDate) {
    startDate = new Date(query.startDate);
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date format');
    }
  }

  if (query.endDate) {
    endDate = new Date(query.endDate);
    if (isNaN(endDate.getTime())) {
      throw new Error('Invalid end date format');
    }
    // Set to end of day
    endDate.setHours(23, 59, 59, 999);
  }

  if (startDate && endDate && startDate > endDate) {
    throw new Error('Start date cannot be after end date');
  }

  return { startDate, endDate };
};

// Filter helpers
const parseFilters = (query) => {
  const filters = {};

  if (query.surgeonId) filters.surgeonId = query.surgeonId;
  if (query.facilityId) filters.facilityId = query.facilityId;
  if (query.caseTypeId) filters.caseTypeId = query.caseTypeId;
  if (query.status) filters.status = query.status;
  if (query.priority) filters.priority = query.priority;

  return filters;
};

// Sort helpers
const parseSort = (query) => {
  const defaultSort = { field: 'scheduledDate', direction: 'desc' };
  
  if (!query.sortBy) return defaultSort;

  const validFields = ['scheduledDate', 'createdAt', 'lastModified', 'patientName', 'status'];
  const validDirections = ['asc', 'desc'];

  const field = validFields.includes(query.sortBy) ? query.sortBy : defaultSort.field;
  const direction = validDirections.includes(query.sortDirection) ? query.sortDirection : defaultSort.direction;

  return { field, direction };
};

// Response metadata helpers
const createMetadata = (data, pagination, filters = {}) => {
  const meta = {
    count: Array.isArray(data) ? data.length : 1,
    timestamp: new Date().toISOString()
  };

  if (pagination) {
    meta.pagination = {
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: Array.isArray(data) && data.length === pagination.limit
    };
  }

  if (Object.keys(filters).length > 0) {
    meta.filters = filters;
  }

  return meta;
};

module.exports = {
  formatResponse,
  formatError,
  handleError,
  parsePagination,
  parseDateRange,
  parseFilters,
  parseSort,
  createMetadata
};