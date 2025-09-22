// js/MigrationsManager.js - Database Migrations Management
import { TrayNameMigration } from './migration/migrateTrayName.js';

export class MigrationsManager {
    constructor() {
        this.apiBaseUrl = 'https://traytracker-dev.serverdatahost.com/api/migrations';
        this.currentStatus = null;
    }

    // Check the current migration status
    async checkMigrationStatus() {
        try {
            console.log('🔍 Checking migration status...');
            
            // Show loading state
            this.showLoadingState();
            
            const response = await fetch(`${this.apiBaseUrl}/facilities-migration-status`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to check migration status');
            }
            
            this.currentStatus = data;
            this.updateStatusDisplay(data);
            this.updateStatusTable(data.details || []);
            this.updateActionButtons(data);
            
            console.log('✅ Migration status loaded:', data);
            
        } catch (error) {
            console.error('❌ Error checking migration status:', error);
            this.showError('Failed to check migration status: ' + error.message);
        }
    }

    // Run the facilities migration
    async runFacilitiesMigration() {
        if (!confirm('Are you sure you want to run the facilities migration? This will update timestamp fields from camelCase to snake_case format.')) {
            return;
        }

        try {
            console.log('🏃 Running facilities migration...');
            
            // Show loading state
            this.showMigrationInProgress();
            
            const response = await fetch(`${this.apiBaseUrl}/facilities-created-at`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Migration failed');
            }
            
            console.log('✅ Migration completed:', data);
            this.showMigrationResults(data);
            
            // Refresh status after migration
            setTimeout(() => {
                this.checkMigrationStatus();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            this.showError('Migration failed: ' + error.message);
        }
    }

    // Clean up old timestamp fields
    async cleanupOldFields() {
        if (!confirm('Are you sure you want to clean up old timestamp fields? This will permanently remove createdAt and updatedAt fields after confirming the new fields exist. This action cannot be undone.')) {
            return;
        }

        try {
            console.log('🧹 Cleaning up old fields...');
            
            // Show loading state
            this.showCleanupInProgress();
            
            const response = await fetch(`${this.apiBaseUrl}/facilities-cleanup-old-fields`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Cleanup failed');
            }
            
            console.log('✅ Cleanup completed:', data);
            this.showCleanupResults(data);
            
            // Refresh status after cleanup
            setTimeout(() => {
                this.checkMigrationStatus();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
            this.showError('Cleanup failed: ' + error.message);
        }
    }

    // Physician Migration Methods
    async checkPhysiciansMigrationStatus() {
        try {
            console.log('🔍 Checking physicians migration status...');
            
            // Get Firestore instance from different possible locations
            let db;
            if (window.app?.dataManager?.db) {
                db = window.app.dataManager.db;
            } else if (window.firebase?.firestore) {
                db = window.firebase.firestore();
            } else {
                throw new Error('Firestore database connection not available');
            }
            
            const collection = await db.collection('physicians').get();
            
            let total = 0;
            let needsMigration = 0;
            let alreadyMigrated = 0;
            let noTimestamp = 0;
            const details = [];
            
            collection.forEach(doc => {
                total++;
                const data = doc.data();
                const physicianId = doc.id;
                const physicianName = data.full_name || data.name || 'Unknown';
                
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
                    id: physicianId,
                    full_name: physicianName,
                    status,
                    hasCreatedAt,
                    hasCreated_at,
                    hasUpdatedAt,
                    hasUpdated_at
                });
            });
            
            console.log(`📊 Physicians Status: ${total} total, ${needsMigration} need migration, ${alreadyMigrated} migrated`);
            
            details.forEach(physician => {
                if (physician.status === 'needs_migration') {
                    console.log(`⚠️  ${physician.name} (${physician.id}) needs migration`);
                }
            });
            
            return { total, needsMigration, alreadyMigrated, noTimestamp, details };
            
        } catch (error) {
            console.error('❌ Error checking physicians migration status:', error);
            throw error;
        }
    }

    async migratePhysicians() {
        try {
            console.log('🔄 Starting physicians migration...');
            
            // Get Firestore instance from different possible locations
            let db;
            if (window.app?.dataManager?.db) {
                db = window.app.dataManager.db;
            } else if (window.firebase?.firestore) {
                db = window.firebase.firestore();
            } else {
                throw new Error('Firestore database connection not available');
            }
            
            const collection = await db.collection('physicians').get();
            
            let processed = 0;
            let migrated = 0;
            let skipped = 0;
            let errors = [];
            
            // Process each physician
            for (const doc of collection.docs) {
                processed++;
                const data = doc.data();
                const physicianId = doc.id;
                const physicianName = data.full_name || data.name || 'Unknown';
                
                try {
                    // Check if physician has createdAt but not created_at
                    if (data.createdAt && !data.created_at) {
                        console.log(`Migrating physician: ${physicianName} (${physicianId})`);
                        
                        // Prepare update object
                        const updateData = {
                            created_at: data.createdAt
                        };
                        
                        // Also migrate updatedAt if present
                        if (data.updatedAt && !data.updated_at) {
                            updateData.updated_at = data.updatedAt;
                        }
                        
                        await doc.ref.update(updateData);
                        console.log(`✅ Migrated: ${physicianName}`);
                        migrated++;
                        
                    } else if (data.created_at) {
                        console.log(`⏭️  ${physicianName} already migrated`);
                        skipped++;
                    } else {
                        console.log(`⏭️  ${physicianName} has no createdAt field`);
                        skipped++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing physician ${physicianName}:`, error);
                    errors.push({
                        physicianId,
                        physicianName,
                        error: error.message
                    });
                }
            }
            
            const result = {
                success: true,
                message: `Physicians migration completed`,
                processed,
                migrated,
                skipped,
                errors
            };
            
            console.log(`✅ Physicians migration complete: ${processed} processed, ${migrated} migrated, ${skipped} skipped, ${errors.length} errors`);
            
            if (errors.length > 0) {
                console.error('Migration errors:', errors);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Physicians migration failed:', error);
            throw error;
        }
    }

    async cleanupPhysiciansOldFields() {
        try {
            console.log('🧹 Starting cleanup of old physicians timestamp fields...');
            
            // Get Firestore instance from different possible locations
            let db;
            if (window.app?.dataManager?.db) {
                db = window.app.dataManager.db;
            } else if (window.firebase?.firestore) {
                db = window.firebase.firestore();
            } else {
                throw new Error('Firestore database connection not available');
            }
            
            const collection = await db.collection('physicians').get();
            
            let processed = 0;
            let cleaned = 0;
            let skipped = 0;
            let errors = [];
            
            // Process each physician
            for (const doc of collection.docs) {
                processed++;
                const data = doc.data();
                const physicianId = doc.id;
                const physicianName = data.full_name || data.name || 'Unknown';
                
                try {
                    // Check if physician has both old and new fields
                    const hasOldFields = data.createdAt || data.updatedAt;
                    const hasNewFields = data.created_at || data.updated_at;
                    
                    if (hasOldFields && hasNewFields) {
                        console.log(`Cleaning up old fields for physician: ${physicianName}`);
                        
                        // Prepare field deletions using FieldValue.delete()
                        const updates = {};
                        if (data.createdAt) {
                            updates.createdAt = db.FieldValue?.delete() || window.firebase?.firestore?.FieldValue?.delete();
                        }
                        if (data.updatedAt) {
                            updates.updatedAt = db.FieldValue?.delete() || window.firebase?.firestore?.FieldValue?.delete();
                        }
                        
                        await doc.ref.update(updates);
                        console.log(`✅ Cleaned: ${physicianName}`);
                        cleaned++;
                        
                    } else {
                        console.log(`⏭️  ${physicianName} doesn't need cleanup`);
                        skipped++;
                    }
                } catch (error) {
                    console.error(`❌ Error cleaning up physician ${physicianName}:`, error);
                    errors.push({
                        physicianId,
                        physicianName,
                        error: error.message
                    });
                }
            }
            
            const result = {
                success: true,
                message: `Physicians cleanup completed`,
                processed,
                cleaned,
                skipped,
                errors
            };
            
            console.log(`✅ Physicians cleanup complete: ${processed} processed, ${cleaned} cleaned, ${skipped} skipped, ${errors.length} errors`);
            
            if (errors.length > 0) {
                console.error('Cleanup errors:', errors);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Physicians cleanup failed:', error);
            throw error;
        }
    }

    // Update the status display
    updateStatusDisplay(data) {
        // Update metrics cards
        document.getElementById('totalFacilitiesForMigration').textContent = data.total || 0;
        document.getElementById('facilitiesAlreadyMigrated').textContent = data.alreadyMigrated || 0;
        document.getElementById('facilitiesNeedMigration').textContent = data.needsMigration || 0;
        document.getElementById('facilitiesNoTimestamp').textContent = data.noTimestamp || 0;
        
        // Update status text
        const statusText = document.getElementById('migrationStatusText');
        if (data.needsMigration > 0) {
            statusText.innerHTML = `<span class="text-warning">${data.needsMigration} facilities need migration</span>`;
        } else if (data.total === data.alreadyMigrated) {
            statusText.innerHTML = `<span class="text-success">All facilities are already migrated</span>`;
        } else {
            statusText.innerHTML = `<span class="text-info">Mixed status - check details below</span>`;
        }
    }

    // Update the detailed status table
    updateStatusTable(details) {
        const tbody = document.getElementById('facilitiesMigrationTableBody');
        
        if (!details || details.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        <i class="fas fa-info-circle"></i> No facilities found
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = details.map(facility => {
            const statusBadge = this.getStatusBadge(facility.status);
            const checkIcon = '<i class="fas fa-check text-success"></i>';
            const crossIcon = '<i class="fas fa-times text-danger"></i>';
            
            return `
                <tr>
                    <td><code>${facility.id}</code></td>
                    <td>${facility.account_name}</td>
                    <td>${statusBadge}</td>
                    <td class="text-center">${facility.hasCreatedAt ? checkIcon : crossIcon}</td>
                    <td class="text-center">${facility.hasCreated_at ? checkIcon : crossIcon}</td>
                    <td class="text-center">${facility.hasUpdatedAt ? checkIcon : crossIcon}</td>
                    <td class="text-center">${facility.hasUpdated_at ? checkIcon : crossIcon}</td>
                </tr>
            `;
        }).join('');
    }

    // Get status badge HTML
    getStatusBadge(status) {
        switch (status) {
            case 'needs_migration':
                return '<span class="badge bg-warning">Needs Migration</span>';
            case 'migrated':
                return '<span class="badge bg-success">Migrated</span>';
            case 'no_timestamp':
                return '<span class="badge bg-secondary">No Timestamp</span>';
            default:
                return '<span class="badge bg-light text-dark">Unknown</span>';
        }
    }

    // Update action buttons based on status
    updateActionButtons(data) {
        const runMigrationBtn = document.getElementById('runMigrationBtn');
        const cleanupBtn = document.getElementById('cleanupOldFieldsBtn');
        
        // Enable/disable migration button
        if (data.needsMigration > 0) {
            runMigrationBtn.disabled = false;
            runMigrationBtn.classList.remove('btn-warning');
            runMigrationBtn.classList.add('btn-warning');
        } else {
            runMigrationBtn.disabled = true;
            runMigrationBtn.classList.add('btn-secondary');
            runMigrationBtn.classList.remove('btn-warning');
        }
        
        // Enable/disable cleanup button
        // Only enable if there are facilities with both old and new fields
        const needsCleanup = data.details && data.details.some(f => 
            (f.hasCreatedAt || f.hasUpdatedAt) && (f.hasCreated_at || f.hasUpdated_at)
        );
        
        if (needsCleanup) {
            cleanupBtn.disabled = false;
            cleanupBtn.classList.remove('btn-secondary');
            cleanupBtn.classList.add('btn-danger');
        } else {
            cleanupBtn.disabled = true;
            cleanupBtn.classList.add('btn-secondary');
            cleanupBtn.classList.remove('btn-danger');
        }
    }

    // Show loading state
    showLoadingState() {
        const statusText = document.getElementById('migrationStatusText');
        statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading migration status...';
        
        // Reset metrics
        document.getElementById('totalFacilitiesForMigration').textContent = '-';
        document.getElementById('facilitiesAlreadyMigrated').textContent = '-';
        document.getElementById('facilitiesNeedMigration').textContent = '-';
        document.getElementById('facilitiesNoTimestamp').textContent = '-';
    }

    // Show migration in progress
    showMigrationInProgress() {
        const statusText = document.getElementById('migrationStatusText');
        statusText.innerHTML = '<i class="fas fa-cog fa-spin text-warning"></i> Migration in progress...';
        
        document.getElementById('runMigrationBtn').disabled = true;
        document.getElementById('runMigrationBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    }

    // Show cleanup in progress
    showCleanupInProgress() {
        const statusText = document.getElementById('migrationStatusText');
        statusText.innerHTML = '<i class="fas fa-broom fa-spin text-info"></i> Cleanup in progress...';
        
        document.getElementById('cleanupOldFieldsBtn').disabled = true;
        document.getElementById('cleanupOldFieldsBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cleaning...';
    }

    // Show migration results
    showMigrationResults(data) {
        document.getElementById('resultProcessed').textContent = data.processed || 0;
        document.getElementById('resultMigrated').textContent = data.migrated || 0;
        document.getElementById('resultSkipped').textContent = data.skipped || 0;
        document.getElementById('resultErrors').textContent = data.errors?.length || 0;
        
        // Show errors if any
        if (data.errors && data.errors.length > 0) {
            const errorsList = document.getElementById('errorsList');
            errorsList.innerHTML = data.errors.map(error => 
                `<li class="text-danger"><strong>${error.facilityId}:</strong> ${error.error}</li>`
            ).join('');
            document.getElementById('migrationErrorsList').classList.remove('d-none');
        } else {
            document.getElementById('migrationErrorsList').classList.add('d-none');
        }
        
        document.getElementById('migrationResults').classList.remove('d-none');
        
        // Reset button
        const runMigrationBtn = document.getElementById('runMigrationBtn');
        runMigrationBtn.innerHTML = '<i class="fas fa-play"></i> Run Migration';
    }

    // Show cleanup results
    showCleanupResults(data) {
        // Reuse migration results display
        this.showMigrationResults({
            processed: data.processed,
            migrated: data.cleaned,
            skipped: data.skipped,
            errors: data.errors
        });
        
        // Reset button
        const cleanupBtn = document.getElementById('cleanupOldFieldsBtn');
        cleanupBtn.innerHTML = '<i class="fas fa-broom"></i> Cleanup Old Fields';
    }

    // Show error message
    showError(message) {
        const statusText = document.getElementById('migrationStatusText');
        statusText.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-triangle"></i> ${message}</span>`;
        
        // Reset buttons
        document.getElementById('runMigrationBtn').innerHTML = '<i class="fas fa-play"></i> Run Migration';
        document.getElementById('cleanupOldFieldsBtn').innerHTML = '<i class="fas fa-broom"></i> Cleanup Old Fields';
    }
}

// Global functions for button onclick handlers
window.checkMigrationStatus = async function() {
    if (window.app && window.app.migrationsManager) {
        await window.app.migrationsManager.checkMigrationStatus();
    }
};

window.runFacilitiesMigration = async function() {
    if (window.app && window.app.migrationsManager) {
        await window.app.migrationsManager.runFacilitiesMigration();
    }
};

window.cleanupOldFields = async function() {
    if (window.app && window.app.migrationsManager) {
        await window.app.migrationsManager.cleanupOldFields();
    }
};

// Physician migration functions
window.checkPhysiciansMigrationStatus = async function() {
    if (window.app && window.app.migrationsManager) {
        await window.app.migrationsManager.checkPhysiciansMigrationStatus();
    }
};

window.migratePhysicians = async function() {
    if (window.app && window.app.migrationsManager) {
        await window.app.migrationsManager.migratePhysicians();
    }
};

window.cleanupPhysiciansOldFields = async function() {
    if (window.app && window.app.migrationsManager) {
        await window.app.migrationsManager.cleanupPhysiciansOldFields();
    }
};

// Simple working physician migration functions
window.migratePhysiciansSimple = async function() {
    try {
        console.log('🔄 Starting physicians migration (simple version)...');
        
        // Import Firestore functions
        const { getFirestore, collection, getDocs, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
        const db = getFirestore();
        
        // Get all physicians
        const physiciansRef = collection(db, 'physicians');
        const snapshot = await getDocs(physiciansRef);
        
        let processed = 0;
        let migrated = 0;
        let skipped = 0;
        
        for (const doc of snapshot.docs) {
            processed++;
            const data = doc.data();
            const physicianName = data.name || 'Unknown';
            
            if (data.createdAt && !data.created_at) {
                const updates = { created_at: data.createdAt };
                
                if (data.updatedAt && !data.updated_at) {
                    updates.updated_at = data.updatedAt;
                }
                
                await updateDoc(doc.ref, updates);
                console.log(`✅ Migrated: ${physicianName}`);
                migrated++;
            } else {
                console.log(`⏭️  Skipped: ${physicianName} (already migrated or no createdAt)`);
                skipped++;
            }
        }
        
        console.log(`🎯 Migration complete: ${processed} processed, ${migrated} migrated, ${skipped} skipped`);
        return { processed, migrated, skipped };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

window.checkPhysiciansSimple = async function() {
    try {
        console.log('📊 Checking physicians status...');
        
        // Import Firestore functions
        const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
        const db = getFirestore();
        
        // Get all physicians
        const physiciansRef = collection(db, 'physicians');
        const snapshot = await getDocs(physiciansRef);
        
        let total = 0;
        let needsMigration = 0;
        let alreadyMigrated = 0;
        
        snapshot.forEach(doc => {
            total++;
            const data = doc.data();
            const physicianName = data.name || data.full_name || 'Unknown';
            
            if (data.createdAt && !data.created_at) {
                needsMigration++;
                console.log(`⚠️ Needs migration: ${physicianName}`);
            } else if (data.created_at) {
                alreadyMigrated++;
            }
        });
        
        console.log(`📊 Status: ${total} total, ${needsMigration} need migration, ${alreadyMigrated} already migrated`);
        return { total, needsMigration, alreadyMigrated };
        
    } catch (error) {
        console.error('❌ Status check failed:', error);
        throw error;
    }
};

// Physician name to full_name migration
window.migratePhysiciansNameToFullName = async function() {
    try {
        console.log('🔄 Starting physicians name-to-full_name migration...');
        
        // Import Firestore functions
        const { getFirestore, collection, getDocs, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
        const db = getFirestore();
        
        // Get all physicians
        const physiciansRef = collection(db, 'physicians');
        const snapshot = await getDocs(physiciansRef);
        
        let processed = 0;
        let migrated = 0;
        let skipped = 0;
        
        for (const doc of snapshot.docs) {
            processed++;
            const data = doc.data();
            const physicianName = data.name || data.full_name || 'Unknown';
            
            if (data.name && !data.full_name) {
                const updates = { full_name: data.name };
                
                await updateDoc(doc.ref, updates);
                console.log(`✅ Migrated: ${physicianName} (name → full_name)`);
                migrated++;
            } else if (data.full_name) {
                console.log(`⏭️  Skipped: ${physicianName} (already has full_name)`);
                skipped++;
            } else {
                console.log(`⚠️  Skipped: ${physicianName} (no name field found)`);
                skipped++;
            }
        }
        
        console.log(`🎯 Migration complete: ${processed} processed, ${migrated} migrated, ${skipped} skipped`);
        return { processed, migrated, skipped };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

window.checkPhysiciansNameStatus = async function() {
    try {
        console.log('📊 Checking physicians name field status...');
        
        // Import Firestore functions
        const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
        const db = getFirestore();
        
        // Get all physicians
        const physiciansRef = collection(db, 'physicians');
        const snapshot = await getDocs(physiciansRef);
        
        let total = 0;
        let hasName = 0;
        let hasFullName = 0;
        let needsNameMigration = 0;
        
        snapshot.forEach(doc => {
            total++;
            const data = doc.data();
            const physicianName = data.name || data.full_name || 'Unknown';
            
            if (data.name) hasName++;
            if (data.full_name) hasFullName++;
            
            if (data.name && !data.full_name) {
                needsNameMigration++;
                console.log(`⚠️ Needs name migration: ${physicianName}`);
            }
        });
        
        console.log(`📊 Name Status: ${total} total, ${hasName} have name, ${hasFullName} have full_name, ${needsNameMigration} need migration`);
        return { total, hasName, hasFullName, needsNameMigration };
        
    } catch (error) {
        console.error('❌ Status check failed:', error);
        throw error;
    }
};

// Tray Name Migration Functions
window.runTrayNameMigration = async function() {
    try {
        if (!window.app?.dataManager?.db) {
            throw new Error('Database not available');
        }

        console.log('🔄 Starting tray name migration...');
        const { TrayNameMigration } = await import('./migration/migrateTrayName.js');
        const migration = new TrayNameMigration(window.app.dataManager.db);
        
        // Check status first
        const status = await migration.checkMigrationStatus();
        console.log('📊 Pre-migration status:', status);
        
        if (!status.needsMigration) {
            console.log('✅ No migration needed - all trays already use tray_name');
            return status;
        }
        
        // Run the migration
        const result = await migration.migrateTrayNameField();
        console.log('✅ Tray name migration completed:', result);
        
        if (result.success) {
            // Check final status
            const finalStatus = await migration.checkMigrationStatus();
            console.log('📊 Post-migration status:', finalStatus);
            
            return {
                ...result,
                finalStatus
            };
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Tray name migration failed:', error);
        throw error;
    }
};

window.checkTrayNameStatus = async function() {
    try {
        if (!window.app?.dataManager?.db) {
            throw new Error('Database not available');
        }

        const { TrayNameMigration } = await import('./migration/migrateTrayName.js');
        const migration = new TrayNameMigration(window.app.dataManager.db);
        return await migration.checkMigrationStatus();
        
    } catch (error) {
        console.error('❌ Tray name status check failed:', error);
        throw error;
    }
};

// Tray Timestamp Migration Functions
window.runTrayTimestampMigration = async function() {
    try {
        if (!window.app?.dataManager?.db) {
            throw new Error('Database not available');
        }

        console.log('🔄 Starting tray timestamp migration...');
        const { TrayTimestampMigration } = await import('./migration/migrateTrayTimestamps.js');
        const migration = new TrayTimestampMigration(window.app.dataManager.db);
        
        // Check status first
        const status = await migration.checkTimestampStatus();
        console.log('📊 Pre-migration status:', status);
        
        if (!status.needsMigration) {
            console.log('✅ No timestamp migration needed - all trays already use created_at/updated_at');
            return status;
        }
        
        // Run the migration
        const result = await migration.migrateTrayTimestamps();
        console.log('✅ Tray timestamp migration completed:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Tray timestamp migration failed:', error);
        throw error;
    }
};

window.checkTrayTimestampStatus = async function() {
    try {
        if (!window.app?.dataManager?.db) {
            throw new Error('Database not available');
        }

        const { TrayTimestampMigration } = await import('./migration/migrateTrayTimestamps.js');
        const migration = new TrayTimestampMigration(window.app.dataManager.db);
        return await migration.checkTimestampStatus();
        
    } catch (error) {
        console.error('❌ Tray timestamp status check failed:', error);
        throw error;
    }
};

// UI Helper Functions for Admin Migrations Page
window.checkTrayNameMigrationStatus = async function() {
    try {
        const statusDiv = document.getElementById('trayNameMigrationStatus');
        const resultDiv = document.getElementById('trayNameMigrationResult');
        
        statusDiv.className = 'alert alert-info';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking migration status...';
        resultDiv.classList.add('d-none');
        
        const status = await window.checkTrayNameStatus();
        
        if (status.needsMigration) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Migration needed<br>
                <small>Found ${status.nameOnly} trays with only 'name' field</small>
            `;
        } else {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = '<i class="fas fa-check"></i> All trays already use tray_name format';
        }
        
    } catch (error) {
        const statusDiv = document.getElementById('trayNameMigrationStatus');
        statusDiv.className = 'alert alert-danger';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.runTrayNameMigrationFromUI = async function() {
    try {
        const resultDiv = document.getElementById('trayNameMigrationResult');
        
        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running migration...';
        
        const result = await window.runTrayNameMigration();
        
        if (result.success) {
            resultDiv.className = 'alert alert-success';
            resultDiv.innerHTML = `
                <i class="fas fa-check"></i> Migration completed successfully<br>
                <small>Migrated: ${result.migrated} trays, Total: ${result.total}</small>
            `;
        } else {
            resultDiv.className = 'alert alert-danger';
            resultDiv.innerHTML = `<i class="fas fa-times"></i> Migration failed: ${result.error}`;
        }
        
        // Refresh status
        setTimeout(() => window.checkTrayNameMigrationStatus(), 1000);
        
    } catch (error) {
        const resultDiv = document.getElementById('trayNameMigrationResult');
        resultDiv.className = 'alert alert-danger';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.checkTrayTimestampMigrationStatus = async function() {
    try {
        const statusDiv = document.getElementById('trayTimestampMigrationStatus');
        const resultDiv = document.getElementById('trayTimestampMigrationResult');
        
        statusDiv.className = 'alert alert-info';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking timestamp migration status...';
        resultDiv.classList.add('d-none');
        
        const status = await window.checkTrayTimestampStatus();
        
        if (status.needsMigration) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Timestamp migration needed<br>
                <small>createdAt only: ${status.createdAtOnly}, updatedAt only: ${status.updatedAtOnly}, lastModified only: ${status.lastModifiedOnly}</small>
            `;
        } else {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = '<i class="fas fa-check"></i> All trays already use created_at/updated_at format';
        }
        
    } catch (error) {
        const statusDiv = document.getElementById('trayTimestampMigrationStatus');
        statusDiv.className = 'alert alert-danger';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.runTrayTimestampMigrationFromUI = async function() {
    try {
        const resultDiv = document.getElementById('trayTimestampMigrationResult');
        
        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running timestamp migration...';
        
        const result = await window.runTrayTimestampMigration();
        
        if (result.success) {
            resultDiv.className = 'alert alert-success';
            resultDiv.innerHTML = `
                <i class="fas fa-check"></i> Timestamp migration completed successfully<br>
                <small>Migrated: ${result.migrated} trays, Total: ${result.total}</small>
            `;
        } else {
            resultDiv.className = 'alert alert-danger';
            resultDiv.innerHTML = `<i class="fas fa-times"></i> Migration failed: ${result.error}`;
        }
        
        // Refresh status
        setTimeout(() => window.checkTrayTimestampMigrationStatus(), 1000);
        
    } catch (error) {
        const resultDiv = document.getElementById('trayTimestampMigrationResult');
        resultDiv.className = 'alert alert-danger';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.clearMigrationConsole = function() {
    const consoleOutput = document.getElementById('migrationConsoleOutput');
    if (consoleOutput) {
        consoleOutput.innerHTML = 'Migration console output will appear here...';
    }
};

// Facility ID Null Removal Migration Functions
window.checkFacilityIdNullStatus = async function() {
    try {
        const statusDiv = document.getElementById('facilityIdNullStatus');
        const resultDiv = document.getElementById('facilityIdNullResult');
        
        statusDiv.className = 'alert alert-info';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking facility ID status...';
        resultDiv.classList.add('d-none');
        
        const status = await window.facilityIdNullRemovalMigration.checkMigrationStatus();
        
        if (status.hasNullId > 0) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Migration needed<br>
                <small>Found ${status.hasNullId} facilities with id: null field<br>
                Total facilities: ${status.total} | Clean: ${status.noIdField} | Non-null IDs: ${status.hasNonNullId}</small>
            `;
        } else {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = '<i class="fas fa-check"></i> All facilities have clean ID fields (no id: null)';
        }
        
    } catch (error) {
        const statusDiv = document.getElementById('facilityIdNullStatus');
        statusDiv.className = 'alert alert-danger';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.runFacilityIdNullRemovalFromUI = async function() {
    try {
        const resultDiv = document.getElementById('facilityIdNullResult');
        
        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running facility ID null removal migration...';
        
        const result = await window.facilityIdNullRemovalMigration.migrateFacilities();
        
        if (result.errors === 0) {
            resultDiv.className = 'alert alert-success';
            resultDiv.innerHTML = `
                <i class="fas fa-check"></i> Migration completed successfully!<br>
                <small>Updated: ${result.updated} facilities | Skipped: ${result.skipped} | Total: ${result.total}</small>
            `;
        } else {
            resultDiv.className = 'alert alert-warning';
            resultDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Migration completed with ${result.errors} errors<br>
                <small>Updated: ${result.updated} | Skipped: ${result.skipped} | Errors: ${result.errors}</small>
            `;
        }
        
        // Refresh status
        setTimeout(() => window.checkFacilityIdNullStatus(), 1000);
        
    } catch (error) {
        const resultDiv = document.getElementById('facilityIdNullResult');
        resultDiv.className = 'alert alert-danger';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = `<i class="fas fa-times"></i> Migration failed: ${error.message}`;
    }
};

// Facility Geocoding Migration Functions
window.checkFacilityGeocodingStatus = async function() {
    try {
        const statusDiv = document.getElementById('facilityGeocodingStatus');
        const resultDiv = document.getElementById('facilityGeocodingResult');
        
        statusDiv.className = 'alert alert-info';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking geocoding status...';
        resultDiv.classList.add('d-none');
        
        const status = await window.facilityGeocodingMigration.checkGeocodingStatus();
        
        if (status.missingCoordinates > 0) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Geocoding needed<br>
                <small>
                    ${status.missingCoordinates} facilities need geocoding<br>
                    ${status.hasCoordinates} have coordinates | ${status.incompleteAddress} have incomplete addresses
                </small>
            `;
        } else if (status.incompleteAddress > 0) {
            statusDiv.className = 'alert alert-info';
            statusDiv.innerHTML = `
                <i class="fas fa-info-circle"></i> Some facilities have incomplete addresses<br>
                <small>
                    ${status.hasCoordinates} facilities have coordinates | ${status.incompleteAddress} have incomplete addresses
                </small>
            `;
        } else {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = '<i class="fas fa-check"></i> All facilities have valid coordinates';
        }
        
    } catch (error) {
        const statusDiv = document.getElementById('facilityGeocodingStatus');
        statusDiv.className = 'alert alert-danger';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.runFacilityGeocodingFromUI = async function() {
    try {
        const resultDiv = document.getElementById('facilityGeocodingResult');
        
        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running facility geocoding migration...<br><small>This may take several minutes depending on the number of facilities.</small>';
        
        const result = await window.facilityGeocodingMigration.migrateFacilityCoordinates();
        
        if (result.errors === 0) {
            resultDiv.className = 'alert alert-success';
            resultDiv.innerHTML = `
                <i class="fas fa-check"></i> Geocoding migration completed successfully!<br>
                <small>Updated: ${result.updated} facilities | Skipped: ${result.skipped} | Total: ${result.total}</small>
            `;
        } else {
            resultDiv.className = 'alert alert-warning';
            resultDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Geocoding completed with ${result.errors} errors<br>
                <small>Updated: ${result.updated} | Skipped: ${result.skipped} | Errors: ${result.errors}</small>
            `;
        }
        
        // Refresh status
        setTimeout(() => window.checkFacilityGeocodingStatus(), 2000);
        
    } catch (error) {
        const resultDiv = document.getElementById('facilityGeocodingResult');
        resultDiv.className = 'alert alert-danger';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = `<i class="fas fa-times"></i> Geocoding migration failed: ${error.message}`;
    }
};

// Physician Activation Migration Functions
window.activateAllPhysicians = async function() {
    try {
        console.log('🔄 Starting physician activation migration...');

        // Import Firestore functions
        const { getFirestore, collection, getDocs, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
        const db = getFirestore();

        // Get all physicians
        const physiciansRef = collection(db, 'physicians');
        const snapshot = await getDocs(physiciansRef);

        let processed = 0;
        let activated = 0;
        let alreadyActive = 0;
        let errors = [];

        for (const doc of snapshot.docs) {
            processed++;
            const data = doc.data();
            const physicianName = data.full_name || data.name || 'Unknown';

            try {
                // Check if physician is inactive (has active: false)
                if (data.active === false) {
                    console.log(`Activating physician: ${physicianName} (${doc.id})`);

                    // Set active to true
                    await updateDoc(doc.ref, { active: true });
                    console.log(`✅ Activated: ${physicianName}`);
                    activated++;
                } else {
                    // Physician is already active (active: true or no active field)
                    console.log(`⏭️  Already active: ${physicianName}`);
                    alreadyActive++;
                }
            } catch (error) {
                console.error(`❌ Error processing physician ${physicianName}:`, error);
                errors.push({
                    physicianId: doc.id,
                    physicianName,
                    error: error.message
                });
            }
        }

        const result = {
            success: true,
            message: `Physician activation completed`,
            processed,
            activated,
            alreadyActive,
            errors
        };

        console.log(`✅ Physician activation complete: ${processed} processed, ${activated} activated, ${alreadyActive} already active, ${errors.length} errors`);

        if (errors.length > 0) {
            console.error('Activation errors:', errors);
        }

        return result;

    } catch (error) {
        console.error('❌ Physician activation failed:', error);
        throw error;
    }
};

window.checkPhysicianActivationStatus = async function() {
    try {
        console.log('📊 Checking physician activation status...');

        // Import Firestore functions
        const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
        const db = getFirestore();

        // Get all physicians
        const physiciansRef = collection(db, 'physicians');
        const snapshot = await getDocs(physiciansRef);

        let total = 0;
        let active = 0;
        let inactive = 0;
        let noActiveField = 0;
        const details = [];

        snapshot.forEach(doc => {
            total++;
            const data = doc.data();
            const physicianName = data.full_name || data.name || 'Unknown';

            if (data.active === false) {
                inactive++;
                details.push({
                    id: doc.id,
                    name: physicianName,
                    status: 'inactive'
                });
                console.log(`❌ Inactive: ${physicianName} (${doc.id})`);
            } else if (data.active === true) {
                active++;
                details.push({
                    id: doc.id,
                    name: physicianName,
                    status: 'active'
                });
            } else {
                noActiveField++;
                active++; // Physicians without active field are considered active by default
                details.push({
                    id: doc.id,
                    name: physicianName,
                    status: 'no_active_field'
                });
            }
        });

        console.log(`📊 Activation Status: ${total} total, ${active} active, ${inactive} inactive, ${noActiveField} no active field`);

        return { total, active, inactive, noActiveField, details, needsActivation: inactive > 0 };

    } catch (error) {
        console.error('❌ Status check failed:', error);
        throw error;
    }
};

// UI Helper Functions for Physician Activation Migration
window.checkPhysicianActivationStatusFromUI = async function() {
    try {
        const statusDiv = document.getElementById('physicianActivationStatus');
        const resultDiv = document.getElementById('physicianActivationResult');

        if (!statusDiv) {
            console.error('Status div not found - make sure you have the UI elements');
            return;
        }

        statusDiv.className = 'alert alert-info';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking physician activation status...';
        resultDiv?.classList.add('d-none');

        const status = await window.checkPhysicianActivationStatus();

        if (status.needsActivation) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> ${status.inactive} physicians need activation<br>
                <small>Active: ${status.active} | Inactive: ${status.inactive} | Total: ${status.total}</small>
            `;
        } else {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = `<i class="fas fa-check"></i> All physicians are active (${status.active}/${status.total})`;
        }

    } catch (error) {
        const statusDiv = document.getElementById('physicianActivationStatus');
        if (statusDiv) {
            statusDiv.className = 'alert alert-danger';
            statusDiv.classList.remove('d-none');
            statusDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
        }
        console.error('Error checking physician activation status:', error);
    }
};

window.activateAllPhysiciansFromUI = async function() {
    try {
        const resultDiv = document.getElementById('physicianActivationResult');

        if (!resultDiv) {
            console.error('Result div not found - make sure you have the UI elements');
            return;
        }

        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activating all physicians...';

        const result = await window.activateAllPhysicians();

        if (result.errors === 0) {
            resultDiv.className = 'alert alert-success';
            resultDiv.innerHTML = `
                <i class="fas fa-check"></i> Activation completed successfully!<br>
                <small>Activated: ${result.activated} physicians | Already active: ${result.alreadyActive} | Total: ${result.processed}</small>
            `;
        } else {
            resultDiv.className = 'alert alert-warning';
            resultDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Activation completed with ${result.errors.length} errors<br>
                <small>Activated: ${result.activated} | Already active: ${result.alreadyActive} | Errors: ${result.errors.length}</small>
            `;
        }

        // Refresh status
        setTimeout(() => window.checkPhysicianActivationStatusFromUI(), 1000);

    } catch (error) {
        const resultDiv = document.getElementById('physicianActivationResult');
        if (resultDiv) {
            resultDiv.className = 'alert alert-danger';
            resultDiv.classList.remove('d-none');
            resultDiv.innerHTML = `<i class="fas fa-times"></i> Activation failed: ${error.message}`;
        }
        console.error('Error activating physicians:', error);
    }
};

// Facility Name to Account Name Migration Functions
window.checkFacilityNameToAccountNameStatus = async function() {
    try {
        const statusDiv = document.getElementById('facilityNameToAccountNameStatus');
        const resultDiv = document.getElementById('facilityNameToAccountNameResult');
        
        statusDiv.className = 'alert alert-info';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking name/account_name status...';
        resultDiv.classList.add('d-none');
        
        const status = await window.facilityNameToAccountNameMigration.checkMigrationStatus();
        
        if (status.hasNameOnly > 0 || status.hasBothMatching > 0) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Migration needed<br>
                <small>
                    Name only: ${status.hasNameOnly} | Both matching: ${status.hasBothMatching} | Conflicts: ${status.hasBothConflicting}<br>
                    Account name only: ${status.hasAccountNameOnly} | Neither: ${status.hasNeither}
                </small>
            `;
        } else if (status.hasBothConflicting > 0) {
            statusDiv.className = 'alert alert-info';
            statusDiv.innerHTML = `
                <i class="fas fa-info-circle"></i> Manual review needed<br>
                <small>${status.hasBothConflicting} facilities have conflicting name/account_name values</small>
            `;
        } else {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = '<i class="fas fa-check"></i> All facilities use account_name consistently';
        }
        
    } catch (error) {
        const statusDiv = document.getElementById('facilityNameToAccountNameStatus');
        statusDiv.className = 'alert alert-danger';
        statusDiv.classList.remove('d-none');
        statusDiv.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
    }
};

window.runFacilityNameToAccountNameFromUI = async function() {
    try {
        const resultDiv = document.getElementById('facilityNameToAccountNameResult');
        
        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running name to account_name migration...';
        
        const result = await window.facilityNameToAccountNameMigration.migrateFacilities();
        
        if (result.errors === 0) {
            resultDiv.className = 'alert alert-success';
            resultDiv.innerHTML = `
                <i class="fas fa-check"></i> Migration completed successfully!<br>
                <small>Updated: ${result.updated} facilities | Skipped: ${result.skipped} | Total: ${result.total}</small>
            `;
        } else {
            resultDiv.className = 'alert alert-warning';
            resultDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> Migration completed with ${result.errors} errors<br>
                <small>Updated: ${result.updated} | Skipped: ${result.skipped} | Errors: ${result.errors}</small>
            `;
        }
        
        // Refresh status
        setTimeout(() => window.checkFacilityNameToAccountNameStatus(), 1000);
        
    } catch (error) {
        const resultDiv = document.getElementById('facilityNameToAccountNameResult');
        resultDiv.className = 'alert alert-danger';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = `<i class="fas fa-times"></i> Migration failed: ${error.message}`;
    }
};