const { FacilityModel } = require('../models/Facility');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class FacilityService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'facilities'; // Changed from 'locations' to 'facilities'
  }

  async createFacility(facilityData, userId) {
    try {
      // Create facility model
      const facilityModel = new FacilityModel({
        ...facilityData,
        createdBy: userId,
        created_at: new Date(),
        updated_at: new Date(),
        modifiedBy: userId
      });

      // Validate the facility
      const validation = facilityModel.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to Firestore - support both manual and auto-generated IDs
      let docRef;
      let facilityId;
      
      if (facilityData.id && facilityData.id.trim()) {
        // Manual ID provided - check if it already exists
        facilityId = facilityData.id.trim();
        const existingDoc = await this.db.collection(this.collection).doc(facilityId).get();
        
        if (existingDoc.exists && !existingDoc.data().deletedAt) {
          throw new Error(`Facility with ID '${facilityId}' already exists`);
        }
        
        // Use manual ID
        docRef = this.db.collection(this.collection).doc(facilityId);
        await docRef.set(facilityModel.toFirestore());
      } else {
        // Auto-generate ID
        docRef = await this.db.collection(this.collection).add(facilityModel.toFirestore());
        facilityId = docRef.id;
      }
      
      return formatResponse({
        id: facilityId,
        ...facilityModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create facility');
    }
  }

  async getFacility(facilityId) {
    try {
      const doc = await this.db.collection(this.collection).doc(facilityId).get();
      
      if (!doc.exists) {
        throw new Error('Facility not found');
      }

      const facility = FacilityModel.fromFirestore(doc);
      
      // Check if deleted
      if (facility.deletedAt) {
        return null;
      }

      return formatResponse(facility.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to get facility');
    }
  }

  async getAllFacilities(options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = 'account_name',
        sortOrder = 'asc',
        filters = {}
      } = options;

      let query = this.db.collection(this.collection);

      // Apply filters
      if (filters.active !== undefined) {
        query = query.where('active', '==', filters.active);
      }

      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }

      if (filters.specialty) {
        query = query.where('specialty', '==', filters.specialty);
      }

      if (filters.territory) {
        query = query.where('territory', '==', filters.territory);
      }

      // Filter out deleted items
      query = query.where('deletedAt', '==', null);

      // Apply sorting
      query = query.orderBy(sortBy, sortOrder);

      // Apply pagination
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit);

      const snapshot = await query.get();
      const facilities = [];

      snapshot.forEach(doc => {
        const facility = FacilityModel.fromFirestore(doc);
        if (facility) {
          facilities.push(facility.toJSON());
        }
      });

      return formatResponse(facilities);
    } catch (error) {
      throw handleError(error, 'Failed to get facilities');
    }
  }

  async updateFacility(facilityId, updateData, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(facilityId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Facility not found');
      }

      const existing = FacilityModel.fromFirestore(existingDoc);
      
      if (existing.deletedAt) {
        throw new Error('Cannot update deleted facility');
      }

      const updatedFacility = new FacilityModel({
        ...existing.toJSON(),
        ...updateData,
        id: facilityId,
        updated_at: new Date(),
        modifiedBy: userId
      });

      const validation = updatedFacility.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      await this.db.collection(this.collection).doc(facilityId).update(updatedFacility.toFirestore());
      
      return formatResponse(updatedFacility.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to update facility');
    }
  }

  async deleteFacility(facilityId, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(facilityId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Facility not found');
      }

      // Soft delete
      await this.db.collection(this.collection).doc(facilityId).update({
        deletedAt: new Date(),
        updated_at: new Date(),
        modifiedBy: userId,
        active: false
      });

      return formatResponse({ success: true, message: 'Facility deleted successfully' });
    } catch (error) {
      throw handleError(error, 'Failed to delete facility');
    }
  }

  async searchFacilities(searchTerm, filters = {}) {
    try {
      // Get all facilities first (Firestore doesn't support full-text search)
      const allFacilities = await this.getAllFacilities({ filters });
      
      if (!searchTerm) {
        return allFacilities;
      }

      const searchLower = searchTerm.toLowerCase();
      const filtered = allFacilities.data.filter(facility => 
        facility.account_name?.toLowerCase().includes(searchLower) ||
        facility.address?.city?.toLowerCase().includes(searchLower) ||
        facility.address?.state?.toLowerCase().includes(searchLower) ||
        facility.address?.street?.toLowerCase().includes(searchLower) ||
        facility.specialty?.toLowerCase().includes(searchLower) ||
        facility.territory?.toLowerCase().includes(searchLower)
      );

      return formatResponse(filtered);
    } catch (error) {
      throw handleError(error, 'Failed to search facilities');
    }
  }

  // MyRepData-compatible method: get facility with cases
  async getFacilityWithCases(facilityId) {
    try {
      const facility = await this.getFacility(facilityId);
      if (!facility) return null;

      // This would integrate with CaseService to get cases
      // For now, return facility with empty cases array
      return formatResponse({
        ...facility.data,
        cases: [] // TODO: Implement case integration
      });
    } catch (error) {
      throw handleError(error, 'Failed to get facility with cases');
    }
  }

  // Initialize default facilities
  async initializeDefaults(userId = null) {
    try {
      const defaults = FacilityModel.getDefaults();
      const results = [];

      for (const defaultData of defaults) {
        // Check if facility already exists by account_name and city
        const existing = await this.searchFacilities(defaultData.account_name);
        const duplicateFound = existing.data.some(f => 
          f.account_name === defaultData.account_name && f.address?.city === defaultData.address?.city
        );

        if (!duplicateFound) {
          const created = await this.createFacility(defaultData, userId);
          results.push(created.data);
        }
      }

      return formatResponse({
        success: true,
        message: `Initialized ${results.length} default facilities compatible with MyRepData-internal`,
        created: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to initialize default facilities');
    }
  }

  // Get statistics about facilities
  async getStats() {
    try {
      const allFacilities = await this.getAllFacilities({ filters: { active: true } });
      
      const stats = {
        total: allFacilities.data.length,
        byType: {
          ASC: 0,
          Hospital: 0,
          OBL: 0
        },
        bySpecialty: {},
        byTerritory: {}
      };

      allFacilities.data.forEach(facility => {
        // Count by type
        if (stats.byType[facility.account_record_type] !== undefined) {
          stats.byType[facility.account_record_type]++;
        }

        // Count by specialty
        if (facility.specialty) {
          if (!stats.bySpecialty[facility.specialty]) {
            stats.bySpecialty[facility.specialty] = 0;
          }
          stats.bySpecialty[facility.specialty]++;
        }

        // Count by territory
        if (facility.territory) {
          if (!stats.byTerritory[facility.territory]) {
            stats.byTerritory[facility.territory] = 0;
          }
          stats.byTerritory[facility.territory]++;
        }
      });

      return formatResponse(stats);
    } catch (error) {
      throw handleError(error, 'Failed to get facility statistics');
    }
  }

  // Get facilities by territory (MyRepData compatibility)
  async getFacilitiesByTerritory(territory) {
    return this.getAllFacilities({ 
      filters: { territory, active: true }
    });
  }

  // Get facilities by type
  async getFacilitiesByType(type) {
    return this.getAllFacilities({ 
      filters: { type, active: true }
    });
  }

  // Get facilities by specialty
  async getFacilitiesBySpecialty(specialty) {
    return this.getAllFacilities({ 
      filters: { specialty, active: true }
    });
  }
}

module.exports = { FacilityService };