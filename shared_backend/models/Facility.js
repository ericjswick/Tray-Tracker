class FacilityModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.type = data.type || 'Hospital'; // ASC, Hospital, OBL
    this.specialty = data.specialty || ''; // Ortho, Pain Management, Neuro, etc.
    this.address = data.address || '';
    this.city = data.city || '';
    this.state = data.state || '';
    this.zip = data.zip || '';
    this.phone = data.phone || '';
    this.territory = data.territory || '';
    this.active = data.active !== undefined ? data.active : true;
    
    // Additional fields that may be useful but optional
    this.npi = data.npi || ''; // National Provider Identifier
    this.account_owner = data.account_owner || ''; // Sales rep
    this.priority = data.priority || 1; // 1-5 priority level
    this.contact = data.contact || {}; // Contact information object
    this.notes = data.notes || '';
    
    // Geographic data (preserved from our current system)
    this.latitude = data.latitude || null;
    this.longitude = data.longitude || null;
    
    // Timestamps
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.createdBy = data.createdBy || null;
    this.modifiedBy = data.modifiedBy || null;
    this.deletedAt = data.deletedAt || null;
  }

  // Convert to plain object for JSON responses
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      specialty: this.specialty,
      address: this.address,
      city: this.city,
      state: this.state,
      zip: this.zip,
      phone: this.phone,
      territory: this.territory,
      active: this.active,
      npi: this.npi,
      account_owner: this.account_owner,
      priority: this.priority,
      contact: this.contact,
      notes: this.notes,
      latitude: this.latitude,
      longitude: this.longitude,
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

  // Validate the facility data
  isValid() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Facility name is required');
    }

    if (this.name && this.name.length > 200) {
      errors.push('Facility name must be less than 200 characters');
    }

    if (!['ASC', 'Hospital', 'OBL'].includes(this.type)) {
      errors.push('Type must be ASC, Hospital, or OBL');
    }

    if (this.specialty && !['Ortho', 'Ortho Spine', 'Pain Management', 'Neuro', 'General'].includes(this.specialty)) {
      errors.push('Invalid specialty');
    }

    if (!this.city || this.city.trim().length === 0) {
      errors.push('City is required');
    }

    if (!this.state || this.state.trim().length === 0) {
      errors.push('State is required');
    }

    if (this.zip && !/^\d{5}(-\d{4})?$/.test(this.zip)) {
      errors.push('Invalid ZIP code format');
    }

    if (this.phone && !/^\+?[\d\s\-\(\)\.]{10,}$/.test(this.phone)) {
      errors.push('Invalid phone number format');
    }

    if (this.priority && (this.priority < 1 || this.priority > 5)) {
      errors.push('Priority must be between 1 and 5');
    }

    if (this.latitude && (this.latitude < -90 || this.latitude > 90)) {
      errors.push('Invalid latitude value');
    }

    if (this.longitude && (this.longitude < -180 || this.longitude > 180)) {
      errors.push('Invalid longitude value');
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

    return new FacilityModel({
      id: doc.id,
      ...doc.data()
    });
  }

  // Get full address string
  getFullAddress() {
    const parts = [this.address, this.city, this.state, this.zip].filter(part => part && part.trim());
    return parts.join(', ');
  }

  // Get display name with location
  getDisplayName() {
    return this.city ? `${this.name} (${this.city}, ${this.state})` : this.name;
  }

  // Check if facility is active
  isActive() {
    return this.active && !this.deletedAt;
  }

  // Static method to get default facilities (compatible with MyRepData-internal)
  static getDefaults() {
    return [
      {
        name: 'Advanced Spine Center',
        type: 'ASC',
        specialty: 'Ortho Spine',
        address: '123 Medical Drive',
        city: 'Milwaukee',
        state: 'WI',
        zip: '53201',
        phone: '+1-555-0456',
        territory: 'Wisconsin East',
        account_owner: 'Eric Swick',
        priority: 1,
        contact: {
          primary: 'Sarah Johnson, OR Manager',
          email: 'sarah.johnson@advancedspine.com',
          mobile: '+1-555-0457'
        },
        latitude: 43.0389,
        longitude: -87.9065,
        notes: 'Premier outpatient spine surgery center'
      },
      {
        name: 'Aurora Medical Center - Grafton',
        type: 'Hospital',
        specialty: 'Ortho',
        address: '975 Port Washington Rd',
        city: 'Grafton',
        state: 'WI',
        zip: '53024',
        phone: '+1-262-329-1000',
        territory: 'Wisconsin East',
        account_owner: 'Eric Swick',
        priority: 1,
        contact: {
          primary: 'Jennifer Martinez, Surgical Coordinator',
          email: 'jennifer.martinez@aurora.org',
          mobile: '+1-262-329-1001'
        },
        latitude: 43.3239,
        longitude: -87.9511,
        notes: 'Full-service hospital with advanced spine services'
      },
      {
        name: 'Froedtert Hospital',
        type: 'Hospital',
        specialty: 'Ortho Spine',
        address: '9200 W Wisconsin Ave',
        city: 'Milwaukee',
        state: 'WI',
        zip: '53226',
        phone: '+1-414-805-3000',
        territory: 'Wisconsin East',
        account_owner: 'Eric Swick',
        priority: 2,
        contact: {
          primary: 'Dr. Michael Chen, Chief of Surgery',
          email: 'michael.chen@froedtert.com',
          mobile: '+1-414-805-3001'
        },
        latitude: 43.0509,
        longitude: -88.0034,
        notes: 'Level 1 trauma center with comprehensive spine program'
      },
      {
        name: 'Pain Management Associates',
        type: 'OBL',
        specialty: 'Pain Management',
        address: '456 Wellness Blvd',
        city: 'Madison',
        state: 'WI',
        zip: '53719',
        phone: '+1-608-555-0123',
        territory: 'Wisconsin West',
        account_owner: 'Eric Swick',
        priority: 3,
        contact: {
          primary: 'Dr. Lisa Thompson, Medical Director',
          email: 'lisa.thompson@painmgmt.com',
          mobile: '+1-608-555-0124'
        },
        latitude: 43.0731,
        longitude: -89.4012,
        notes: 'Specialized pain management and interventional procedures'
      },
      {
        name: 'Neuro Surgery Center of Wisconsin',
        type: 'ASC',
        specialty: 'Neuro',
        address: '789 Brain Ave',
        city: 'Green Bay',
        state: 'WI',
        zip: '54301',
        phone: '+1-920-555-0200',
        territory: 'Wisconsin East',
        account_owner: 'Eric Swick',
        priority: 2,
        contact: {
          primary: 'Dr. Robert Kim, Chief Neurosurgeon',
          email: 'robert.kim@neurowi.com',
          mobile: '+1-920-555-0201'
        },
        latitude: 44.5133,
        longitude: -88.0133,
        notes: 'Cutting-edge neurosurgical procedures and spine treatments'
      }
    ];
  }

  // Get facilities by type
  static getFacilitiesByType(facilities, type) {
    return facilities.filter(facility => facility.type === type);
  }

  // Get facilities by specialty
  static getFacilitiesBySpecialty(facilities, specialty) {
    return facilities.filter(facility => facility.specialty === specialty);
  }

  // Get facilities by territory
  static getFacilitiesByTerritory(facilities, territory) {
    return facilities.filter(facility => facility.territory === territory);
  }
}

module.exports = { FacilityModel };