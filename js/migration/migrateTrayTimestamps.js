// js/migration/migrateTrayTimestamps.js - Migration to standardize on created_at/updated_at fields
import { collection, getDocs, updateDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class TrayTimestampMigration {
    constructor(db) {
        this.db = db;
    }

    /**
     * Migrate all trays to use created_at/updated_at instead of createdAt/updatedAt
     * This aligns with MyRepData tray_tracking collection structure
     */
    async migrateTrayTimestamps() {
        console.log('🔄 Starting migration: createdAt/updatedAt → created_at/updated_at');
        
        try {
            // Get all documents from tray_tracking collection
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            
            if (traysSnapshot.empty) {
                console.log('✅ No trays found to migrate');
                return { success: true, migrated: 0, errors: [] };
            }

            console.log(`📊 Found ${traysSnapshot.size} trays to check for timestamp migration`);
            
            // Use batched writes for better performance
            const batch = writeBatch(this.db);
            let migrationCount = 0;
            const errors = [];
            
            traysSnapshot.forEach((trayDoc) => {
                try {
                    const trayData = trayDoc.data();
                    const trayRef = doc(this.db, 'tray_tracking', trayDoc.id);
                    let needsUpdate = false;
                    const updates = {};
                    
                    // Check if migration is needed for createdAt
                    if (trayData.createdAt && !trayData.created_at) {
                        console.log(`🔄 Migrating createdAt for tray ${trayDoc.id}`);
                        updates.created_at = trayData.createdAt;
                        updates.createdAt = null; // Remove old field
                        needsUpdate = true;
                    }
                    
                    // Check if migration is needed for updatedAt  
                    if (trayData.updatedAt && !trayData.updated_at) {
                        console.log(`🔄 Migrating updatedAt for tray ${trayDoc.id}`);
                        updates.updated_at = trayData.updatedAt;
                        updates.updatedAt = null; // Remove old field
                        needsUpdate = true;
                    }
                    
                    // Check if migration is needed for lastModified (convert to updated_at)
                    if (trayData.lastModified && !trayData.updated_at && !trayData.updatedAt) {
                        console.log(`🔄 Converting lastModified to updated_at for tray ${trayDoc.id}`);
                        updates.updated_at = trayData.lastModified;
                        updates.lastModified = null; // Remove old field
                        needsUpdate = true;
                    }
                    
                    if (needsUpdate) {
                        // Add migration metadata
                        updates.timestamp_migrated_at = new Date().toISOString();
                        updates.timestamp_migration_version = 'timestamps_v1';
                        
                        batch.update(trayRef, updates);
                        migrationCount++;
                        
                        const trayName = trayData.tray_name || trayData.name || trayDoc.id;
                        console.log(`✅ Queued timestamp migration for: ${trayName}`);
                    } else {
                        const trayName = trayData.tray_name || trayData.name || trayDoc.id;
                        if (trayData.created_at || trayData.updated_at) {
                            console.log(`✅ Tray ${trayName} already has MyRepData timestamp format`);
                        } else {
                            console.log(`⚠️ Tray ${trayName} has no timestamps to migrate`);
                        }
                    }
                    
                } catch (docError) {
                    console.error(`❌ Error processing tray ${trayDoc.id}:`, docError);
                    errors.push({ trayId: trayDoc.id, error: docError.message });
                }
            });
            
            // Commit the batch
            if (migrationCount > 0) {
                console.log(`💾 Committing ${migrationCount} tray timestamp migrations...`);
                await batch.commit();
                console.log(`✅ Successfully migrated ${migrationCount} trays to use created_at/updated_at fields`);
            } else {
                console.log('✅ No trays needed timestamp migration - all already use MyRepData format');
            }
            
            return {
                success: true,
                migrated: migrationCount,
                total: traysSnapshot.size,
                errors: errors
            };
            
        } catch (error) {
            console.error('❌ Timestamp migration failed:', error);
            return {
                success: false,
                error: error.message,
                migrated: 0
            };
        }
    }

    /**
     * Rollback migration: Convert created_at/updated_at back to createdAt/updatedAt
     */
    async rollbackTimestampMigration() {
        console.log('🔄 Starting rollback: created_at/updated_at → createdAt/updatedAt');
        
        try {
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            
            if (traysSnapshot.empty) {
                console.log('✅ No trays found to rollback');
                return { success: true, rolledBack: 0 };
            }

            const batch = writeBatch(this.db);
            let rollbackCount = 0;
            
            traysSnapshot.forEach((trayDoc) => {
                const trayData = trayDoc.data();
                const trayRef = doc(this.db, 'tray_tracking', trayDoc.id);
                
                if (trayData.timestamp_migration_version === 'timestamps_v1') {
                    console.log(`🔄 Rolling back timestamps for tray ${trayDoc.id}`);
                    const rollbackUpdates = {};
                    
                    if (trayData.created_at) {
                        rollbackUpdates.createdAt = trayData.created_at;
                        rollbackUpdates.created_at = null;
                    }
                    
                    if (trayData.updated_at) {
                        rollbackUpdates.updatedAt = trayData.updated_at;
                        rollbackUpdates.updated_at = null;
                    }
                    
                    rollbackUpdates.timestamp_migration_version = null;
                    rollbackUpdates.timestamp_migrated_at = null;
                    rollbackUpdates.timestamp_rolled_back_at = new Date().toISOString();
                    
                    batch.update(trayRef, rollbackUpdates);
                    rollbackCount++;
                }
            });
            
            if (rollbackCount > 0) {
                await batch.commit();
                console.log(`✅ Successfully rolled back ${rollbackCount} trays to use createdAt/updatedAt fields`);
            }
            
            return {
                success: true,
                rolledBack: rollbackCount
            };
            
        } catch (error) {
            console.error('❌ Timestamp rollback failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check timestamp migration status
     */
    async checkTimestampStatus() {
        try {
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            
            let createdAtOnly = 0;
            let createdAtFieldOnly = 0;
            let updatedAtOnly = 0;
            let updatedAtFieldOnly = 0;
            let both = 0;
            let neither = 0;
            let lastModifiedOnly = 0;
            
            traysSnapshot.forEach((trayDoc) => {
                const trayData = trayDoc.data();
                const hasCreatedAt = !!trayData.createdAt;
                const hasCreatedAtField = !!trayData.created_at;
                const hasUpdatedAt = !!trayData.updatedAt;
                const hasUpdatedAtField = !!trayData.updated_at;
                const hasLastModified = !!trayData.lastModified;
                
                // Categorize created timestamps
                if (hasCreatedAt && hasCreatedAtField) {
                    both++;
                } else if (hasCreatedAt && !hasCreatedAtField) {
                    createdAtOnly++;
                } else if (!hasCreatedAt && hasCreatedAtField) {
                    createdAtFieldOnly++;
                } else if (!hasCreatedAt && !hasCreatedAtField) {
                    neither++;
                }
                
                // Count update timestamps
                if (hasUpdatedAt && !hasUpdatedAtField) {
                    updatedAtOnly++;
                } else if (!hasUpdatedAt && hasUpdatedAtField) {
                    updatedAtFieldOnly++;
                } else if (hasLastModified && !hasUpdatedAt && !hasUpdatedAtField) {
                    lastModifiedOnly++;
                }
            });
            
            console.log('📊 Tray Timestamp Field Status:');
            console.log(`   📝 createdAt only: ${createdAtOnly} trays`);
            console.log(`   📝 created_at only: ${createdAtFieldOnly} trays`);
            console.log(`   📝 both created fields: ${both} trays`);
            console.log(`   📝 updatedAt only: ${updatedAtOnly} trays`);
            console.log(`   📝 updated_at only: ${updatedAtFieldOnly} trays`);
            console.log(`   📝 lastModified only: ${lastModifiedOnly} trays`);
            console.log(`   ❌ no created timestamps: ${neither} trays`);
            console.log(`   📊 total: ${traysSnapshot.size} trays`);
            
            const needsCreatedMigration = createdAtOnly > 0;
            const needsUpdatedMigration = updatedAtOnly > 0 || lastModifiedOnly > 0;
            
            return {
                total: traysSnapshot.size,
                createdAtOnly,
                createdAtFieldOnly,
                updatedAtOnly,
                updatedAtFieldOnly,
                lastModifiedOnly,
                both,
                neither,
                needsCreatedMigration,
                needsUpdatedMigration,
                needsMigration: needsCreatedMigration || needsUpdatedMigration
            };
            
        } catch (error) {
            console.error('❌ Error checking timestamp status:', error);
            return { error: error.message };
        }
    }
}

// Helper function to run migration from browser console
window.runTrayTimestampMigration = async function() {
    if (window.app?.dataManager?.db) {
        const migration = new TrayTimestampMigration(window.app.dataManager.db);
        
        console.log('📊 Checking current timestamp status...');
        const status = await migration.checkTimestampStatus();
        console.log('Status:', status);
        
        if (status.needsMigration) {
            console.log('🔄 Running timestamp migration...');
            const result = await migration.migrateTrayTimestamps();
            console.log('Migration result:', result);
        } else {
            console.log('✅ No timestamp migration needed!');
        }
    } else {
        console.error('❌ Database not available');
    }
};