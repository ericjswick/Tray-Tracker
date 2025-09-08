const express = require('express');
const router = express.Router();
const debugLogger = require('../utils/debugLogger');

// GET /api/physician-preferences - Get all physician preferences with comprehensive logging
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  
  try {
    debugLogger.info(`🩺 Physician Preferences GET request started`, { 
      requestId,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preferences-get-all');

    // Get all physician preferences from Firestore
    const prefsCollection = req.firestore.collection('physician_preferences');
    let query = prefsCollection;

    // Add filters if provided
    if (req.query.physician_id) {
      query = query.where('physician_id', '==', req.query.physician_id);
      debugLogger.debug(`🩺 Applied physician_id filter: ${req.query.physician_id}`, { requestId }, 'physician-preferences-filter');
    }

    if (req.query.case_type) {
      query = query.where('case_type', '==', req.query.case_type);
      debugLogger.debug(`🩺 Applied case_type filter: ${req.query.case_type}`, { requestId }, 'physician-preferences-filter');
    }

    if (req.query.tray_id) {
      query = query.where('tray_id', '==', req.query.tray_id);
      debugLogger.debug(`🩺 Applied tray_id filter: ${req.query.tray_id}`, { requestId }, 'physician-preferences-filter');
    }

    if (req.query.requirement_type) {
      query = query.where('requirement_type', '==', req.query.requirement_type);
      debugLogger.debug(`🩺 Applied requirement_type filter: ${req.query.requirement_type}`, { requestId }, 'physician-preferences-filter');
    }

    // Filter out deleted preferences
    query = query.where('deletedAt', '==', null);

    // Execute query
    const snapshot = await query.get();
    const preferences = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      preferences.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.() || data.created_at,
        updated_at: data.updated_at?.toDate?.() || data.updated_at
      });
    });

    // Sort by physician_id, then case_type, then priority
    preferences.sort((a, b) => {
      if (a.physician_id !== b.physician_id) {
        return (a.physician_id || '').localeCompare(b.physician_id || '');
      }
      if (a.case_type !== b.case_type) {
        return (a.case_type || '').localeCompare(b.case_type || '');
      }
      return (a.priority || 999) - (b.priority || 999);
    });

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preferences retrieved successfully`, { 
      requestId,
      count: preferences.length,
      duration: `${duration}ms`,
      physicianIdFilter: req.query.physician_id,
      caseTypeFilter: req.query.case_type,
      trayIdFilter: req.query.tray_id
    }, 'physician-preferences-success');

    res.json({
      success: true,
      data: preferences,
      count: preferences.length,
      message: `Retrieved ${preferences.length} physician preferences`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to retrieve physician preferences', error, 'physician-preferences-error');
    debugLogger.error('🩺❌ Physician preferences query failed', { 
      requestId,
      error: error.message,
      duration: `${duration}ms`,
      query: req.query
    }, 'physician-preferences-query-error');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve physician preferences',
        code: 'PHYSICIAN_PREFERENCES_QUERY_FAILED'
      }
    });
  }
});

// GET /api/physician-preferences/:id - Get specific physician preference with logging
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const preferenceId = req.params.id;
  
  try {
    debugLogger.info(`🩺 Physician Preference GET by ID request started`, { 
      requestId,
      preferenceId,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preference-get-by-id');

    const prefDoc = await req.firestore.collection('physician_preferences').doc(preferenceId).get();

    if (!prefDoc.exists) {
      debugLogger.warn(`🩺⚠️ Physician preference not found: ${preferenceId}`, { requestId, preferenceId }, 'physician-preference-not-found');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Physician preference not found',
          code: 'PHYSICIAN_PREFERENCE_NOT_FOUND'
        }
      });
    }

    const prefData = prefDoc.data();
    
    // Check if deleted
    if (prefData.deletedAt) {
      debugLogger.warn(`🩺⚠️ Physician preference is deleted: ${preferenceId}`, { requestId, preferenceId, deletedAt: prefData.deletedAt }, 'physician-preference-deleted');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Physician preference not found',
          code: 'PHYSICIAN_PREFERENCE_NOT_FOUND'
        }
      });
    }

    const preference = {
      id: prefDoc.id,
      ...prefData,
      created_at: prefData.created_at?.toDate?.() || prefData.created_at,
      updated_at: prefData.updated_at?.toDate?.() || prefData.updated_at
    };

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preference retrieved successfully`, { 
      requestId,
      preferenceId,
      physicianId: preference.physician_id,
      caseType: preference.case_type,
      trayId: preference.tray_id,
      duration: `${duration}ms`
    }, 'physician-preference-success');

    res.json({
      success: true,
      data: preference
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to retrieve physician preference', error, 'physician-preference-error');
    debugLogger.error('🩺❌ Physician preference query failed', { 
      requestId,
      preferenceId,
      error: error.message,
      duration: `${duration}ms`
    }, 'physician-preference-query-error');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve physician preference',
        code: 'PHYSICIAN_PREFERENCE_QUERY_FAILED'
      }
    });
  }
});

