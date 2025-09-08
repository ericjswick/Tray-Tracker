const { CaseTypeModel } = require('../models/CaseType');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class CaseTypeService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'casetypes';
  }

  async createCaseType(caseTypeData, userId) {
    try {
      // Create case type model
      const caseTypeModel = new CaseTypeModel({
        ...caseTypeData,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId
      });

      // Save to Firestore
      const docRef = await this.db.collection(this.collection).add(caseTypeModel.toFirestore());
      
      return formatResponse({
        id: docRef.id,
        ...caseTypeModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create case type');
    }
  }

  async getCaseType(caseTypeId) {
    try {
      const doc = await this.db.collection(this.collection).doc(caseTypeId).get();
      
      if (!doc.exists) {
        throw new Error('Case type not found');
      }

      return formatResponse({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      throw handleError(error, 'Failed to get case type');
    }
  }

  async getAllCaseTypes(options = {}) {
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

      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }

      // Apply sorting
      query = query.orderBy(sortBy, sortOrder);

      // Apply pagination
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit);

      const snapshot = await query.get();
      const caseTypes = [];

      snapshot.forEach(doc => {
        caseTypes.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return formatResponse(caseTypes);
    } catch (error) {
      throw handleError(error, 'Failed to get case types');
    }
  }

  async updateCaseType(caseTypeId, updateData, userId) {
    try {
      const updateModel = {
        ...updateData,
        lastModified: new Date(),
        modifiedBy: userId
      };

      await this.db.collection(this.collection).doc(caseTypeId).update(updateModel);
      
      // Get updated document
      const updatedCaseType = await this.getCaseType(caseTypeId);
      
      return updatedCaseType;
    } catch (error) {
      throw handleError(error, 'Failed to update case type');
    }
  }

  async deleteCaseType(caseTypeId) {
    try {
      // Check if case type exists
      const doc = await this.db.collection(this.collection).doc(caseTypeId).get();
      if (!doc.exists) {
        throw new Error('Case type not found');
      }

      // Soft delete by setting active to false
      await this.db.collection(this.collection).doc(caseTypeId).update({
        active: false,
        deletedAt: new Date()
      });

      return formatResponse({ id: caseTypeId, deleted: true });
    } catch (error) {
      throw handleError(error, 'Failed to delete case type');
    }
  }

  async searchCaseTypes(searchTerm, options = {}) {
    try {
      const { limit = 50 } = options;
      
      // Simple text search on name and description
      const query = this.db.collection(this.collection)
        .where('name', '>=', searchTerm)
        .where('name', '<=', searchTerm + '\uf8ff')
        .limit(limit);

      const snapshot = await query.get();
      const caseTypes = [];

      snapshot.forEach(doc => {
        caseTypes.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return formatResponse(caseTypes);
    } catch (error) {
      throw handleError(error, 'Failed to search case types');
    }
  }

  async initializeDefaults(userId = null) {
    try {
      const defaults = CaseTypeModel.getDefaults();
      const results = [];

      for (const defaultData of defaults) {
        // Check if case type already exists
        const existingQuery = await this.db.collection(this.collection)
          .where('name', '==', defaultData.name)
          .limit(1)
          .get();

        if (existingQuery.empty) {
          const created = await this.createCaseType(defaultData, userId);
          results.push(created.data);
        }
      }

      return formatResponse({
        success: true,
        message: `Initialized ${results.length} default case types compatible with MyRepData-internal`,
        created: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to initialize default case types');
    }
  }
}

module.exports = CaseTypeService;