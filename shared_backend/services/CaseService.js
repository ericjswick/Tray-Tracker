const { validateCase, validateCaseUpdate } = require('../validators/caseValidators');
const { CaseModel } = require('../models/Case');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class CaseService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'cases';
  }

  async createCase(caseData, userId) {
    try {
      // Validate input
      const validation = validateCase(caseData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Create case model
      const caseModel = new CaseModel({
        ...caseData,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId
      });

      // Save to Firestore
      const docRef = await this.db.collection(this.collection).add(caseModel.toFirestore());
      
      return formatResponse({
        id: docRef.id,
        ...caseModel.toJSON()
      });
    } catch (error) {
      throw handleError('Failed to create case', error);
    }
  }

  async getCaseById(caseId) {
    try {
      const doc = await this.db.collection(this.collection).doc(caseId).get();
      
      if (!doc.exists) {
        throw new Error('Case not found');
      }

      return formatResponse({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      throw handleError('Failed to get case', error);
    }
  }

  async getAllCases(filters = {}, pagination = {}) {
    try {
      let query = this.db.collection(this.collection);

      // Apply filters
      if (filters.surgeonId) {
        query = query.where('surgeonId', '==', filters.surgeonId);
      }
      if (filters.facilityId) {
        query = query.where('facilityId', '==', filters.facilityId);
      }
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.startDate && filters.endDate) {
        query = query
          .where('scheduledDate', '>=', filters.startDate)
          .where('scheduledDate', '<=', filters.endDate);
      }

      // Apply ordering
      query = query.orderBy('scheduledDate', 'desc');

      // Apply pagination
      if (pagination.limit) {
        query = query.limit(pagination.limit);
      }
      if (pagination.offset) {
        query = query.offset(pagination.offset);
      }

      const snapshot = await query.get();
      const cases = [];

      snapshot.forEach(doc => {
        cases.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return formatResponse(cases);
    } catch (error) {
      throw handleError('Failed to get cases', error);
    }
  }

  async updateCase(caseId, updates, userId) {
    try {
      // Validate input
      const validation = validateCaseUpdate(updates);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if case exists
      const caseDoc = await this.db.collection(this.collection).doc(caseId).get();
      if (!caseDoc.exists) {
        throw new Error('Case not found');
      }

      // Prepare update data
      const updateData = {
        ...updates,
        lastModified: new Date(),
        modifiedBy: userId
      };

      // Update case
      await this.db.collection(this.collection).doc(caseId).update(updateData);

      // Return updated case
      return this.getCaseById(caseId);
    } catch (error) {
      throw handleError('Failed to update case', error);
    }
  }

  async deleteCase(caseId, userId) {
    try {
      // Check if case exists
      const caseDoc = await this.db.collection(this.collection).doc(caseId).get();
      if (!caseDoc.exists) {
        throw new Error('Case not found');
      }

      // Soft delete - mark as deleted instead of removing
      await this.db.collection(this.collection).doc(caseId).update({
        deleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        lastModified: new Date(),
        modifiedBy: userId
      });

      return formatResponse({ message: 'Case deleted successfully' });
    } catch (error) {
      throw handleError('Failed to delete case', error);
    }
  }

  async getCasesByDateRange(startDate, endDate, filters = {}) {
    try {
      const casesResponse = await this.getAllCases({
        ...filters,
        startDate,
        endDate
      });
      
      return casesResponse;
    } catch (error) {
      throw handleError('Failed to get cases by date range', error);
    }
  }

  async getCasesBySurgeon(surgeonId, filters = {}) {
    try {
      const casesResponse = await this.getAllCases({
        ...filters,
        surgeonId
      });
      
      return casesResponse;
    } catch (error) {
      throw handleError('Failed to get cases by surgeon', error);
    }
  }

  async getCasesByFacility(facilityId, filters = {}) {
    try {
      const casesResponse = await this.getAllCases({
        ...filters,
        facilityId
      });
      
      return casesResponse;
    } catch (error) {
      throw handleError('Failed to get cases by facility', error);
    }
  }
}

module.exports = CaseService;