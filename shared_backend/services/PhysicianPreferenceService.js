const { PhysicianPreferenceModel } = require('../models/PhysicianPreference');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class PhysicianPreferenceService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'physician_preferences'; // MyRepData-compatible collection name
  }

  async createPhysicianPreference(preferenceData, userId) {
    try {
      const preferenceModel = new PhysicianPreferenceModel({
        ...preferenceData,
        createdBy: userId,
        created_at: new Date(),
        updated_at: new Date(),
        modifiedBy: userId
      });

      const validation = preferenceModel.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const docRef = await this.db.collection(this.collection).add(preferenceModel.toFirestore());
      
      return formatResponse({
        id: docRef.id,
        ...preferenceModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create physician preference');
    }
  }

  async getPhysicianPreference(preferenceId) {
    try {
      const doc = await this.db.collection(this.collection).doc(preferenceId).get();
      
      if (!doc.exists) {
        throw new Error('Physician preference not found');
      }

      const preference = PhysicianPreferenceModel.fromFirestore(doc);
      
      if (preference.deletedAt) {
        return null;
      }

      return formatResponse(preference.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to get physician preference');
    }
  }

  async getAllPhysicianPreferences(options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = 'case_type',
        sortOrder = 'asc',
        filters = {}
      } = options;

      let query = this.db.collection(this.collection);

      // Apply filters
      if (filters.physician_id) {
        query = query.where('physician_id', '==', filters.physician_id);
      }

      if (filters.case_type) {
        query = query.where('case_type', '==', filters.case_type);
      }

      if (filters.requirement_type) {
        query = query.where('requirement_type', '==', filters.requirement_type);
      }

      if (filters.tray_id) {
        query = query.where('tray_id', '==', filters.tray_id);
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
      const preferences = [];

      snapshot.forEach(doc => {
        const preference = PhysicianPreferenceModel.fromFirestore(doc);
        if (preference) {
          preferences.push(preference.toJSON());
        }
      });

      return formatResponse(preferences);
    } catch (error) {
      throw handleError(error, 'Failed to get physician preferences');
    }
  }

  async updatePhysicianPreference(preferenceId, updateData, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(preferenceId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Physician preference not found');
      }

      const existing = PhysicianPreferenceModel.fromFirestore(existingDoc);
      
      if (existing.deletedAt) {
        throw new Error('Cannot update deleted physician preference');
      }

      const updatedPreference = new PhysicianPreferenceModel({
        ...existing.toJSON(),
        ...updateData,
        id: preferenceId,
        updated_at: new Date(),
        modifiedBy: userId
      });

      const validation = updatedPreference.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      await this.db.collection(this.collection).doc(preferenceId).update(updatedPreference.toFirestore());
      
      return formatResponse(updatedPreference.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to update physician preference');
    }
  }

  async deletePhysicianPreference(preferenceId, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(preferenceId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Physician preference not found');
      }

      // Soft delete
      await this.db.collection(this.collection).doc(preferenceId).update({
        deletedAt: new Date(),
        updated_at: new Date(),
        modifiedBy: userId
      });

      return formatResponse({ success: true, message: 'Physician preference deleted successfully' });
    } catch (error) {
      throw handleError(error, 'Failed to delete physician preference');
    }
  }

  // MyRepData-compatible method: get preferences by physician ID
  async getPreferencesByPhysicianId(physicianId) {
    try {
      const preferences = await this.getAllPhysicianPreferences({ 
        filters: { physician_id: physicianId }
      });
      
      return preferences;
    } catch (error) {
      throw handleError(error, 'Failed to get preferences by physician ID');
    }
  }

  // MyRepData-compatible method: get preferences by physician and case type
  async getPreferencesByPhysicianAndCaseType(physicianId, caseType) {
    try {
      const preferences = await this.getAllPhysicianPreferences({ 
        filters: { 
          physician_id: physicianId,
          case_type: caseType 
        }
      });
      
      return preferences;
    } catch (error) {
      throw handleError(error, 'Failed to get preferences by physician and case type');
    }
  }

  // Bulk create preferences for a physician
  async bulkCreatePreferences(physicianId, preferences, userId) {
    try {
      const results = [];
      
      for (const prefData of preferences) {
        const preferenceData = {
          ...prefData,
          physician_id: physicianId
        };
        
        const created = await this.createPhysicianPreference(preferenceData, userId);
        results.push(created.data);
      }

      return formatResponse({
        success: true,
        created: results.length,
        preferences: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to bulk create preferences');
    }
  }

  // Delete all preferences for a physician
  async deletePreferencesByPhysicianId(physicianId, userId) {
    try {
      const preferences = await this.getPreferencesByPhysicianId(physicianId);
      const deletedCount = preferences.data.length;
      
      for (const preference of preferences.data) {
        await this.deletePhysicianPreference(preference.id, userId);
      }

      return formatResponse({
        success: true,
        message: `Deleted ${deletedCount} preferences for physician: ${physicianId}`,
        deleted: deletedCount
      });
    } catch (error) {
      throw handleError(error, 'Failed to delete preferences by physician ID');
    }
  }

  // Delete preferences by physician and case type
  async deletePreferencesByPhysicianAndCaseType(physicianId, caseType, userId) {
    try {
      const preferences = await this.getPreferencesByPhysicianAndCaseType(physicianId, caseType);
      const deletedCount = preferences.data.length;
      
      for (const preference of preferences.data) {
        await this.deletePhysicianPreference(preference.id, userId);
      }

      return formatResponse({
        success: true,
        message: `Deleted ${deletedCount} preferences for physician ${physicianId} and case type ${caseType}`,
        deleted: deletedCount
      });
    } catch (error) {
      throw handleError(error, 'Failed to delete preferences by physician and case type');
    }
  }

  // Update physician's preferences for a specific case type (replace all)
  async updatePhysicianCaseTypePreferences(physicianId, caseType, preferences, userId) {
    try {
      // Delete existing preferences for this physician/case type
      await this.deletePreferencesByPhysicianAndCaseType(physicianId, caseType, userId);
      
      // Create new preferences
      const results = [];
      for (const prefData of preferences) {
        const preferenceData = {
          ...prefData,
          physician_id: physicianId,
          case_type: caseType
        };
        
        const created = await this.createPhysicianPreference(preferenceData, userId);
        results.push(created.data);
      }

      return formatResponse({
        success: true,
        message: `Updated ${results.length} preferences for physician ${physicianId} and case type ${caseType}`,
        preferences: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to update physician case type preferences');
    }
  }

  // Get statistics about physician preferences
  async getStats() {
    try {
      const allPreferences = await this.getAllPhysicianPreferences();
      
      const stats = {
        total: allPreferences.data.length,
        byType: {
          required: 0,
          preferred: 0,
          optional: 0
        },
        byCaseType: {},
        totalUniquePhysicians: new Set(allPreferences.data.map(pref => pref.physician_id)).size,
        totalUniqueTrays: new Set(allPreferences.data.map(pref => pref.tray_id)).size
      };

      allPreferences.data.forEach(preference => {
        // Count by requirement type
        if (stats.byType[preference.requirement_type] !== undefined) {
          stats.byType[preference.requirement_type]++;
        }

        // Count by case type
        if (preference.case_type) {
          if (!stats.byCaseType[preference.case_type]) {
            stats.byCaseType[preference.case_type] = 0;
          }
          stats.byCaseType[preference.case_type]++;
        }
      });

      return formatResponse(stats);
    } catch (error) {
      throw handleError(error, 'Failed to get physician preferences statistics');
    }
  }

  // Get preferences summary for a physician (grouped by case type)
  async getPhysicianPreferencesSummary(physicianId) {
    try {
      const preferences = await this.getPreferencesByPhysicianId(physicianId);
      
      const summary = {};
      preferences.data.forEach(pref => {
        if (!summary[pref.case_type]) {
          summary[pref.case_type] = {
            case_type: pref.case_type,
            preferences: [],
            total: 0,
            required: 0,
            preferred: 0,
            optional: 0
          };
        }
        
        summary[pref.case_type].preferences.push(pref);
        summary[pref.case_type].total++;
        summary[pref.case_type][pref.requirement_type]++;
      });

      return formatResponse({
        physician_id: physicianId,
        total_case_types: Object.keys(summary).length,
        total_preferences: preferences.data.length,
        by_case_type: summary
      });
    } catch (error) {
      throw handleError(error, 'Failed to get physician preferences summary');
    }
  }
}

module.exports = { PhysicianPreferenceService };