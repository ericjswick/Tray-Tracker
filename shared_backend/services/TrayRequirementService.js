const { TrayRequirementModel } = require('../models/TrayRequirement');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class TrayRequirementService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'tray_requirements'; // MyRepData-compatible collection name
  }

  async createTrayRequirement(requirementData, userId) {
    try {
      const requirementModel = new TrayRequirementModel({
        ...requirementData,
        createdBy: userId,
        created_at: new Date(),
        updated_at: new Date(),
        modifiedBy: userId
      });

      const validation = requirementModel.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const docRef = await this.db.collection(this.collection).add(requirementModel.toFirestore());
      
      return formatResponse({
        id: docRef.id,
        ...requirementModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create tray requirement');
    }
  }

  async getTrayRequirement(requirementId) {
    try {
      const doc = await this.db.collection(this.collection).doc(requirementId).get();
      
      if (!doc.exists) {
        throw new Error('Tray requirement not found');
      }

      const requirement = TrayRequirementModel.fromFirestore(doc);
      
      if (requirement.deletedAt) {
        return null;
      }

      return formatResponse(requirement.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to get tray requirement');
    }
  }

  async getAllTrayRequirements(options = {}) {
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
      const requirements = [];

      snapshot.forEach(doc => {
        const requirement = TrayRequirementModel.fromFirestore(doc);
        if (requirement) {
          requirements.push(requirement.toJSON());
        }
      });

      return formatResponse(requirements);
    } catch (error) {
      throw handleError(error, 'Failed to get tray requirements');
    }
  }

  async updateTrayRequirement(requirementId, updateData, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(requirementId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Tray requirement not found');
      }

      const existing = TrayRequirementModel.fromFirestore(existingDoc);
      
      if (existing.deletedAt) {
        throw new Error('Cannot update deleted tray requirement');
      }

      const updatedRequirement = new TrayRequirementModel({
        ...existing.toJSON(),
        ...updateData,
        id: requirementId,
        updated_at: new Date(),
        modifiedBy: userId
      });

      const validation = updatedRequirement.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      await this.db.collection(this.collection).doc(requirementId).update(updatedRequirement.toFirestore());
      
      return formatResponse(updatedRequirement.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to update tray requirement');
    }
  }

  async deleteTrayRequirement(requirementId, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(requirementId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Tray requirement not found');
      }

      // Soft delete
      await this.db.collection(this.collection).doc(requirementId).update({
        deletedAt: new Date(),
        updated_at: new Date(),
        modifiedBy: userId
      });

      return formatResponse({ success: true, message: 'Tray requirement deleted successfully' });
    } catch (error) {
      throw handleError(error, 'Failed to delete tray requirement');
    }
  }

  // MyRepData-compatible method: get requirements by case type
  async getRequirementsByCaseType(caseType) {
    try {
      const requirements = await this.getAllTrayRequirements({ 
        filters: { case_type: caseType }
      });
      
      return requirements;
    } catch (error) {
      throw handleError(error, 'Failed to get requirements by case type');
    }
  }

  // MyRepData-compatible method: get requirements by tray ID
  async getRequirementsByTrayId(trayId) {
    try {
      const requirements = await this.getAllTrayRequirements({ 
        filters: { tray_id: trayId }
      });
      
      return requirements;
    } catch (error) {
      throw handleError(error, 'Failed to get requirements by tray ID');
    }
  }

  // Initialize default tray requirements for MyRepData case types
  async initializeDefaults(userId = null) {
    try {
      const defaults = TrayRequirementModel.getDefaultRequirements();
      const results = [];

      for (const defaultData of defaults) {
        // Check if requirement already exists
        const existing = await this.getAllTrayRequirements({ 
          filters: { 
            case_type: defaultData.case_type,
            tray_id: defaultData.tray_id 
          }
        });

        if (existing.data.length === 0) {
          const created = await this.createTrayRequirement(defaultData, userId);
          results.push(created.data);
        }
      }

      return formatResponse({
        success: true,
        message: `Initialized ${results.length} default tray requirements compatible with MyRepData-internal`,
        created: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to initialize default tray requirements');
    }
  }

  // Merge tray requirements with physician preferences (MyRepData logic)
  async mergeTrayRequirementsWithPreferences(caseType, physicianId, physicianPrefs = []) {
    try {
      // Get default requirements for case type
      const defaultRequirements = await this.getRequirementsByCaseType(caseType);
      
      // Start with default requirements
      let mergedRequirements = [...defaultRequirements.data];
      
      // Apply physician preferences (would integrate with physician_preferences collection)
      if (physicianPrefs && physicianPrefs.length > 0) {
        physicianPrefs.forEach(pref => {
          const existingIndex = mergedRequirements.findIndex(req => req.tray_id === pref.tray_id);
          
          if (existingIndex >= 0) {
            // Override existing requirement with preference
            mergedRequirements[existingIndex] = {
              ...mergedRequirements[existingIndex],
              requirement_type: pref.requirement_type,
              quantity: pref.quantity || mergedRequirements[existingIndex].quantity,
              notes: pref.notes || mergedRequirements[existingIndex].notes
            };
          } else {
            // Add new preference requirement
            mergedRequirements.push({
              case_type: caseType,
              tray_id: pref.tray_id,
              tray_name: pref.tray_name || pref.tray_id,
              requirement_type: pref.requirement_type,
              quantity: pref.quantity || 1,
              priority: pref.priority || 5,
              notes: pref.notes || 'Physician preference'
            });
          }
        });
      }
      
      // Sort by priority and requirement type
      mergedRequirements.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        const typeOrder = { 'required': 1, 'preferred': 2, 'optional': 3 };
        return (typeOrder[a.requirement_type] || 3) - (typeOrder[b.requirement_type] || 3);
      });
      
      return formatResponse(mergedRequirements);
    } catch (error) {
      throw handleError(error, 'Failed to merge tray requirements with preferences');
    }
  }

  // Get statistics about tray requirements
  async getStats() {
    try {
      const allRequirements = await this.getAllTrayRequirements();
      
      const stats = {
        total: allRequirements.data.length,
        byType: {
          required: 0,
          preferred: 0,
          optional: 0
        },
        byCaseType: {},
        totalUniqueTrays: new Set(allRequirements.data.map(req => req.tray_id)).size
      };

      allRequirements.data.forEach(requirement => {
        // Count by requirement type
        if (stats.byType[requirement.requirement_type] !== undefined) {
          stats.byType[requirement.requirement_type]++;
        }

        // Count by case type
        if (requirement.case_type) {
          if (!stats.byCaseType[requirement.case_type]) {
            stats.byCaseType[requirement.case_type] = 0;
          }
          stats.byCaseType[requirement.case_type]++;
        }
      });

      return formatResponse(stats);
    } catch (error) {
      throw handleError(error, 'Failed to get tray requirements statistics');
    }
  }

  // Bulk create requirements for a case type
  async bulkCreateRequirements(caseType, requirements, userId) {
    try {
      const results = [];
      
      for (const reqData of requirements) {
        const requirementData = {
          ...reqData,
          case_type: caseType
        };
        
        const created = await this.createTrayRequirement(requirementData, userId);
        results.push(created.data);
      }

      return formatResponse({
        success: true,
        created: results.length,
        requirements: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to bulk create requirements');
    }
  }

  // Delete all requirements for a case type
  async deleteRequirementsByCaseType(caseType, userId) {
    try {
      const requirements = await this.getRequirementsByCaseType(caseType);
      const deletedCount = requirements.data.length;
      
      for (const requirement of requirements.data) {
        await this.deleteTrayRequirement(requirement.id, userId);
      }

      return formatResponse({
        success: true,
        message: `Deleted ${deletedCount} requirements for case type: ${caseType}`,
        deleted: deletedCount
      });
    } catch (error) {
      throw handleError(error, 'Failed to delete requirements by case type');
    }
  }
}

module.exports = { TrayRequirementService };