// POST /api/physician-preferences - Create new physician preference with logging
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  
  try {
    debugLogger.info(`🩺 Physician Preference POST request started`, { 
      requestId,
      body: req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preference-create');

    // Validate required fields
    const requiredFields = ['physician_id', 'case_type', 'tray_id', 'requirement_type'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      debugLogger.warn(`🩺⚠️ Missing required fields for physician preference creation`, { 
        requestId,
        missingFields,
        body: req.body
      }, 'physician-preference-validation-error');
      
      return res.status(400).json({
        success: false,
        error: {
          message: `Missing required fields: ${missingFields.join(', ')}`,
          code: 'MISSING_REQUIRED_FIELDS'
        }
      });
    }

    const prefData = {
      ...req.body,
      created_at: new Date(),
      updated_at: new Date(),
      deletedAt: null,
      priority: req.body.priority || 5,
      quantity: req.body.quantity || 1
    };

    const docRef = await req.firestore.collection('physician_preferences').add(prefData);

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preference created successfully`, { 
      requestId,
      preferenceId: docRef.id,
      physicianId: prefData.physician_id,
      caseType: prefData.case_type,
      trayId: prefData.tray_id,
      duration: `${duration}ms`
    }, 'physician-preference-create-success');

    res.status(201).json({
      success: true,
      data: {
        id: docRef.id,
        ...prefData
      },
      message: 'Physician preference created successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to create physician preference', error, 'physician-preference-create-error');
    debugLogger.error('🩺❌ Physician preference creation failed', { 
      requestId,
      error: error.message,
      duration: `${duration}ms`,
      body: req.body
    }, 'physician-preference-create-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create physician preference',
        code: 'PHYSICIAN_PREFERENCE_CREATE_FAILED'
      }
    });
  }
});

// PUT /api/physician-preferences/:id - Update physician preference with logging
router.put('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const preferenceId = req.params.id;
  
  try {
    debugLogger.info(`🩺 Physician Preference PUT request started`, { 
      requestId,
      preferenceId,
      body: req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preference-update');

    // Check if preference exists
    const existingDoc = await req.firestore.collection('physician_preferences').doc(preferenceId).get();
    if (!existingDoc.exists) {
      debugLogger.warn(`🩺⚠️ Physician preference not found for update: ${preferenceId}`, { requestId, preferenceId }, 'physician-preference-update-not-found');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Physician preference not found',
          code: 'PHYSICIAN_PREFERENCE_NOT_FOUND'
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

    await req.firestore.collection('physician_preferences').doc(preferenceId).update(updateData);

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preference updated successfully`, { 
      requestId,
      preferenceId,
      duration: `${duration}ms`,
      updatedFields: Object.keys(updateData)
    }, 'physician-preference-update-success');

    res.json({
      success: true,
      data: {
        id: preferenceId,
        ...updateData
      },
      message: 'Physician preference updated successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to update physician preference', error, 'physician-preference-update-error');
    debugLogger.error('🩺❌ Physician preference update failed', { 
      requestId,
      preferenceId,
      error: error.message,
      duration: `${duration}ms`,
      body: req.body
    }, 'physician-preference-update-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update physician preference',
        code: 'PHYSICIAN_PREFERENCE_UPDATE_FAILED'
      }
    });
  }
});

