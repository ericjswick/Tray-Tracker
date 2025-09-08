class TrayRequirementModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.case_type = data.case_type || ''; // References case type name/ID
    this.tray_id = data.tray_id || '';
    this.tray_name = data.tray_name || '';
    this.requirement_type = data.requirement_type || 'required'; // required, preferred, optional
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

  // Validate the tray requirement data
  isValid() {
    const errors = [];

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

    return new TrayRequirementModel({
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

  // Check if requirement is active (not deleted)
  isActive() {
    return !this.deletedAt;
  }

  // Static method to get default tray requirements for MyRepData case types
  static getDefaultRequirements() {
    return [
      // SI fusion – lateral
      {
        case_type: 'SI fusion – lateral',
        tray_id: 'si_fusion_lateral_primary',
        tray_name: 'SI fusion – lateral Primary Tray',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Primary tray for lateral SI fusion approach'
      },
      {
        case_type: 'SI fusion – lateral',
        tray_id: 'si_fusion_lateral_backup',
        tray_name: 'SI fusion – lateral Backup Tray',
        requirement_type: 'optional',
        quantity: 1,
        priority: 2,
        notes: 'Backup instrumentation for lateral approach'
      },
      
      // SI fusion – Intra–articular
      {
        case_type: 'SI fusion – Intra–articular',
        tray_id: 'si_fusion_intra_primary',
        tray_name: 'SI fusion – Intra-articular Primary Tray',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Primary tray for intra-articular SI fusion'
      },
      
      // Spine fusion – Short Construct
      {
        case_type: 'Spine fusion – Short Construct',
        tray_id: 'spine_fusion_short_primary',
        tray_name: 'Spine fusion – Short Construct Primary Tray',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Primary tray for short construct spine fusion'
      },
      {
        case_type: 'Spine fusion – Short Construct',
        tray_id: 'spine_fusion_short_revision',
        tray_name: 'Spine fusion – Short Construct Revision Kit',
        requirement_type: 'preferred',
        quantity: 1,
        priority: 2,
        notes: 'Revision instrumentation for short construct cases'
      },
      
      // Spine fusion – Long Construct
      {
        case_type: 'Spine fusion – Long Construct',
        tray_id: 'spine_fusion_long_primary',
        tray_name: 'Spine fusion – Long Construct Primary Tray',
        requirement_type: 'required',
        quantity: 2,
        priority: 1,
        notes: 'Primary trays for long construct spine fusion (2 required)'
      },
      {
        case_type: 'Spine fusion – Long Construct',
        tray_id: 'spine_fusion_long_revision',
        tray_name: 'Spine fusion – Long Construct Revision Kit',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Revision instrumentation for complex long construct cases'
      },
      
      // Revision Surgery – Spine fusion
      {
        case_type: 'Revision Surgery – Spine fusion',
        tray_id: 'revision_spine_primary',
        tray_name: 'Revision Surgery – Spine fusion Primary Kit',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Specialized revision spine surgery instrumentation'
      },
      {
        case_type: 'Revision Surgery – Spine fusion',
        tray_id: 'revision_spine_extraction',
        tray_name: 'Revision Surgery – Extraction Tools',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Hardware extraction tools for revision cases'
      },
      
      // Revision Surgery – SI fusion
      {
        case_type: 'Revision Surgery – SI fusion',
        tray_id: 'revision_si_primary',
        tray_name: 'Revision Surgery – SI fusion Primary Kit',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Specialized revision SI fusion instrumentation'
      },
      
      // Minimally Invasive Spine fusion
      {
        case_type: 'Minimally Invasive Spine fusion',
        tray_id: 'mis_spine_primary',
        tray_name: 'MIS Spine fusion Primary Tray',
        requirement_type: 'required',
        quantity: 1,
        priority: 1,
        notes: 'Minimally invasive spine fusion instrumentation'
      },
      {
        case_type: 'Minimally Invasive Spine fusion',
        tray_id: 'mis_spine_specialized',
        tray_name: 'MIS Spine fusion Specialized Tools',
        requirement_type: 'preferred',
        quantity: 1,
        priority: 2,
        notes: 'Specialized MIS tools for complex cases'
      }
    ];
  }

  // Static helper methods for filtering requirements
  static getRequirementsByCase(requirements, caseType) {
    return requirements.filter(req => req.case_type === caseType && req.isActive());
  }

  static getRequiredTrays(requirements, caseType) {
    return requirements.filter(req => 
      req.case_type === caseType && 
      req.requirement_type === 'required' && 
      req.isActive()
    );
  }

  static getPreferredTrays(requirements, caseType) {
    return requirements.filter(req => 
      req.case_type === caseType && 
      req.requirement_type === 'preferred' && 
      req.isActive()
    );
  }

  static getOptionalTrays(requirements, caseType) {
    return requirements.filter(req => 
      req.case_type === caseType && 
      req.requirement_type === 'optional' && 
      req.isActive()
    );
  }
}

module.exports = { TrayRequirementModel };