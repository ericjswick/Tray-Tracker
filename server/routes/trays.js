const express = require('express');
const router = express.Router();
const debugLogger = require('../utils/debugLogger');

// GET /api/trays - Get all trays with comprehensive logging
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  
  try {
    debugLogger.info(`🔧 Trays GET request started`, { 
      requestId,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'trays-get-all');

    // Get all trays from Firestore
    const traysCollection = req.firestore.collection('trays');
    let query = traysCollection;

    // Add filters if provided
    if (req.query.case_type) {
      query = query.where('case_type', '==', req.query.case_type);
      debugLogger.debug(`🔧 Applied case_type filter: ${req.query.case_type}`, { requestId }, 'trays-filter');
    }

    if (req.query.active !== undefined) {
      const isActive = req.query.active === 'true';
      query = query.where('active', '==', isActive);
      debugLogger.debug(`🔧 Applied active filter: ${isActive}`, { requestId }, 'trays-filter');
    }

    // Filter out deleted trays
    query = query.where('deletedAt', '==', null);

    // Execute query
    const snapshot = await query.get();
    const trays = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      trays.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.() || data.created_at,
        updated_at: data.updated_at?.toDate?.() || data.updated_at
      });
    });

    // Sort by tray_name
    trays.sort((a, b) => (a.tray_name || '').localeCompare(b.tray_name || ''));

    const duration = Date.now() - startTime;
    debugLogger.info(`🔧 Trays retrieved successfully`, { 
      requestId,
      count: trays.length,
      duration: `${duration}ms`,
      caseTypeFilter: req.query.case_type,
      activeFilter: req.query.active
    }, 'trays-success');

    res.json({
      success: true,
      data: trays,
      count: trays.length,
      message: `Retrieved ${trays.length} trays`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🔧❌ Failed to retrieve trays', error, 'trays-error');
    debugLogger.error('🔧❌ Trays query failed', { 
      requestId,
      error: error.message,
      duration: `${duration}ms`,
      query: req.query
    }, 'trays-query-error');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve trays',
        code: 'TRAYS_QUERY_FAILED'
      }
    });
  }
});

// GET /api/trays/:id - Get specific tray with logging
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const trayId = req.params.id;
  
  try {
    debugLogger.info(`🔧 Tray GET by ID request started`, { 
      requestId,
      trayId,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'tray-get-by-id');

    const trayDoc = await req.firestore.collection('trays').doc(trayId).get();

    if (!trayDoc.exists) {
      debugLogger.warn(`🔧⚠️ Tray not found: ${trayId}`, { requestId, trayId }, 'tray-not-found');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tray not found',
          code: 'TRAY_NOT_FOUND'
        }
      });
    }

    const trayData = trayDoc.data();
    
    // Check if deleted
    if (trayData.deletedAt) {
      debugLogger.warn(`🔧⚠️ Tray is deleted: ${trayId}`, { requestId, trayId, deletedAt: trayData.deletedAt }, 'tray-deleted');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tray not found',
          code: 'TRAY_NOT_FOUND'
        }
      });
    }

    const tray = {
      id: trayDoc.id,
      ...trayData,
      created_at: trayData.created_at?.toDate?.() || trayData.created_at,
      updated_at: trayData.updated_at?.toDate?.() || trayData.updated_at
    };

    const duration = Date.now() - startTime;
    debugLogger.info(`🔧 Tray retrieved successfully`, { 
      requestId,
      trayId,
      trayName: tray.tray_name,
      duration: `${duration}ms`
    }, 'tray-success');

    res.json({
      success: true,
      data: tray
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🔧❌ Failed to retrieve tray', error, 'tray-error');
    debugLogger.error('🔧❌ Tray query failed', { 
      requestId,
      trayId,
      error: error.message,
      duration: `${duration}ms`
    }, 'tray-query-error');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve tray',
        code: 'TRAY_QUERY_FAILED'
      }
    });
  }
});

