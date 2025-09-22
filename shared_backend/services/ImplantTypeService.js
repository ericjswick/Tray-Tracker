const { ImplantTypeModel } = require('../models/ImplantType');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class ImplantTypeService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'implant_types';
  }

  async createImplantType(implantTypeData, userId) {
    try {
      // Create implant type model
      const implantTypeModel = new ImplantTypeModel({
        ...implantTypeData,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        modifiedBy: userId
      });

      // Validate the model
      const validation = implantTypeModel.validate();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to Firestore
      const docRef = await this.db.collection(this.collection).add(implantTypeModel.toFirestore());

      return formatResponse({
        id: docRef.id,
        ...implantTypeModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create implant type');
    }
  }

  async getImplantType(implantTypeId) {
    try {
      const doc = await this.db.collection(this.collection).doc(implantTypeId).get();

      if (!doc.exists) {
        throw new Error('Implant type not found');
      }

      return formatResponse({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      throw handleError(error, 'Failed to get implant type');
    }
  }

  async getAllImplantTypes(options = {}) {
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
      if (filters.status !== undefined) {
        query = query.where('status', '==', filters.status);
      }

      // Apply sorting
      query = query.orderBy(sortBy, sortOrder);

      // Apply pagination
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit);

      const snapshot = await query.get();
      const implantTypes = [];

      snapshot.forEach(doc => {
        implantTypes.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return formatResponse(implantTypes);
    } catch (error) {
      throw handleError(error, 'Failed to get implant types');
    }
  }

  async updateImplantType(implantTypeId, updateData, userId) {
    try {
      // Create a model with the update data for validation
      const existingDoc = await this.db.collection(this.collection).doc(implantTypeId).get();
      if (!existingDoc.exists) {
        throw new Error('Implant type not found');
      }

      const existingData = existingDoc.data();
      const updatedModel = new ImplantTypeModel({
        ...existingData,
        ...updateData,
        id: implantTypeId
      });

      // Validate the updated model
      const validation = updatedModel.validate();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const updateModel = {
        ...updateData,
        updatedAt: new Date(),
        modifiedBy: userId
      };

      await this.db.collection(this.collection).doc(implantTypeId).update(updateModel);

      // Get updated document
      const updatedImplantType = await this.getImplantType(implantTypeId);

      return updatedImplantType;
    } catch (error) {
      throw handleError(error, 'Failed to update implant type');
    }
  }

  async deleteImplantType(implantTypeId, userId = null) {
    try {
      // Check if implant type exists
      const doc = await this.db.collection(this.collection).doc(implantTypeId).get();
      if (!doc.exists) {
        throw new Error('Implant type not found');
      }

      // Soft delete by setting status to inactive
      await this.db.collection(this.collection).doc(implantTypeId).update({
        status: 'inactive',
        deletedAt: new Date(),
        modifiedBy: userId,
        updatedAt: new Date()
      });

      return formatResponse({ id: implantTypeId, deleted: true });
    } catch (error) {
      throw handleError(error, 'Failed to delete implant type');
    }
  }

  async searchImplantTypes(searchTerm, options = {}) {
    try {
      const { limit = 50 } = options;

      // Simple text search on name
      const nameQuery = this.db.collection(this.collection)
        .where('name', '>=', searchTerm)
        .where('name', '<=', searchTerm + '\uf8ff')
        .limit(limit);

      const nameSnapshot = await nameQuery.get();
      const implantTypes = [];

      nameSnapshot.forEach(doc => {
        implantTypes.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return formatResponse(implantTypes);
    } catch (error) {
      throw handleError(error, 'Failed to search implant types');
    }
  }


  async getActiveImplantTypes(options = {}) {
    return this.getAllImplantTypes({
      ...options,
      filters: {
        ...options.filters,
        status: 'active'
      }
    });
  }

  async initializeDefaults(userId = null) {
    try {
      const defaults = ImplantTypeModel.getDefaults();
      const results = [];

      for (const defaultData of defaults) {
        // Check if implant type already exists
        const existingQuery = await this.db.collection(this.collection)
          .where('name', '==', defaultData.name)
          .limit(1)
          .get();

        if (existingQuery.empty) {
          const created = await this.createImplantType(defaultData, userId);
          results.push(created.data);
        }
      }

      return formatResponse({
        success: true,
        message: `Initialized ${results.length} default implant types`,
        created: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to initialize default implant types');
    }
  }

  async getImplantTypeStats() {
    try {
      // Get total count
      const totalSnapshot = await this.db.collection(this.collection).get();
      const total = totalSnapshot.size;

      // Get active count
      const activeSnapshot = await this.db.collection(this.collection)
        .where('status', '==', 'active')
        .get();
      const active = activeSnapshot.size;

      // Get inactive count
      const inactive = total - active;

      return formatResponse({
        total,
        active,
        inactive
      });
    } catch (error) {
      throw handleError(error, 'Failed to get implant type statistics');
    }
  }
}

module.exports = ImplantTypeService;