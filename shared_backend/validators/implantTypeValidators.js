const validateImplantType = (implantTypeData) => {
  const errors = [];

  // Required fields
  if (!implantTypeData.name?.trim()) {
    errors.push('Name is required');
  }

  // Field length validations
  if (implantTypeData.name && implantTypeData.name.length > 100) {
    errors.push('Name must be 100 characters or less');
  }
  if (implantTypeData.description && implantTypeData.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }
  if (implantTypeData.manufacturer && implantTypeData.manufacturer.length > 100) {
    errors.push('Manufacturer must be 100 characters or less');
  }
  if (implantTypeData.partNumber && implantTypeData.partNumber.length > 50) {
    errors.push('Part number must be 50 characters or less');
  }

  // Status validation
  if (implantTypeData.status && !['active', 'inactive'].includes(implantTypeData.status)) {
    errors.push('Status must be either "active" or "inactive"');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateImplantTypeUpdate = (updateData) => {
  const errors = [];

  // Only validate provided fields for updates
  if (updateData.name !== undefined) {
    if (!updateData.name?.trim()) {
      errors.push('Name cannot be empty');
    }
    if (updateData.name && updateData.name.length > 100) {
      errors.push('Name must be 100 characters or less');
    }
  }

  if (updateData.description !== undefined && updateData.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }
  if (updateData.manufacturer !== undefined && updateData.manufacturer.length > 100) {
    errors.push('Manufacturer must be 100 characters or less');
  }
  if (updateData.partNumber !== undefined && updateData.partNumber.length > 50) {
    errors.push('Part number must be 50 characters or less');
  }

  // Status validation
  if (updateData.status !== undefined && !['active', 'inactive'].includes(updateData.status)) {
    errors.push('Status must be either "active" or "inactive"');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateImplantTypeQuery = (queryParams) => {
  const errors = [];

  // Pagination validation
  if (queryParams.limit && (isNaN(queryParams.limit) || queryParams.limit < 1 || queryParams.limit > 1000)) {
    errors.push('Limit must be a number between 1 and 1000');
  }
  if (queryParams.offset && (isNaN(queryParams.offset) || queryParams.offset < 0)) {
    errors.push('Offset must be a non-negative number');
  }

  // Sorting validation
  if (queryParams.sortBy && !['name', 'manufacturer', 'partNumber', 'status', 'createdAt', 'updatedAt'].includes(queryParams.sortBy)) {
    errors.push('Invalid sortBy field');
  }
  if (queryParams.sortOrder && !['asc', 'desc'].includes(queryParams.sortOrder)) {
    errors.push('Sort order must be either "asc" or "desc"');
  }

  // Status validation
  if (queryParams.status && !['active', 'inactive'].includes(queryParams.status)) {
    errors.push('Invalid status filter');
  }

  // Search term validation
  if (queryParams.search && queryParams.search.length > 100) {
    errors.push('Search term must be 100 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateImplantType,
  validateImplantTypeUpdate,
  validateImplantTypeQuery
};