const { SurgeonModel } = require('../models/Surgeon');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class SurgeonService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'surgeons';
  }

  async createSurgeon(surgeonData, userId) {
    try {
      const surgeonModel = new SurgeonModel({
        ...surgeonData,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId
      });

      const validation = surgeonModel.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const docRef = await this.db.collection(this.collection).add(surgeonModel.toFirestore());
      
      return formatResponse({
        id: docRef.id,
        ...surgeonModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create surgeon');
    }
  }

  async getSurgeon(surgeonId) {
    try {
      const doc = await this.db.collection(this.collection).doc(surgeonId).get();
      
      if (!doc.exists) {
        throw new Error('Surgeon not found');
      }

      const surgeon = SurgeonModel.fromFirestore(doc);
      
      if (surgeon.deletedAt) {
        return null;
      }

      return formatResponse(surgeon.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to get surgeon');
    }
  }

  async getAllSurgeons(options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = 'name',
        sortOrder = 'asc',
        filters = {}
      } = options;

      let query = this.db.collection(this.collection);

      // Apply filters
      if (filters.active !== undefined) {
        query = query.where('active', '==', filters.active);
      }

      if (filters.specialty) {
        query = query.where('specialty', '==', filters.specialty);
      }

      if (filters.region) {
        query = query.where('region', '==', filters.region);
      }

      if (filters.hospital) {
        query = query.where('hospital', '==', filters.hospital);
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
      const surgeons = [];

      snapshot.forEach(doc => {
        const surgeon = SurgeonModel.fromFirestore(doc);
        if (surgeon) {
          surgeons.push(surgeon.toJSON());
        }
      });

      return formatResponse(surgeons);
    } catch (error) {
      throw handleError(error, 'Failed to get surgeons');
    }
  }

  async updateSurgeon(surgeonId, updateData, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(surgeonId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Surgeon not found');
      }

      const existing = SurgeonModel.fromFirestore(existingDoc);
      
      if (existing.deletedAt) {
        throw new Error('Cannot update deleted surgeon');
      }

      const updatedSurgeon = new SurgeonModel({
        ...existing.toJSON(),
        ...updateData,
        id: surgeonId,
        lastModified: new Date(),
        modifiedBy: userId
      });

      const validation = updatedSurgeon.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      await this.db.collection(this.collection).doc(surgeonId).update(updatedSurgeon.toFirestore());
      
      return formatResponse(updatedSurgeon.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to update surgeon');
    }
  }

  async deleteSurgeon(surgeonId, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(surgeonId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Surgeon not found');
      }

      // Soft delete
      await this.db.collection(this.collection).doc(surgeonId).update({
        deletedAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId,
        active: false
      });

      return formatResponse({ success: true, message: 'Surgeon deleted successfully' });
    } catch (error) {
      throw handleError(error, 'Failed to delete surgeon');
    }
  }

  async searchSurgeons(searchTerm, filters = {}) {
    try {
      const allSurgeons = await this.getAllSurgeons({ filters });
      
      if (!searchTerm) {
        return allSurgeons;
      }

      const searchLower = searchTerm.toLowerCase();
      const filtered = allSurgeons.data.filter(surgeon => 
        surgeon.name?.toLowerCase().includes(searchLower) ||
        surgeon.hospital?.toLowerCase().includes(searchLower) ||
        surgeon.specialty?.toLowerCase().includes(searchLower) ||
        surgeon.region?.toLowerCase().includes(searchLower) ||
        surgeon.notes?.toLowerCase().includes(searchLower)
      );

      return formatResponse(filtered);
    } catch (error) {
      throw handleError(error, 'Failed to search surgeons');
    }
  }

  // Update surgeon's preferred case types
  async updateSurgeonPreferences(surgeonId, caseTypeIds, userId) {
    try {
      const preferredCases = Array.isArray(caseTypeIds) ? caseTypeIds.join(',') : '';
      
      return await this.updateSurgeon(surgeonId, { preferredCases }, userId);
    } catch (error) {
      throw handleError(error, 'Failed to update surgeon preferences');
    }
  }

  // Get surgeon's preferred case types as array
  async getSurgeonPreferences(surgeonId) {
    try {
      const surgeonResult = await this.getSurgeon(surgeonId);
      
      if (!surgeonResult) {
        throw new Error('Surgeon not found');
      }

      const surgeon = new SurgeonModel(surgeonResult.data);
      const preferredCaseTypes = surgeon.getPreferredCaseTypesArray();

      return formatResponse({
        surgeonId,
        preferredCaseTypes,
        preferredCasesString: surgeon.preferredCases
      });
    } catch (error) {
      throw handleError(error, 'Failed to get surgeon preferences');
    }
  }

  // Initialize default surgeons
  async initializeDefaults(userId = null) {
    try {
      const defaults = SurgeonModel.getDefaults();
      const results = [];

      for (const defaultData of defaults) {
        const existing = await this.searchSurgeons(defaultData.name);
        const duplicateFound = existing.data.some(s => 
          s.name === defaultData.name && s.hospital === defaultData.hospital
        );

        if (!duplicateFound) {
          const created = await this.createSurgeon(defaultData, userId);
          results.push(created.data);
        }
      }

      return formatResponse({
        success: true,
        message: `Initialized ${results.length} default surgeons compatible with MyRepData-internal`,
        created: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to initialize default surgeons');
    }
  }

  // Get statistics about surgeons
  async getStats() {
    try {
      const allSurgeons = await this.getAllSurgeons({ filters: { active: true } });
      
      const stats = {
        total: allSurgeons.data.length,
        bySpecialty: {},
        byRegion: {},
        byTitle: {},
        averageExperience: 0
      };

      let totalExperience = 0;
      let experienceCount = 0;

      allSurgeons.data.forEach(surgeon => {
        // Count by specialty
        if (surgeon.specialty) {
          if (!stats.bySpecialty[surgeon.specialty]) {
            stats.bySpecialty[surgeon.specialty] = 0;
          }
          stats.bySpecialty[surgeon.specialty]++;
        }

        // Count by region
        if (surgeon.region) {
          if (!stats.byRegion[surgeon.region]) {
            stats.byRegion[surgeon.region] = 0;
          }
          stats.byRegion[surgeon.region]++;
        }

        // Count by title
        if (surgeon.title) {
          if (!stats.byTitle[surgeon.title]) {
            stats.byTitle[surgeon.title] = 0;
          }
          stats.byTitle[surgeon.title]++;
        }

        // Calculate average experience
        if (surgeon.yearsExperience) {
          totalExperience += surgeon.yearsExperience;
          experienceCount++;
        }
      });

      if (experienceCount > 0) {
        stats.averageExperience = Math.round(totalExperience / experienceCount);
      }

      return formatResponse(stats);
    } catch (error) {
      throw handleError(error, 'Failed to get surgeon statistics');
    }
  }

  // Get surgeons by specialty (MyRepData compatibility)
  async getSurgeonsBySpecialty(specialty) {
    return this.getAllSurgeons({ 
      filters: { specialty, active: true }
    });
  }

  // Get surgeons by region
  async getSurgeonsByRegion(region) {
    return this.getAllSurgeons({ 
      filters: { region, active: true }
    });
  }

  // Get surgeons by hospital
  async getSurgeonsByHospital(hospital) {
    return this.getAllSurgeons({
      filters: { hospital, active: true }
    });
  }

  // Get active surgeons
  async getActiveSurgeons() {
    return this.getAllSurgeons({
      filters: { active: true }
    });
  }

  // Get surgeons with specific case type preference
  async getSurgeonsWithCaseTypePreference(caseTypeId) {
    try {
      const allSurgeons = await this.getActiveSurgeons();
      
      const filtered = allSurgeons.data.filter(surgeon => {
        const surgeonModel = new SurgeonModel(surgeon);
        return surgeonModel.hasPreferredCaseType(caseTypeId);
      });

      return formatResponse(filtered);
    } catch (error) {
      throw handleError(error, 'Failed to get surgeons with case type preference');
    }
  }

  // Bulk update preferences for multiple surgeons
  async bulkUpdatePreferences(updates, userId) {
    try {
      const results = [];
      
      for (const update of updates) {
        const { surgeonId, caseTypeIds } = update;
        const result = await this.updateSurgeonPreferences(surgeonId, caseTypeIds, userId);
        results.push(result.data);
      }

      return formatResponse({
        success: true,
        updated: results.length,
        results
      });
    } catch (error) {
      throw handleError(error, 'Failed to bulk update surgeon preferences');
    }
  }
}

module.exports = { SurgeonService };