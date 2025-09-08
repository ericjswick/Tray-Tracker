const { formatError } = require('../shared_backend/utils/responseHelpers');

const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);

  // If error is already formatted, use it
  if (err.success === false) {
    return res.status(err.statusCode || 500).json(err);
  }

  // Handle different types of errors
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;

  if (err.message) {
    details = err.message;
  }

  // Firebase errors
  if (err.code) {
    switch (err.code) {
      case 'not-found':
        statusCode = 404;
        message = 'Resource not found';
        break;
      case 'permission-denied':
        statusCode = 403;
        message = 'Permission denied';
        break;
      case 'unauthenticated':
        statusCode = 401;
        message = 'Authentication required';
        break;
      case 'invalid-argument':
        statusCode = 400;
        message = 'Invalid request data';
        break;
      case 'already-exists':
        statusCode = 409;
        message = 'Resource already exists';
        break;
    }
  }

  // Validation errors
  if (err.message && err.message.includes('Validation failed')) {
    statusCode = 400;
    message = 'Validation failed';
  }

  const errorResponse = formatError(message, details, statusCode);
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;