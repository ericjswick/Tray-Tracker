class PhysicianPreferenceModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.physician_id = data.physician_id || ''; // References surgeon ID
    this.case_type = data.case_type || ''; // Case type name (e.g., 'SI fusion – lateral')
    this.tray_id = data.tray_id || '';
    this.tray_name = data.tray_name || '';
    this.requirement_type = data.requirement_type || 'preferred'; // required, preferred, optional
    this.quantity = data.quantity || 1;
    this.priority = data.priority || 1;
    this.notes = data.notes || '';
    
    // Timestamps
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.createdBy = data.createdBy || '';
    this.modifiedBy = data.modifiedBy || '';
    this.deletedAt = data.deletedAt || null;
  }

  // Convert to plain object for JSON responses
  toJSON() {
    return {
      id: this.id,
      physician_id: this.physician_id,
      case_type: this.case_type,
      tray_id: this.tray_id,
      tray_name: this.tray_name,
      requirement_type: this.requirement_type,
      quantity: this.quantity,
      priority: this.priority,
      notes: this.notes,
      created_at: this.created_at,
      updated_at: this.updated_at,
      createdBy: this.createdBy,
      modifiedBy: this.modifiedBy,
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

  // Validate the physician preference data
  isValid() {
    const errors = [];

    if (!this.physician_id || this.physician_id.trim().length === 0) {
      errors.push('Physician ID is required');
    }

    if (!this.case_type || this.case_type.trim().length === 0) {
      errors.push('Case type is required');
    }

    if (!this.tray_id || this.tray_id.trim().length === 0) {
      errors.push('Tray ID is required');
    }

    if (!['required', 'preferred', 'optional'].includes(this.requirement_type)) {
      errors.push('Requirement type must be required, preferred, or optional');
    }

    if (this.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }

    if (this.priority < 1 || this.priority > 10) {
      errors.push('Priority must be between 1 and 10');
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

    return new PhysicianPreferenceModel({
      id: doc.id,
      ...doc.data()
    });
  }

  // Get requirement type display name
  getRequirementTypeDisplayName() {
    const typeNames = {
      'required': 'Required',
      'preferred': 'Preferred', 
      'optional': 'Optional'
    };
    return typeNames[this.requirement_type] || this.requirement_type;
  }

  // Get requirement type CSS class
  getRequirementTypeClass() {
    const typeClasses = {
      'required': 'danger',
      'preferred': 'warning',
      'optional': 'secondary'
    };
    return typeClasses[this.requirement_type] || 'secondary';
  }

  // Check if preference is active (not deleted)
  isActive() {
    return !this.deletedAt;
  }

  // Static helper methods for filtering preferences
  static getPreferencesByPhysician(preferences, physicianId) {
    return preferences.filter(pref => pref.physician_id === physicianId && pref.isActive());
  }

  static getPreferencesByCaseType(preferences, caseType) {
    return preferences.filter(pref => pref.case_type === caseType && pref.isActive());
  }

  static getPreferencesByPhysicianAndCase(preferences, physicianId, caseType) {
    return preferences.filter(pref => 
      pref.physician_id === physicianId && 
      pref.case_type === caseType && 
      pref.isActive()
    );
  }

  static getRequiredPreferences(preferences, physicianId, caseType) {
    return preferences.filter(pref => 
      pref.physician_id === physicianId && 
      pref.case_type === caseType && 
      pref.requirement_type === 'required' && 
      pref.isActive()
    );
  }

  static getPreferredPreferences(preferences, physicianId, caseType) {
    return preferences.filter(pref => 
      pref.physician_id === physicianId && 
      pref.case_type === caseType && 
      pref.requirement_type === 'preferred' && 
      pref.isActive()
    );
  }

  static getOptionalPreferences(preferences, physicianId, caseType) {
    return preferences.filter(pref => 
      pref.physician_id === physicianId && 
      pref.case_type === caseType && 
      pref.requirement_type === 'optional' && 
      pref.isActive()
    );
  }

  // Group preferences by case type for a physician
  static groupPreferencesByCaseType(preferences, physicianId) {
    const physicianPrefs = this.getPreferencesByPhysician(preferences, physicianId);
    const grouped = {};
    
    physicianPrefs.forEach(pref => {
      if (!grouped[pref.case_type]) {
        grouped[pref.case_type] = [];
      }
      grouped[pref.case_type].push(pref);
    });
    
    return grouped;
  }

  // Get unique case types that have physician preferences
  static getUniqueCaseTypesWithPreferences(preferences, physicianId) {
    const physicianPrefs = this.getPreferencesByPhysician(preferences, physicianId);
    const caseTypes = new Set(physicianPrefs.map(pref => pref.case_type));
    return Array.from(caseTypes);
  }

  // Get unique tray IDs for a physician's preferences
  static getUniqueTraysForPhysician(preferences, physicianId) {
    const physicianPrefs = this.getPreferencesByPhysician(preferences, physicianId);
    const trayIds = new Set(physicianPrefs.map(pref => pref.tray_id));
    return Array.from(trayIds);
  }

  // Sort preferences by priority and requirement type
  static sortPreferences(preferences) {
    return preferences.sort((a, b) => {
      // Sort by priority first
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Then by requirement type (required > preferred > optional)
      const typeOrder = { 'required': 1, 'preferred': 2, 'optional': 3 };
      return (typeOrder[a.requirement_type] || 3) - (typeOrder[b.requirement_type] || 3);
    });
  }
}

module.exports = { PhysicianPreferenceModel };