// POST /api/trays - Create new tray with logging
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  
  try {
    debugLogger.info(`🔧 Tray POST request started`, { 
      requestId,
      body: req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'tray-create');

    const trayData = {
      ...req.body,
      created_at: new Date(),
      updated_at: new Date(),
      deletedAt: null
    };

    const docRef = await req.firestore.collection('trays').add(trayData);

    const duration = Date.now() - startTime;
    debugLogger.info(`🔧 Tray created successfully`, { 
      requestId,
      trayId: docRef.id,
      trayName: trayData.tray_name,
      duration: `${duration}ms`
    }, 'tray-create-success');

    res.status(201).json({
      success: true,
      data: {
        id: docRef.id,
        ...trayData
      },
      message: 'Tray created successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🔧❌ Failed to create tray', error, 'tray-create-error');
    debugLogger.error('🔧❌ Tray creation failed', { 
      requestId,
      error: error.message,
      duration: `${duration}ms`,
      body: req.body
    }, 'tray-create-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create tray',
        code: 'TRAY_CREATE_FAILED'
      }
    });
  }
});

// PUT /api/trays/:id - Update tray with logging
router.put('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const trayId = req.params.id;
  
  try {
    debugLogger.info(`🔧 Tray PUT request started`, { 
      requestId,
      trayId,
      body: req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'tray-update');

    // Check if tray exists
    const existingDoc = await req.firestore.collection('trays').doc(trayId).get();
    if (!existingDoc.exists) {
      debugLogger.warn(`🔧⚠️ Tray not found for update: ${trayId}`, { requestId, trayId }, 'tray-update-not-found');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tray not found',
          code: 'TRAY_NOT_FOUND'
        }
      });
    }

    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    await req.firestore.collection('trays').doc(trayId).update(updateData);

    const duration = Date.now() - startTime;
    debugLogger.info(`🔧 Tray updated successfully`, { 
      requestId,
      trayId,
      duration: `${duration}ms`,
      updatedFields: Object.keys(updateData)
    }, 'tray-update-success');

    res.json({
      success: true,
      data: {
        id: trayId,
        ...updateData
      },
      message: 'Tray updated successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🔧❌ Failed to update tray', error, 'tray-update-error');
    debugLogger.error('🔧❌ Tray update failed', { 
      requestId,
      trayId,
      error: error.message,
      duration: `${duration}ms`,
      body: req.body
    }, 'tray-update-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update tray',
        code: 'TRAY_UPDATE_FAILED'
      }
    });
  }
});

// DELETE /api/trays/:id - Soft delete tray with logging
router.delete('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const trayId = req.params.id;
  
  try {
    debugLogger.info(`🔧 Tray DELETE request started`, { 
      requestId,
      trayId,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'tray-delete');

    // Check if tray exists
    const existingDoc = await req.firestore.collection('trays').doc(trayId).get();
    if (!existingDoc.exists) {
      debugLogger.warn(`🔧⚠️ Tray not found for deletion: ${trayId}`, { requestId, trayId }, 'tray-delete-not-found');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tray not found',
          code: 'TRAY_NOT_FOUND'
        }
      });
    }

    // Soft delete
    await req.firestore.collection('trays').doc(trayId).update({
      deletedAt: new Date(),
      updated_at: new Date()
    });

    const duration = Date.now() - startTime;
    debugLogger.info(`🔧 Tray soft deleted successfully`, { 
      requestId,
      trayId,
      duration: `${duration}ms`
    }, 'tray-delete-success');

    res.json({
      success: true,
      message: 'Tray deleted successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🔧❌ Failed to delete tray', error, 'tray-delete-error');
    debugLogger.error('🔧❌ Tray deletion failed', { 
      requestId,
      trayId,
      error: error.message,
      duration: `${duration}ms`
    }, 'tray-delete-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete tray',
        code: 'TRAY_DELETE_FAILED'
      }
    });
  }
});

module.exports = router;