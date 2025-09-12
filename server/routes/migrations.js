const express = require('express');
const router = express.Router();
const { FieldValue } = require('firebase-admin/firestore');

/**
 * Migration endpoint to transfer createdAt to created_at for facilities
 * This ensures compatibility with MyRepData backend format
 */
router.post('/facilities-created-at', async (req, res) => {
    try {
        console.log('🔄 Starting facility createdAt to created_at migration...');
        
        // Get Firestore instance from middleware
        const db = req.firestore;
        
        // Get all facilities
        const facilitiesRef = db.collection('facilities');
        const snapshot = await facilitiesRef.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                message: 'No facilities found to migrate',
                processed: 0,
                migrated: 0,
                skipped: 0,
                errors: []
            });
        }
        
        let processed = 0;
        let migrated = 0;
        let skipped = 0;
        let errors = [];
        
        // Process each facility
        const batch = db.batch();
        let batchSize = 0;
        const maxBatchSize = 500; // Firestore batch limit
        
        for (const doc of snapshot.docs) {
            processed++;
            const data = doc.data();
            const facilityId = doc.id;
            
            try {
                // Check if facility has createdAt but not created_at
                if (data.createdAt && !data.created_at) {
                    console.log(`Migrating facility ${facilityId}: createdAt -> created_at`);
                    
                    // Prepare update object
                    const updateData = {
                        created_at: data.createdAt
                    };
                    
                    // Also migrate updatedAt if present
                    if (data.updatedAt && !data.updated_at) {
                        updateData.updated_at = data.updatedAt;
                        console.log(`Also migrating updatedAt -> updated_at for ${facilityId}`);
                    }
                    
                    // Add to batch
                    batch.update(doc.ref, updateData);
                    batchSize++;
                    migrated++;
                    
                    // Commit batch if approaching limit
                    if (batchSize >= maxBatchSize) {
                        await batch.commit();
                        console.log(`Committed batch of ${batchSize} updates`);
                        batchSize = 0;
                    }
                } else if (data.created_at) {
                    // Already has created_at
                    skipped++;
                    console.log(`Facility ${facilityId} already has created_at field, skipping`);
                } else if (!data.createdAt) {
                    // No createdAt field to migrate
                    skipped++;
                    console.log(`Facility ${facilityId} has no createdAt field to migrate, skipping`);
                }
            } catch (error) {
                console.error(`Error processing facility ${facilityId}:`, error);
                errors.push({
                    facilityId,
                    error: error.message
                });
            }
        }
        
        // Commit remaining batch
        if (batchSize > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${batchSize} updates`);
        }
        
        const result = {
            success: true,
            message: `Migration completed successfully`,
            processed,
            migrated,
            skipped,
            errors
        };
        
        console.log('✅ Facility createdAt migration completed:', result);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message,
            processed: 0,
            migrated: 0,
            skipped: 0,
            errors: []
        });
    }
});

/**
 * Migration endpoint to clean up old createdAt/updatedAt fields after migration
 * This removes the old camelCase fields after confirming migration was successful
 */
router.post('/facilities-cleanup-old-fields', async (req, res) => {
    try {
        console.log('🧹 Starting cleanup of old createdAt/updatedAt fields...');
        
        // Get Firestore instance from middleware
        const db = req.firestore;
        
        // Get all facilities
        const facilitiesRef = db.collection('facilities');
        const snapshot = await facilitiesRef.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                message: 'No facilities found to clean up',
                processed: 0,
                cleaned: 0,
                skipped: 0,
                errors: []
            });
        }
        
        let processed = 0;
        let cleaned = 0;
        let skipped = 0;
        let errors = [];
        
        // Process each facility
        const batch = db.batch();
        let batchSize = 0;
        const maxBatchSize = 500;
        
        for (const doc of snapshot.docs) {
            processed++;
            const data = doc.data();
            const facilityId = doc.id;
            
            try {
                // Check if facility has both old and new fields
                const hasOldFields = data.createdAt || data.updatedAt;
                const hasNewFields = data.created_at || data.updated_at;
                
                if (hasOldFields && hasNewFields) {
                    console.log(`Cleaning up old fields for facility ${facilityId}`);
                    
                    // Prepare field deletions
                    const updates = {};
                    if (data.createdAt) {
                        updates.createdAt = FieldValue.delete();
                    }
                    if (data.updatedAt) {
                        updates.updatedAt = FieldValue.delete();
                    }
                    
                    // Add to batch
                    batch.update(doc.ref, updates);
                    batchSize++;
                    cleaned++;
                    
                    // Commit batch if approaching limit
                    if (batchSize >= maxBatchSize) {
                        await batch.commit();
                        console.log(`Committed cleanup batch of ${batchSize} updates`);
                        batchSize = 0;
                    }
                } else {
                    skipped++;
                    console.log(`Facility ${facilityId} doesn't need cleanup, skipping`);
                }
            } catch (error) {
                console.error(`Error cleaning up facility ${facilityId}:`, error);
                errors.push({
                    facilityId,
                    error: error.message
                });
            }
        }
        
        // Commit remaining batch
        if (batchSize > 0) {
            await batch.commit();
            console.log(`Committed final cleanup batch of ${batchSize} updates`);
        }
        
        const result = {
            success: true,
            message: `Cleanup completed successfully`,
            processed,
            cleaned,
            skipped,
            errors
        };
        
        console.log('✅ Facility field cleanup completed:', result);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        res.status(500).json({
            success: false,
            message: 'Cleanup failed',
            error: error.message,
            processed: 0,
            cleaned: 0,
            skipped: 0,
            errors: []
        });
    }
});

/**
 * Get migration status - check how many facilities need migration
 */
router.get('/facilities-migration-status', async (req, res) => {
    try {
        console.log('📊 Checking facility migration status...');
        
        // Get Firestore instance from middleware
        const db = req.firestore;
        
        const facilitiesRef = db.collection('facilities');
        const snapshot = await facilitiesRef.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                total: 0,
                needsMigration: 0,
                alreadyMigrated: 0,
                noTimestamp: 0,
                details: []
            });
        }
        
        let total = 0;
        let needsMigration = 0;
        let alreadyMigrated = 0;
        let noTimestamp = 0;
        const details = [];
        
        snapshot.forEach(doc => {
            total++;
            const data = doc.data();
            const facilityId = doc.id;
            const facilityName = data.name || 'Unknown';
            
            const hasCreatedAt = !!data.createdAt;
            const hasCreated_at = !!data.created_at;
            const hasUpdatedAt = !!data.updatedAt;
            const hasUpdated_at = !!data.updated_at;
            
            let status = '';
            
            if (hasCreatedAt && !hasCreated_at) {
                needsMigration++;
                status = 'needs_migration';
            } else if (hasCreated_at) {
                alreadyMigrated++;
                status = 'migrated';
            } else {
                noTimestamp++;
                status = 'no_timestamp';
            }
            
            details.push({
                id: facilityId,
                name: facilityName,
                status,
                hasCreatedAt,
                hasCreated_at,
                hasUpdatedAt,
                hasUpdated_at
            });
        });
        
        const result = {
            success: true,
            total,
            needsMigration,
            alreadyMigrated,
            noTimestamp,
            details
        };
        
        console.log('📊 Migration status:', {
            total,
            needsMigration,
            alreadyMigrated,
            noTimestamp
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Status check failed:', error);
        res.status(500).json({
            success: false,
            message: 'Status check failed',
            error: error.message
        });
    }
});

module.exports = router;