// DELETE /api/physician-preferences/:id - Soft delete physician preference with logging
router.delete('/:id', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const preferenceId = req.params.id;
  
  try {
    debugLogger.info(`🩺 Physician Preference DELETE request started`, { 
      requestId,
      preferenceId,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preference-delete');

    // Check if preference exists
    const existingDoc = await req.firestore.collection('physician_preferences').doc(preferenceId).get();
    if (!existingDoc.exists) {
      debugLogger.warn(`🩺⚠️ Physician preference not found for deletion: ${preferenceId}`, { requestId, preferenceId }, 'physician-preference-delete-not-found');
      return res.status(404).json({
        success: false,
        error: {
          message: 'Physician preference not found',
          code: 'PHYSICIAN_PREFERENCE_NOT_FOUND'
        }
      });
    }

    // Soft delete
    await req.firestore.collection('physician_preferences').doc(preferenceId).update({
      deletedAt: new Date(),
      updated_at: new Date()
    });

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preference soft deleted successfully`, { 
      requestId,
      preferenceId,
      duration: `${duration}ms`
    }, 'physician-preference-delete-success');

    res.json({
      success: true,
      message: 'Physician preference deleted successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to delete physician preference', error, 'physician-preference-delete-error');
    debugLogger.error('🩺❌ Physician preference deletion failed', { 
      requestId,
      preferenceId,
      error: error.message,
      duration: `${duration}ms`
    }, 'physician-preference-delete-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete physician preference',
        code: 'PHYSICIAN_PREFERENCE_DELETE_FAILED'
      }
    });
  }
});

// GET /api/physician-preferences/physician/:physicianId - Get preferences by physician ID
router.get('/physician/:physicianId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  const physicianId = req.params.physicianId;
  
  try {
    debugLogger.info(`🩺 Physician Preferences by physician ID request started`, { 
      requestId,
      physicianId,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preferences-by-physician');

    let query = req.firestore.collection('physician_preferences')
      .where('physician_id', '==', physicianId)
      .where('deletedAt', '==', null);

    // Add additional filters if provided
    if (req.query.case_type) {
      query = query.where('case_type', '==', req.query.case_type);
      debugLogger.debug(`🩺 Applied case_type filter: ${req.query.case_type}`, { requestId, physicianId }, 'physician-preferences-filter');
    }

    const snapshot = await query.get();
    const preferences = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      preferences.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.() || data.created_at,
        updated_at: data.updated_at?.toDate?.() || data.updated_at
      });
    });

    // Sort by case_type, then priority
    preferences.sort((a, b) => {
      if (a.case_type !== b.case_type) {
        return (a.case_type || '').localeCompare(b.case_type || '');
      }
      return (a.priority || 999) - (b.priority || 999);
    });

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preferences by physician ID retrieved successfully`, { 
      requestId,
      physicianId,
      count: preferences.length,
      duration: `${duration}ms`,
      caseTypeFilter: req.query.case_type
    }, 'physician-preferences-by-physician-success');

    res.json({
      success: true,
      data: preferences,
      count: preferences.length,
      message: `Retrieved ${preferences.length} preferences for physician ${physicianId}`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to retrieve physician preferences by physician ID', error, 'physician-preferences-by-physician-error');
    debugLogger.error('🩺❌ Physician preferences by physician query failed', { 
      requestId,
      physicianId,
      error: error.message,
      duration: `${duration}ms`,
      query: req.query
    }, 'physician-preferences-by-physician-query-error');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve physician preferences',
        code: 'PHYSICIAN_PREFERENCES_BY_PHYSICIAN_QUERY_FAILED'
      }
    });
  }
});

// POST /api/physician-preferences/bulk - Bulk create physician preferences with logging
router.post('/bulk', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
  
  try {
    debugLogger.info(`🩺 Physician Preferences BULK POST request started`, { 
      requestId,
      count: req.body.preferences?.length || 0,
      physicianId: req.body.physician_id,
      userAgent: req.get('User-Agent'),
      ip: req.ip 
    }, 'physician-preferences-bulk-create');

    const { physician_id, preferences } = req.body;

    if (!physician_id || !preferences || !Array.isArray(preferences)) {
      debugLogger.warn(`🩺⚠️ Invalid bulk preferences request`, { 
        requestId,
        hasPhysicianId: !!physician_id,
        hasPreferences: !!preferences,
        isArray: Array.isArray(preferences)
      }, 'physician-preferences-bulk-validation-error');
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'physician_id and preferences array are required',
          code: 'INVALID_BULK_REQUEST'
        }
      });
    }

    const results = [];
    const batch = req.firestore.batch();
    
    for (const prefData of preferences) {
      // Validate required fields for each preference
      const requiredFields = ['case_type', 'tray_id', 'requirement_type'];
      const missingFields = requiredFields.filter(field => !prefData[field]);
      
      if (missingFields.length > 0) {
        debugLogger.warn(`🩺⚠️ Missing required fields in bulk preference`, { 
          requestId,
          missingFields,
          preference: prefData
        }, 'physician-preferences-bulk-item-validation-error');
        continue; // Skip this preference
      }

      const docRef = req.firestore.collection('physician_preferences').doc();
      const fullPrefData = {
        ...prefData,
        physician_id,
        created_at: new Date(),
        updated_at: new Date(),
        deletedAt: null,
        priority: prefData.priority || 5,
        quantity: prefData.quantity || 1
      };

      batch.set(docRef, fullPrefData);
      results.push({
        id: docRef.id,
        ...fullPrefData
      });
    }

    await batch.commit();

    const duration = Date.now() - startTime;
    debugLogger.info(`🩺 Physician preferences bulk created successfully`, { 
      requestId,
      physicianId: physician_id,
      created: results.length,
      attempted: preferences.length,
      duration: `${duration}ms`
    }, 'physician-preferences-bulk-create-success');

    res.status(201).json({
      success: true,
      data: results,
      created: results.length,
      message: `Successfully created ${results.length} physician preferences`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    debugLogger.error('🩺❌ Failed to bulk create physician preferences', error, 'physician-preferences-bulk-create-error');
    debugLogger.error('🩺❌ Physician preferences bulk creation failed', { 
      requestId,
      error: error.message,
      duration: `${duration}ms`,
      body: req.body
    }, 'physician-preferences-bulk-create-failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to bulk create physician preferences',
        code: 'PHYSICIAN_PREFERENCES_BULK_CREATE_FAILED'
      }
    });
  }
});

module.exports = router;