const { TrayModel } = require('../models/Tray');
const { formatResponse, handleError } = require('../utils/responseHelpers');

class TrayService {
  constructor(firestore) {
    this.db = firestore;
    this.collection = 'trays';
  }

  async createTray(trayData, userId) {
    try {
      const trayModel = new TrayModel({
        ...trayData,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId
      });

      const validation = trayModel.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const docRef = await this.db.collection(this.collection).add(trayModel.toFirestore());
      
      return formatResponse({
        id: docRef.id,
        ...trayModel.toJSON()
      });
    } catch (error) {
      throw handleError(error, 'Failed to create tray');
    }
  }

  async getTray(trayId) {
    try {
      const doc = await this.db.collection(this.collection).doc(trayId).get();
      
      if (!doc.exists) {
        throw new Error('Tray not found');
      }

      const tray = TrayModel.fromFirestore(doc);
      
      if (tray.deletedAt) {
        return null;
      }

      return formatResponse(tray.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to get tray');
    }
  }

  async getAllTrays(options = {}) {
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
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }

      if (filters.assignedTo) {
        query = query.where('assignedTo', '==', filters.assignedTo);
      }

      if (filters.facility) {
        query = query.where('facility', '==', filters.facility);
      }

      if (filters.surgeon) {
        query = query.where('surgeon', '==', filters.surgeon);
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
      const trays = [];

      snapshot.forEach(doc => {
        const tray = TrayModel.fromFirestore(doc);
        if (tray) {
          trays.push(tray.toJSON());
        }
      });

      return formatResponse(trays);
    } catch (error) {
      throw handleError(error, 'Failed to get trays');
    }
  }

  async updateTray(trayId, updateData, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(trayId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Tray not found');
      }

      const existing = TrayModel.fromFirestore(existingDoc);
      
      if (existing.deletedAt) {
        throw new Error('Cannot update deleted tray');
      }

      const updatedTray = new TrayModel({
        ...existing.toJSON(),
        ...updateData,
        id: trayId,
        lastModified: new Date(),
        modifiedBy: userId
      });

      const validation = updatedTray.isValid();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      await this.db.collection(this.collection).doc(trayId).update(updatedTray.toFirestore());
      
      return formatResponse(updatedTray.toJSON());
    } catch (error) {
      throw handleError(error, 'Failed to update tray');
    }
  }

  async deleteTray(trayId, userId) {
    try {
      const existingDoc = await this.db.collection(this.collection).doc(trayId).get();
      
      if (!existingDoc.exists) {
        throw new Error('Tray not found');
      }

      // Soft delete
      await this.db.collection(this.collection).doc(trayId).update({
        deletedAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId
      });

      return formatResponse({ success: true, message: 'Tray deleted successfully' });
    } catch (error) {
      throw handleError(error, 'Failed to delete tray');
    }
  }

  async searchTrays(searchTerm, filters = {}) {
    try {
      const allTrays = await this.getAllTrays({ filters });
      
      if (!searchTerm) {
        return allTrays;
      }

      const searchLower = searchTerm.toLowerCase();
      const filtered = allTrays.data.filter(tray => 
        tray.name?.toLowerCase().includes(searchLower) ||
        tray.type?.toLowerCase().includes(searchLower) ||
        tray.status?.toLowerCase().includes(searchLower) ||
        tray.location?.toLowerCase().includes(searchLower) ||
        tray.surgeon?.toLowerCase().includes(searchLower) ||
        tray.facility?.toLowerCase().includes(searchLower) ||
        tray.notes?.toLowerCase().includes(searchLower)
      );

      return formatResponse(filtered);
    } catch (error) {
      throw handleError(error, 'Failed to search trays');
    }
  }

  // MyRepData-compatible method: check in tray to facility
  async checkinTray(trayId, checkinData, userId) {
    try {
      const updateData = {
        status: 'in-use',
        facility: checkinData.facility,
        caseDate: checkinData.caseDate,
        surgeon: checkinData.surgeon,
        checkinPhotoUrl: checkinData.photoUrl || '',
        notes: checkinData.notes || ''
      };

      return await this.updateTray(trayId, updateData, userId);
    } catch (error) {
      throw handleError(error, 'Failed to check in tray');
    }
  }

  // MyRepData-compatible method: pick up tray from facility
  async pickupTray(trayId, pickupData, userId) {
    try {
      const updateData = {
        status: 'available',
        facility: '',
        caseDate: '',
        surgeon: '',
        location: pickupData.location || 'trunk',
        pickupPhotoUrl: pickupData.photoUrl || '',
        notes: pickupData.notes || ''
      };

      return await this.updateTray(trayId, updateData, userId);
    } catch (error) {
      throw handleError(error, 'Failed to pick up tray');
    }
  }

  // Initialize default trays
  async initializeDefaults(userId = null) {
    try {
      const defaults = TrayModel.getDefaults();
      const results = [];

      for (const defaultData of defaults) {
        const existing = await this.searchTrays(defaultData.name);
        const duplicateFound = existing.data.some(t => 
          t.name === defaultData.name && t.type === defaultData.type
        );

        if (!duplicateFound) {
          const created = await this.createTray(defaultData, userId);
          results.push(created.data);
        }
      }

      return formatResponse({
        success: true,
        message: `Initialized ${results.length} default trays compatible with MyRepData-internal`,
        created: results
      });
    } catch (error) {
      throw handleError(error, 'Failed to initialize default trays');
    }
  }

  // Get statistics about trays
  async getStats() {
    try {
      const allTrays = await this.getAllTrays();
      
      const stats = {
        total: allTrays.data.length,
        byStatus: {
          available: 0,
          'in-use': 0,
          corporate: 0,
          trunk: 0
        },
        byType: {
          fusion: 0,
          revision: 0,
          mi: 0,
          complete: 0
        }
      };

      allTrays.data.forEach(tray => {
        if (stats.byStatus[tray.status] !== undefined) {
          stats.byStatus[tray.status]++;
        }

        if (stats.byType[tray.type] !== undefined) {
          stats.byType[tray.type]++;
        }
      });

      return formatResponse(stats);
    } catch (error) {
      throw handleError(error, 'Failed to get tray statistics');
    }
  }

  // Get trays by status (MyRepData compatibility)
  async getTraysByStatus(status) {
    return this.getAllTrays({ 
      filters: { status }
    });
  }

  // Get trays by type
  async getTraysByType(type) {
    return this.getAllTrays({ 
      filters: { type }
    });
  }

  // Get available trays
  async getAvailableTrays() {
    return this.getTraysByStatus('available');
  }

  // Get trays in use
  async getTraysInUse() {
    return this.getTraysByStatus('in-use');
  }

  // Get trays by surgeon
  async getTraysBySurgeon(surgeonId) {
    return this.getAllTrays({
      filters: { surgeon: surgeonId }
    });
  }

  // Get trays at facility
  async getTraysAtFacility(facilityId) {
    return this.getAllTrays({
      filters: { facility: facilityId }
    });
  }

  // Get trays assigned to user
  async getTraysByAssignedUser(userId) {
    return this.getAllTrays({
      filters: { assignedTo: userId }
    });
  }
}

module.exports = { TrayService };