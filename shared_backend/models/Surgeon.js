class SurgeonModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.title = data.title || 'Dr.'; // 'Dr.', 'Prof.', 'Prof. Dr.'
    this.specialty = data.specialty || ''; // 'Neurosurgery', 'Ortho Spine', 'Pain', 'Ortho Trauma', 'IR', 'Ortho'
    this.hospital = data.hospital || '';
    this.email = data.email || '';
    this.phone = data.phone || '';
    this.preferredCases = data.preferredCases || ''; // Comma-separated case type IDs
    this.notes = data.notes || '';
    this.active = data.active !== undefined ? data.active : true;
    this.region = data.region || '';
    this.yearsExperience = data.yearsExperience || null;
    
    // Metadata
    this.createdAt = data.createdAt || new Date();
    this.createdBy = data.createdBy || '';
    this.lastModified = data.lastModified || new Date();
    this.modifiedBy = data.modifiedBy || '';
    this.isDemoSurgeon = data.isDemoSurgeon || false;
    
    // Soft delete support
    this.deletedAt = data.deletedAt || null;
  }

  // Convert to plain object for JSON responses
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      title: this.title,
      specialty: this.specialty,
      hospital: this.hospital,
      email: this.email,
      phone: this.phone,
      preferredCases: this.preferredCases,
      notes: this.notes,
      active: this.active,
      region: this.region,
      yearsExperience: this.yearsExperience,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      lastModified: this.lastModified,
      modifiedBy: this.modifiedBy,
      isDemoSurgeon: this.isDemoSurgeon,
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

  // Validate the surgeon data
  isValid() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Surgeon name is required');
    }

    if (this.name && this.name.length > 200) {
      errors.push('Surgeon name must be less than 200 characters');
    }

    if (!['Dr.', 'Prof.', 'Prof. Dr.', ''].includes(this.title)) {
      errors.push('Title must be Dr., Prof., or Prof. Dr.');
    }

    const validSpecialties = ['Neurosurgery', 'Ortho Spine', 'Pain', 'Ortho Trauma', 'IR', 'Ortho', 'Pain Management', 'Neuro', 'General'];
    if (this.specialty && !validSpecialties.includes(this.specialty)) {
      errors.push('Invalid specialty');
    }

    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      errors.push('Invalid email format');
    }

    if (this.phone && !/^[\+]?[\d\s\-\(\)\.]{10,}$/.test(this.phone)) {
      errors.push('Invalid phone number format');
    }

    if (this.yearsExperience && (this.yearsExperience < 0 || this.yearsExperience > 60)) {
      errors.push('Years of experience must be between 0 and 60');
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

    return new SurgeonModel({
      id: doc.id,
      ...doc.data()
    });
  }

  // Get full name with title
  getFullName() {
    return this.title ? `${this.title} ${this.name}` : this.name;
  }

  // Get display name with hospital
  getDisplayName() {
    return this.hospital ? `${this.getFullName()} - ${this.hospital}` : this.getFullName();
  }

  // Check if surgeon is active
  isActive() {
    return this.active && !this.deletedAt;
  }

  // Get preferred case types as array
  getPreferredCaseTypesArray() {
    if (!this.preferredCases) {
      return [];
    }
    return this.preferredCases.split(',').map(id => id.trim()).filter(id => id);
  }

  // Set preferred case types from array
  setPreferredCaseTypesArray(caseTypeIds) {
    this.preferredCases = Array.isArray(caseTypeIds) ? caseTypeIds.join(',') : '';
  }

  // Check if surgeon has specific case type preference
  hasPreferredCaseType(caseTypeId) {
    const preferredIds = this.getPreferredCaseTypesArray();
    return preferredIds.includes(caseTypeId);
  }

  // Add preferred case type
  addPreferredCaseType(caseTypeId) {
    const preferredIds = this.getPreferredCaseTypesArray();
    if (!preferredIds.includes(caseTypeId)) {
      preferredIds.push(caseTypeId);
      this.setPreferredCaseTypesArray(preferredIds);
    }
  }

  // Remove preferred case type
  removePreferredCaseType(caseTypeId) {
    const preferredIds = this.getPreferredCaseTypesArray();
    const filtered = preferredIds.filter(id => id !== caseTypeId);
    this.setPreferredCaseTypesArray(filtered);
  }

  // Static method to get default surgeons compatible with MyRepData-internal
  static getDefaults() {
    return [
      {
        name: 'Michael Johnson',
        title: 'Dr.',
        specialty: 'Ortho Spine',
        hospital: 'Advanced Spine Center',
        email: 'mjohnson@spinecenter.com',
        phone: '+1-555-0100',
        region: 'Wisconsin East',
        yearsExperience: 15,
        notes: 'Specializes in minimally invasive spine procedures',
        isDemoSurgeon: true
      },
      {
        name: 'Sarah Martinez',
        title: 'Dr.',
        specialty: 'Neurosurgery',
        hospital: 'Froedtert Hospital',
        email: 'smartinez@froedtert.com',
        phone: '+1-414-555-0200',
        region: 'Wisconsin East',
        yearsExperience: 12,
        notes: 'Focus on complex spinal deformity cases',
        isDemoSurgeon: true
      },
      {
        name: 'David Chen',
        title: 'Prof. Dr.',
        specialty: 'Pain Management',
        hospital: 'Pain Management Associates',
        email: 'dchen@painmgmt.com',
        phone: '+1-608-555-0300',
        region: 'Wisconsin West',
        yearsExperience: 20,
        notes: 'Interventional pain management specialist',
        isDemoSurgeon: true
      },
      {
        name: 'Lisa Thompson',
        title: 'Dr.',
        specialty: 'Ortho',
        hospital: 'Aurora Medical Center - Grafton',
        email: 'lthompson@aurora.org',
        phone: '+1-262-555-0400',
        region: 'Wisconsin East',
        yearsExperience: 8,
        notes: 'General orthopedic surgery with spine focus',
        isDemoSurgeon: true
      },
      {
        name: 'Robert Kim',
        title: 'Dr.',
        specialty: 'Neuro',
        hospital: 'Neuro Surgery Center of Wisconsin',
        email: 'rkim@neurowi.com',
        phone: '+1-920-555-0500',
        region: 'Wisconsin East',
        yearsExperience: 18,
        notes: 'Neurosurgery and complex spine cases',
        isDemoSurgeon: true
      }
    ];
  }

  // Get surgeons by specialty
  static getSurgeonsBySpecialty(surgeons, specialty) {
    return surgeons.filter(surgeon => surgeon.specialty === specialty && surgeon.isActive());
  }

  // Get surgeons by region
  static getSurgeonsByRegion(surgeons, region) {
    return surgeons.filter(surgeon => surgeon.region === region && surgeon.isActive());
  }

  // Get surgeons by hospital
  static getSurgeonsByHospital(surgeons, hospital) {
    return surgeons.filter(surgeon => surgeon.hospital === hospital && surgeon.isActive());
  }

  // Get active surgeons
  static getActiveSurgeons(surgeons) {
    return surgeons.filter(surgeon => surgeon.isActive());
  }

  // Get surgeons with specific case type preference
  static getSurgeonsWithCaseTypePreference(surgeons, caseTypeId) {
    return surgeons.filter(surgeon => 
      surgeon.isActive() && surgeon.hasPreferredCaseType(caseTypeId)
    );
  }

  // Search surgeons by name
  static searchSurgeonsByName(surgeons, searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    return surgeons.filter(surgeon => 
      surgeon.isActive() && (
        surgeon.name.toLowerCase().includes(searchLower) ||
        surgeon.getFullName().toLowerCase().includes(searchLower)
      )
    );
  }

  // Get available specialties
  static getAvailableSpecialties() {
    return ['Neurosurgery', 'Ortho Spine', 'Pain', 'Ortho Trauma', 'IR', 'Ortho', 'Pain Management', 'Neuro', 'General'];
  }

  // Get available titles
  static getAvailableTitles() {
    return ['Dr.', 'Prof.', 'Prof. Dr.'];
  }
}

module.exports = { SurgeonModel };