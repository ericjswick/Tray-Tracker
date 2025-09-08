class CaseTypeModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category || 'general';
    this.color = data.color || '#3498db';
    this.icon = data.icon || 'folder';
    this.active = data.active !== undefined ? data.active : true;
    this.estimatedDuration = data.estimatedDuration || null; // in minutes
    this.requirements = data.requirements || []; // legacy field
    this.tray_requirements = data.tray_requirements || []; // MyRepData-internal compatible field
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.lastModified = data.lastModified || new Date();
    this.createdBy = data.createdBy || null;
    this.modifiedBy = data.modifiedBy || null;
    this.deletedAt = data.deletedAt || null;
  }

  // Convert to plain object for JSON responses
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      color: this.color,
      icon: this.icon,
      active: this.active,
      estimatedDuration: this.estimatedDuration,
      requirements: this.requirements, // legacy field
      tray_requirements: this.tray_requirements, // MyRepData-internal compatible
      tags: this.tags,
      createdAt: this.createdAt,
      lastModified: this.lastModified,
      createdBy: this.createdBy,
      modifiedBy: this.modifiedBy,
      deletedAt: this.deletedAt
    };
  }

  // Convert to Firestore document format
  toFirestore() {
    const data = this.toJSON();
    // Remove null/undefined values and id (Firestore handles ID separately)
    const { id, ...firestoreData } = data;
    
    // Clean up null values
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === null || firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });
    
    return firestoreData;
  }

  // Validate the case type data
  isValid() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Case type name is required');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Case type name must be less than 100 characters');
    }

    if (this.description && this.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }

    if (this.estimatedDuration && (this.estimatedDuration < 0 || this.estimatedDuration > 1440)) {
      errors.push('Estimated duration must be between 0 and 1440 minutes (24 hours)');
    }

    if (!Array.isArray(this.requirements)) {
      errors.push('Requirements must be an array');
    }

    if (!Array.isArray(this.tray_requirements)) {
      errors.push('Tray requirements must be an array');
    } else {
      // Validate each tray requirement
      this.tray_requirements.forEach((req, index) => {
        if (!req.tray_id || typeof req.tray_id !== 'string') {
          errors.push(`Tray requirement ${index + 1}: tray_id is required`);
        }
        if (!req.requirement_type || !['required', 'preferred', 'optional'].includes(req.requirement_type)) {
          errors.push(`Tray requirement ${index + 1}: requirement_type must be required, preferred, or optional`);
        }
      });
    }

    if (!Array.isArray(this.tags)) {
      errors.push('Tags must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper methods for managing tray requirements
  addTrayRequirement(trayId, requirementType = 'required', notes = '') {
    const existing = this.tray_requirements.find(req => req.tray_id === trayId);
    if (existing) {
      existing.requirement_type = requirementType;
      existing.notes = notes;
    } else {
      this.tray_requirements.push({
        tray_id: trayId,
        requirement_type: requirementType,
        notes: notes
      });
    }
    this.lastModified = new Date();
  }

  removeTrayRequirement(trayId) {
    this.tray_requirements = this.tray_requirements.filter(req => req.tray_id !== trayId);
    this.lastModified = new Date();
  }

  updateTrayRequirement(trayId, updates) {
    const requirement = this.tray_requirements.find(req => req.tray_id === trayId);
    if (requirement) {
      Object.assign(requirement, updates);
      this.lastModified = new Date();
      return true;
    }
    return false;
  }

  getTrayRequirement(trayId) {
    return this.tray_requirements.find(req => req.tray_id === trayId);
  }

  getRequiredTrays() {
    return this.tray_requirements.filter(req => req.requirement_type === 'required');
  }

  getPreferredTrays() {
    return this.tray_requirements.filter(req => req.requirement_type === 'preferred');
  }

  getOptionalTrays() {
    return this.tray_requirements.filter(req => req.requirement_type === 'optional');
  }

  // Static method to create from Firestore document
  static fromFirestore(doc) {
    if (!doc.exists) {
      return null;
    }

    return new CaseTypeModel({
      id: doc.id,
      ...doc.data()
    });
  }

  // Static method to get default case types (compatible with MyRepData-internal)
  static getDefaults() {
    return [
      {
        name: 'SI fusion – lateral',
        description: 'Sacroiliac joint fusion using lateral approach',
        category: 'spine',
        color: '#e74c3c',
        icon: 'scalpel',
        estimatedDuration: 180,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_001',
            requirement_type: 'required',
            notes: 'Primary SI fusion tray for lateral approach'
          },
          {
            tray_id: 'TRAY_002', 
            requirement_type: 'preferred',
            notes: 'Additional instruments for lateral approach'
          }
        ],
        tags: ['si fusion', 'lateral', 'spine']
      },
      {
        name: 'SI fusion – Intra–articular',
        description: 'Sacroiliac joint fusion with intra-articular approach',
        category: 'spine',
        color: '#e67e22',
        icon: 'scalpel',
        estimatedDuration: 180,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_001',
            requirement_type: 'required', 
            notes: 'Primary SI fusion tray for intra-articular approach'
          },
          {
            tray_id: 'TRAY_003',
            requirement_type: 'preferred',
            notes: 'Specialized instruments for intra-articular approach'
          }
        ],
        tags: ['si fusion', 'intra-articular', 'spine']
      },
      {
        name: 'SI fusion – Oblique/Postero lateral',
        description: 'Sacroiliac joint fusion using oblique or postero-lateral approach',
        category: 'spine',
        color: '#f39c12',
        icon: 'scalpel',
        estimatedDuration: 200,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_001',
            requirement_type: 'required',
            notes: 'Primary SI fusion tray for oblique approach'
          },
          {
            tray_id: 'TRAY_004',
            requirement_type: 'preferred', 
            notes: 'Additional instruments for oblique/postero lateral approach'
          }
        ],
        tags: ['si fusion', 'oblique', 'postero lateral', 'spine']
      },
      {
        name: 'SI fusion – Medial to lateral',
        description: 'Sacroiliac joint fusion using medial to lateral approach',
        category: 'spine',
        color: '#27ae60',
        icon: 'scalpel',
        estimatedDuration: 180,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_001',
            requirement_type: 'required',
            notes: 'Primary SI fusion tray for medial to lateral approach'
          }
        ],
        tags: ['si fusion', 'medial to lateral', 'spine']
      },
      {
        name: 'Spine fusion – Long Construct',
        description: 'Spinal fusion involving multiple levels (long construct)',
        category: 'spine',
        color: '#9b59b6',
        icon: 'bone',
        estimatedDuration: 300,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_005',
            requirement_type: 'required',
            notes: 'Long construct spine fusion tray'
          },
          {
            tray_id: 'TRAY_006',
            requirement_type: 'required',
            notes: 'Additional pedicle screws and rods for long construct'
          }
        ],
        tags: ['spine fusion', 'long construct', 'multilevel']
      },
      {
        name: 'Spine fusion – Short construct',
        description: 'Spinal fusion involving fewer levels (short construct)',
        category: 'spine',
        color: '#3498db',
        icon: 'bone',
        estimatedDuration: 180,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_005',
            requirement_type: 'required',
            notes: 'Short construct spine fusion tray'
          }
        ],
        tags: ['spine fusion', 'short construct', 'limited levels']
      },
      {
        name: 'Sacral fracture – TNT/TORQ',
        description: 'Sacral fracture repair using TNT/TORQ technique',
        category: 'trauma',
        color: '#e91e63',
        icon: 'bone',
        estimatedDuration: 150,
        requirements: [],
        tray_requirements: [
          {
            tray_id: 'TRAY_007',
            requirement_type: 'required',
            notes: 'TNT/TORQ fixation system tray'
          }
        ],
        tags: ['sacral fracture', 'tnt', 'torq', 'trauma']
      }
    ];
  }
}

module.exports = { CaseTypeModel };