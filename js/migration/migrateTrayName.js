// js/migration/migrateTrayName.js - Migration to standardize on tray_name field
import { collection, getDocs, updateDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class TrayNameMigration {
    constructor(db) {
        this.db = db;
    }

    /**
     * Migrate all trays to use tray_name instead of name field
     * This aligns with MyRepData tray_tracking collection structure
     */
    async migrateTrayNameField() {
        console.log('🔄 Starting migration: name → tray_name');
        
        try {
            // Get all documents from tray_tracking collection
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            
            if (traysSnapshot.empty) {
                console.log('✅ No trays found to migrate');
                return { success: true, migrated: 0, errors: [] };
            }

            console.log(`📊 Found ${traysSnapshot.size} trays to check for migration`);
            
            // Use batched writes for better performance
            const batch = writeBatch(this.db);
            let migrationCount = 0;
            const errors = [];
            
            traysSnapshot.forEach((trayDoc) => {
                try {
                    const trayData = trayDoc.data();
                    const trayRef = doc(this.db, 'tray_tracking', trayDoc.id);
                    
                    // Check if migration is needed
                    if (trayData.name && !trayData.tray_name) {
                        // Migrate: name → tray_name
                        console.log(`🔄 Migrating tray ${trayDoc.id}: "${trayData.name}" → tray_name`);
                        
                        batch.update(trayRef, {
                            tray_name: trayData.name,
                            // Remove the old name field
                            name: null,
                            // Add migration metadata
                            migrated_at: new Date().toISOString(),
                            migration_version: 'tray_name_v1'
                        });
                        
                        migrationCount++;
                    } else if (trayData.tray_name) {
                        console.log(`✅ Tray ${trayDoc.id} already has tray_name: "${trayData.tray_name}"`);
                    } else {
                        console.log(`⚠️ Tray ${trayDoc.id} has no name or tray_name field`);
                    }
                    
                } catch (docError) {
                    console.error(`❌ Error processing tray ${trayDoc.id}:`, docError);
                    errors.push({ trayId: trayDoc.id, error: docError.message });
                }
            });
            
            // Commit the batch
            if (migrationCount > 0) {
                console.log(`💾 Committing ${migrationCount} tray name migrations...`);
                await batch.commit();
                console.log(`✅ Successfully migrated ${migrationCount} trays to use tray_name field`);
            } else {
                console.log('✅ No trays needed migration - all already use tray_name');
            }
            
            return {
                success: true,
                migrated: migrationCount,
                total: traysSnapshot.size,
                errors: errors
            };
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            return {
                success: false,
                error: error.message,
                migrated: 0
            };
        }
    }

    /**
     * Rollback migration: Convert tray_name back to name
     * Use this if you need to revert the migration
     */
    async rollbackTrayNameMigration() {
        console.log('🔄 Starting rollback: tray_name → name');
        
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
                
                if (trayData.tray_name && trayData.migration_version === 'tray_name_v1') {
                    console.log(`🔄 Rolling back tray ${trayDoc.id}: tray_name → name`);
                    
                    batch.update(trayRef, {
                        name: trayData.tray_name,
                        tray_name: null,
                        migration_version: null,
                        migrated_at: null,
                        rolled_back_at: new Date().toISOString()
                    });
                    
                    rollbackCount++;
                }
            });
            
            if (rollbackCount > 0) {
                await batch.commit();
                console.log(`✅ Successfully rolled back ${rollbackCount} trays to use name field`);
            }
            
            return {
                success: true,
                rolledBack: rollbackCount
            };
            
        } catch (error) {
            console.error('❌ Rollback failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check migration status - show current field usage
     */
    async checkMigrationStatus() {
        try {
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            
            let nameOnly = 0;
            let trayNameOnly = 0;
            let both = 0;
            let neither = 0;
            
            traysSnapshot.forEach((trayDoc) => {
                const trayData = trayDoc.data();
                const hasName = !!trayData.name;
                const hasTrayName = !!trayData.tray_name;
                
                if (hasName && hasTrayName) {
                    both++;
                } else if (hasName && !hasTrayName) {
                    nameOnly++;
                } else if (!hasName && hasTrayName) {
                    trayNameOnly++;
                } else {
                    neither++;
                }
            });
            
            console.log('📊 Tray Name Field Status:');
            console.log(`   📝 name only: ${nameOnly} trays`);
            console.log(`   📝 tray_name only: ${trayNameOnly} trays`);
            console.log(`   📝 both fields: ${both} trays`);
            console.log(`   ❌ neither field: ${neither} trays`);
            console.log(`   📊 total: ${traysSnapshot.size} trays`);
            
            return {
                total: traysSnapshot.size,
                nameOnly,
                trayNameOnly,
                both,
                neither,
                needsMigration: nameOnly > 0
            };
            
        } catch (error) {
            console.error('❌ Error checking migration status:', error);
            return { error: error.message };
        }
    }
}

// Helper function to run migration from browser console
window.runTrayNameMigration = async function() {
    if (window.app?.dataManager?.db) {
        const migration = new TrayNameMigration(window.app.dataManager.db);
        
        console.log('📊 Checking current status...');
        const status = await migration.checkMigrationStatus();
        console.log('Status:', status);
        
        if (status.needsMigration) {
            console.log('🔄 Running migration...');
            const result = await migration.migrateTrayNameField();
            console.log('Migration result:', result);
        } else {
            console.log('✅ No migration needed!');
        }
    } else {
        console.error('❌ Database not available');
    }
};