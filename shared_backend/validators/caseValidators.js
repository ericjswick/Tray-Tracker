const validateCase = (caseData) => {
  const errors = [];

  // Required fields
  if (!caseData.patientName?.trim()) {
    errors.push('Patient name is required');
  }
  if (!caseData.surgeonId?.trim()) {
    errors.push('Surgeon ID is required');
  }
  if (!caseData.facilityId?.trim()) {
    errors.push('Facility ID is required');
  }
  if (!caseData.caseTypeId?.trim()) {
    errors.push('Case type ID is required');
  }
  if (!caseData.scheduledDate) {
    errors.push('Scheduled date is required');
  }

  // Optional field validations
  if (caseData.status && !['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'].includes(caseData.status)) {
    errors.push('Invalid status value');
  }
  if (caseData.priority && !['normal', 'urgent', 'elective'].includes(caseData.priority)) {
    errors.push('Invalid priority value');
  }
  if (caseData.estimatedDuration && (caseData.estimatedDuration < 15 || caseData.estimatedDuration > 600)) {
    errors.push('Estimated duration must be between 15 and 600 minutes');
  }

  // Date validation
  if (caseData.scheduledDate) {
    const scheduledDate = new Date(caseData.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      errors.push('Invalid scheduled date format');
    }
  }

  // Time validation (if provided)
  if (caseData.scheduledTime) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(caseData.scheduledTime)) {
      errors.push('Invalid scheduled time format (expected HH:MM)');
    }
  }

  // Tray requirements validation
  if (caseData.trayRequirements && Array.isArray(caseData.trayRequirements)) {
    caseData.trayRequirements.forEach((req, index) => {
      if (!req.trayId) {
        errors.push(`Tray requirement ${index + 1} missing tray ID`);
      }
      if (!req.trayName) {
        errors.push(`Tray requirement ${index + 1} missing tray name`);
      }
    });
  }

  // Patient name length validation
  if (caseData.patientName && caseData.patientName.length > 100) {
    errors.push('Patient name must be 100 characters or less');
  }

  // Notes length validation
  if (caseData.notes && caseData.notes.length > 1000) {
    errors.push('Notes must be 1000 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateCaseUpdate = (updateData) => {
  const errors = [];

  // Only validate provided fields for updates
  if (updateData.patientName !== undefined) {
    if (!updateData.patientName?.trim()) {
      errors.push('Patient name cannot be empty');
    }
    if (updateData.patientName && updateData.patientName.length > 100) {
      errors.push('Patient name must be 100 characters or less');
    }
  }

  if (updateData.surgeonId !== undefined && !updateData.surgeonId?.trim()) {
    errors.push('Surgeon ID cannot be empty');
  }
  if (updateData.facilityId !== undefined && !updateData.facilityId?.trim()) {
    errors.push('Facility ID cannot be empty');
  }
  if (updateData.caseTypeId !== undefined && !updateData.caseTypeId?.trim()) {
    errors.push('Case type ID cannot be empty');
  }

  if (updateData.status !== undefined && !['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'].includes(updateData.status)) {
    errors.push('Invalid status value');
  }
  if (updateData.priority !== undefined && !['normal', 'urgent', 'elective'].includes(updateData.priority)) {
    errors.push('Invalid priority value');
  }
  if (updateData.estimatedDuration !== undefined && (updateData.estimatedDuration < 15 || updateData.estimatedDuration > 600)) {
    errors.push('Estimated duration must be between 15 and 600 minutes');
  }

  // Date validation
  if (updateData.scheduledDate !== undefined) {
    const scheduledDate = new Date(updateData.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      errors.push('Invalid scheduled date format');
    }
  }

  // Time validation
  if (updateData.scheduledTime !== undefined) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(updateData.scheduledTime)) {
      errors.push('Invalid scheduled time format (expected HH:MM)');
    }
  }

  // Notes validation
  if (updateData.notes !== undefined && updateData.notes.length > 1000) {
    errors.push('Notes must be 1000 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateCaseQuery = (queryParams) => {
  const errors = [];

  // Date range validation
  if (queryParams.startDate || queryParams.endDate) {
    if (queryParams.startDate && isNaN(new Date(queryParams.startDate).getTime())) {
      errors.push('Invalid start date format');
    }
    if (queryParams.endDate && isNaN(new Date(queryParams.endDate).getTime())) {
      errors.push('Invalid end date format');
    }
    if (queryParams.startDate && queryParams.endDate) {
      const start = new Date(queryParams.startDate);
      const end = new Date(queryParams.endDate);
      if (start > end) {
        errors.push('Start date cannot be after end date');
      }
    }
  }

  // Pagination validation
  if (queryParams.limit && (isNaN(queryParams.limit) || queryParams.limit < 1 || queryParams.limit > 1000)) {
    errors.push('Limit must be a number between 1 and 1000');
  }
  if (queryParams.offset && (isNaN(queryParams.offset) || queryParams.offset < 0)) {
    errors.push('Offset must be a non-negative number');
  }

  // Status validation
  if (queryParams.status && !['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'].includes(queryParams.status)) {
    errors.push('Invalid status filter');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateCase,
  validateCaseUpdate,
  validateCaseQuery
};