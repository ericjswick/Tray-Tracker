class TrayModel {
  constructor(data = {}) {
    // Primary identifier - add tray_id for MyRepData compatibility
    this.id = data.id || null;
    this.tray_id = data.tray_id || data.id || null; // MyRepData compatibility
    
    // Core tray fields (compatible with both systems)
    this.name = data.name || '';
    this.type = data.type || ''; // Legacy: 'fusion', 'revision', 'mi', 'complete'
    this.case_type_compatibility = data.case_type_compatibility || []; // MyRepData: ['SI fusion', 'Spine fusion', etc.]
    this.status = data.status || 'available'; // 'available', 'in_use', 'cleaning', 'maintenance'
    this.location = data.location || '';
    this.assignedTo = data.assignedTo || '';
    this.notes = data.notes || '';
    
    // MyRepData compatible fields (add snake_case versions)
    this.facility_id = data.facility_id || data.facility || '';
    this.scheduled_date = data.scheduled_date || data.caseDate || '';
    this.physician_id = data.physician_id || data.surgeon || '';
    this.created_at = data.created_at || data.createdAt || new Date();
    this.updated_at = data.updated_at || data.lastModified || new Date();
    
    // Keep original tray-tracker fields for backward compatibility
    this.facility = data.facility || data.facility_id || '';
    this.caseDate = data.caseDate || data.scheduled_date || '';
    this.surgeon = data.surgeon || data.physician_id || '';
    this.createdAt = data.createdAt || data.created_at || new Date();
    this.lastModified = data.lastModified || data.updated_at || new Date();
    this.createdBy = data.createdBy || '';
    this.modifiedBy = data.modifiedBy || '';
    
    // Photo tracking URLs (keep tray-tracker specific fields unchanged)
    this.checkinPhotoUrl = data.checkinPhotoUrl || '';
    this.pickupPhotoUrl = data.pickupPhotoUrl || '';
    this.turnoverCheckinPhotoUrl = data.turnoverCheckinPhotoUrl || '';
    this.turnoverPhotoUrl = data.turnoverPhotoUrl || '';
    
    // Soft delete support
    this.deletedAt = data.deletedAt || null;
  }

  // Convert to plain object for JSON responses
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      case_type_compatibility: this.case_type_compatibility,
      status: this.status,
      location: this.location,
      facility: this.facility,
      caseDate: this.caseDate,
      surgeon: this.surgeon,
      assignedTo: this.assignedTo,
      notes: this.notes,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      lastModified: this.lastModified,
      modifiedBy: this.modifiedBy,
      checkinPhotoUrl: this.checkinPhotoUrl,
      pickupPhotoUrl: this.pickupPhotoUrl,
      turnoverCheckinPhotoUrl: this.turnoverCheckinPhotoUrl,
      turnoverPhotoUrl: this.turnoverPhotoUrl,
      deletedAt: this.deletedAt
    };
  }

  // Convert to Firestore document format
  toFirestore() {
    const data = this.toJSON();
    const { id, ...firestoreData } = data;
    
    // Clean up null values
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === null || firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });
    
    return firestoreData;
  }

  // Validate the tray data
  isValid() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Tray name is required');
    }

    if (this.name && this.name.length > 200) {
      errors.push('Tray name must be less than 200 characters');
    }

    // Support both legacy tray-tracker types and MyRepData case type compatibility
    const validLegacyTypes = ['fusion', 'revision', 'mi', 'complete', ''];
    const validMyRepDataTypes = ['SI fusion', 'Spine fusion', 'Minimally Invasive', 'Revision Surgery', 'Complete System'];
    
    // Check legacy type field
    if (this.type && !validLegacyTypes.includes(this.type)) {
      errors.push('Legacy type must be fusion, revision, mi, complete, or empty');
    }
    
    // Check MyRepData case type compatibility (if provided)
    if (this.case_type_compatibility && Array.isArray(this.case_type_compatibility)) {
      const invalidTypes = this.case_type_compatibility.filter(type => !validMyRepDataTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid case types: ${invalidTypes.join(', ')}. Valid types: ${validMyRepDataTypes.join(', ')}`);
      }
    }

    // Accept both tray-tracker and MyRepData compatible status values
    const validStatuses = ['available', 'in-use', 'corporate', 'trunk', 'in_use', 'cleaning', 'maintenance'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Status must be available, in_use/in-use, cleaning/corporate, or maintenance/trunk');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static method to create from Firestore document
  static fromFirestore(doc) {
    if (!doc.exists) {
      return null;
    }

    return new TrayModel({
      id: doc.id,
      ...doc.data()
    });
  }

  // Get tray type display name (supports both legacy and MyRepData formats)
  getTrayTypeDisplayName() {
    // If we have MyRepData case type compatibility, use that first
    if (this.case_type_compatibility && Array.isArray(this.case_type_compatibility) && this.case_type_compatibility.length > 0) {
      return this.case_type_compatibility.join(', ');
    }
    
    // Fallback to legacy type mapping
    const typeNames = {
      'fusion': 'Fusion Set',
      'revision': 'Revision Kit',
      'mi': 'Minimally Invasive',
      'complete': 'Complete System'
    };
    return typeNames[this.type] || this.type || 'General Purpose';
  }

  // Get status display name (supports both tray-tracker and MyRepData formats)
  getStatusDisplayName() {
    const statusNames = {
      // Tray-tracker format (backward compatibility)
      'available': 'Available',
      'in-use': 'In Use',
      'corporate': 'Corporate',
      'trunk': 'Trunk',
      // MyRepData compatible format
      'in_use': 'In Use',
      'cleaning': 'Cleaning',
      'maintenance': 'Maintenance'
    };
    return statusNames[this.status] || this.status;
  }

  // Check if tray is available
  isAvailable() {
    return this.status === 'available' && !this.deletedAt;
  }

  // Check if tray is in use (supports both formats)
  isInUse() {
    return (this.status === 'in-use' || this.status === 'in_use') && !this.deletedAt;
  }

  // Check if tray is active (not deleted)
  isActive() {
    return !this.deletedAt;
  }

  // Convert status to MyRepData compatible format
  getMyRepDataStatus() {
    const statusMapping = {
      'available': 'available',
      'in-use': 'in_use',
      'corporate': 'cleaning',
      'trunk': 'maintenance',
      // Already MyRepData format (no change needed)
      'in_use': 'in_use',
      'cleaning': 'cleaning',
      'maintenance': 'maintenance'
    };
    return statusMapping[this.status] || this.status;
  }

  // Convert legacy type to MyRepData case type compatibility
  getMyRepDataCaseTypes() {
    // If already has MyRepData case types, return them
    if (this.case_type_compatibility && Array.isArray(this.case_type_compatibility) && this.case_type_compatibility.length > 0) {
      return this.case_type_compatibility;
    }
    
    // Convert legacy types to MyRepData case types
    const typeMapping = {
      'fusion': ['SI fusion', 'Spine fusion'],
      'revision': ['Revision Surgery'],
      'mi': ['Minimally Invasive'],
      'complete': ['Complete System', 'SI fusion', 'Spine fusion']
    };
    
    return typeMapping[this.type] || [];
  }

  // Check if tray is assigned to a case
  isAssignedToCase() {
    return !!(this.caseDate && this.surgeon && this.facility);
  }

  // Get full assignment info
  getAssignmentInfo() {
    if (!this.isAssignedToCase()) {
      return null;
    }

    return {
      caseDate: this.caseDate,
      surgeon: this.surgeon,
      facility: this.facility,
      assignedTo: this.assignedTo
    };
  }

  // Static method to get default trays compatible with MyRepData-internal
  static getDefaults() {
    return [
      {
        name: 'SI Fusion Set Alpha',
        type: 'fusion', // Legacy compatibility
        case_type_compatibility: ['SI fusion', 'Spine fusion'], // MyRepData compatibility
        status: 'available',
        location: 'maintenance',
        notes: 'Primary SI fusion instrumentation set'
      },
      {
        name: 'SI Fusion Set Beta', 
        type: 'fusion', // Legacy compatibility
        case_type_compatibility: ['SI fusion'], // MyRepData compatibility
        status: 'available',
        location: 'maintenance',
        notes: 'Secondary SI fusion instrumentation set'
      },
      {
        name: 'Revision Surgery Kit',
        type: 'revision', // Legacy compatibility
        case_type_compatibility: ['Revision Surgery'], // MyRepData compatibility
        status: 'available', 
        location: 'maintenance',
        notes: 'Revision surgery instrumentation'
      },
      {
        name: 'Minimally Invasive Set',
        type: 'mi', // Legacy compatibility
        case_type_compatibility: ['Minimally Invasive'], // MyRepData compatibility
        status: 'available',
        location: 'maintenance', 
        notes: 'Minimally invasive procedure tools'
      },
      {
        name: 'Complete Surgical System',
        type: 'complete', // Legacy compatibility
        case_type_compatibility: ['Complete System', 'SI fusion', 'Spine fusion'], // MyRepData compatibility
        status: 'available',
        location: 'maintenance',
        notes: 'Complete surgical system with all components'
      }
    ];
  }

  // Get trays by type
  static getTraysByType(trays, type) {
    return trays.filter(tray => tray.type === type && tray.isActive());
  }

  // Get trays by status
  static getTraysByStatus(trays, status) {
    return trays.filter(tray => tray.status === status && tray.isActive());
  }

  // Get available trays
  static getAvailableTrays(trays) {
    return trays.filter(tray => tray.isAvailable());
  }

  // Get trays in use
  static getTraysInUse(trays) {
    return trays.filter(tray => tray.isInUse());
  }

  // Get trays assigned to specific surgeon
  static getTraysBySurgeon(trays, surgeonId) {
    return trays.filter(tray => tray.surgeon === surgeonId && tray.isActive());
  }

  // Get trays at specific facility
  static getTraysAtFacility(trays, facilityId) {
    return trays.filter(tray => tray.facility === facilityId && tray.isActive());
  }
}

module.exports = { TrayModel };