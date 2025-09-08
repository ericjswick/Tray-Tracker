class CaseModel {
  constructor(data = {}) {
    this.patientName = data.patientName || '';
    this.surgeonId = data.surgeonId || '';
    this.facilityId = data.facilityId || '';
    this.caseTypeId = data.caseTypeId || '';
    this.scheduledDate = data.scheduledDate || '';
    this.scheduledTime = data.scheduledTime || '';
    this.estimatedDuration = data.estimatedDuration || 60;
    // Support both MyRepData format (tray_requirements) and legacy format (trayRequirements)
    this.trayRequirements = data.trayRequirements || data.tray_requirements || [];
    this.tray_requirements = data.tray_requirements || data.trayRequirements || [];
    this.status = data.status || 'scheduled';
    this.priority = data.priority || 'normal';
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date();
    this.createdBy = data.createdBy || '';
    this.lastModified = data.lastModified || new Date();
    this.modifiedBy = data.modifiedBy || '';
    this.deleted = data.deleted || false;
    this.deletedAt = data.deletedAt || null;
    this.deletedBy = data.deletedBy || null;
  }

  // Convert to Firestore format
  toFirestore() {
    return {
      patientName: this.patientName,
      surgeonId: this.surgeonId,
      facilityId: this.facilityId,
      caseTypeId: this.caseTypeId,
      scheduledDate: this.scheduledDate,
      scheduledTime: this.scheduledTime,
      estimatedDuration: this.estimatedDuration,
      trayRequirements: this.trayRequirements,
      tray_requirements: this.tray_requirements, // MyRepData-compatible format
      status: this.status,
      priority: this.priority,
      notes: this.notes,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      lastModified: this.lastModified,
      modifiedBy: this.modifiedBy,
      deleted: this.deleted,
      deletedAt: this.deletedAt,
      deletedBy: this.deletedBy
    };
  }

  // Convert to JSON for API responses
  toJSON() {
    return {
      patientName: this.patientName,
      surgeonId: this.surgeonId,
      facilityId: this.facilityId,
      caseTypeId: this.caseTypeId,
      scheduledDate: this.scheduledDate,
      scheduledTime: this.scheduledTime,
      estimatedDuration: this.estimatedDuration,
      trayRequirements: this.trayRequirements,
      tray_requirements: this.tray_requirements, // MyRepData-compatible format
      status: this.status,
      priority: this.priority,
      notes: this.notes,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      createdBy: this.createdBy,
      lastModified: this.lastModified instanceof Date ? this.lastModified.toISOString() : this.lastModified,
      modifiedBy: this.modifiedBy
    };
  }

  // Validate the case data
  isValid() {
    const errors = [];

    if (!this.patientName?.trim()) {
      errors.push('Patient name is required');
    }
    if (!this.surgeonId?.trim()) {
      errors.push('Surgeon ID is required');
    }
    if (!this.facilityId?.trim()) {
      errors.push('Facility ID is required');
    }
    if (!this.caseTypeId?.trim()) {
      errors.push('Case type ID is required');
    }
    if (!this.scheduledDate) {
      errors.push('Scheduled date is required');
    }
    if (!['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'].includes(this.status)) {
      errors.push('Invalid status');
    }
    if (!['normal', 'urgent', 'elective'].includes(this.priority)) {
      errors.push('Invalid priority');
    }
    if (this.estimatedDuration && (this.estimatedDuration < 15 || this.estimatedDuration > 600)) {
      errors.push('Estimated duration must be between 15 and 600 minutes');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static method to create from Firestore document
  static fromFirestore(doc) {
    const data = doc.data();
    return new CaseModel({
      ...data,
      id: doc.id
    });
  }
}

module.exports = { CaseModel };