class ImplantTypeModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.status = data.status || 'active'; // 'active' or 'inactive'
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
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
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
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

  // Validation
  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === '') {
      errors.push('Name is required');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less');
    }

    if (this.description && this.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    if (!['active', 'inactive'].includes(this.status)) {
      errors.push('Status must be either "active" or "inactive"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static methods
  static getDefaults() {
    return [
      {
        name: 'Hip Implant',
        description: 'Standard hip replacement implant',
        status: 'active'
      },
      {
        name: 'Knee Implant',
        description: 'Total knee replacement implant',
        status: 'active'
      },
      {
        name: 'Spinal Rod',
        description: 'Titanium spinal fusion rod',
        status: 'active'
      },
      {
        name: 'Cardiac Stent',
        description: 'Drug-eluting coronary stent',
        status: 'active'
      },
      {
        name: 'Orthopedic Screw',
        description: 'Titanium orthopedic bone screw',
        status: 'active'
      }
    ];
  }

  static fromFirestore(doc) {
    return new ImplantTypeModel({
      id: doc.id,
      ...doc.data()
    });
  }

  // Check if implant type is active
  isActive() {
    return this.status === 'active' && !this.deletedAt;
  }

  // Soft delete
  softDelete(userId = null) {
    this.status = 'inactive';
    this.deletedAt = new Date();
    this.modifiedBy = userId;
    this.updatedAt = new Date();
  }

  // Activate implant type
  activate(userId = null) {
    this.status = 'active';
    this.deletedAt = null;
    this.modifiedBy = userId;
    this.updatedAt = new Date();
  }
}

module.exports = { ImplantTypeModel };