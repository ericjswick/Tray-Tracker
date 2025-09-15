// FacilityIdNullRemovalMigration.js - Remove id:null fields from facility documents
import { collection, getDocs, updateDoc, doc, deleteField } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class FacilityIdNullRemovalMigration {
    constructor(db) {
        this.db = db;
    }

    async migrateFacilities() {
        try {
            console.log('🔄 Starting facility id:null removal migration...');
            
            // Get all facilities
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            let updatedCount = 0;
            let skippedCount = 0;
            let errors = [];
            
            for (const facilityDoc of facilitiesSnapshot.docs) {
                const facilityData = facilityDoc.data();
                const facilityId = facilityDoc.id;
                
                try {
                    // Check if facility has id field that is null
                    if (facilityData.hasOwnProperty('id') && facilityData.id === null) {
                        console.log(`🔧 Removing id:null from facility: ${facilityData.account_name || facilityId}`);
                        
                        // Remove the id field from the document
                        await updateDoc(doc(this.db, 'facilities', facilityId), {
                            id: deleteField()
                        });
                        
                        updatedCount++;
                        console.log(`✅ Removed id:null from facility: ${facilityData.account_name || facilityId}`);
                    } else if (facilityData.hasOwnProperty('id') && facilityData.id !== null) {
                        console.log(`⚠️ Facility ${facilityData.account_name || facilityId} has id: ${facilityData.id} (not null, skipping)`);
                        skippedCount++;
                    } else {
                        console.log(`⏭️ Facility ${facilityData.account_name || facilityId} has no id field (skipping)`);
                        skippedCount++;
                    }
                } catch (error) {
                    const errorMsg = `Error updating facility ${facilityData.account_name || facilityId}: ${error.message}`;
                    console.error('❌', errorMsg);
                    errors.push(errorMsg);
                }
            }
            
            const result = {
                total: facilitiesSnapshot.docs.length,
                updated: updatedCount,
                skipped: skippedCount,
                errors: errors.length,
                errorDetails: errors
            };
            
            console.log(`🎉 Migration completed!`);
            console.log(`📊 Results: ${result.total} total, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);
            
            if (errors.length > 0) {
                console.error('❌ Errors encountered:', errors);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    async checkMigrationStatus() {
        try {
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            let hasNullId = 0;
            let hasNonNullId = 0;
            let noIdField = 0;
            let facilities = [];
            
            for (const facilityDoc of facilitiesSnapshot.docs) {
                const facilityData = facilityDoc.data();
                const facilityInfo = {
                    documentId: facilityDoc.id,
                    name: facilityData.account_name || 'Unknown',
                    idField: facilityData.hasOwnProperty('id') ? facilityData.id : 'NOT_PRESENT'
                };
                
                if (facilityData.hasOwnProperty('id')) {
                    if (facilityData.id === null) {
                        hasNullId++;
                        facilityInfo.status = 'HAS_NULL_ID';
                    } else {
                        hasNonNullId++;
                        facilityInfo.status = 'HAS_NON_NULL_ID';
                    }
                } else {
                    noIdField++;
                    facilityInfo.status = 'NO_ID_FIELD';
                }
                
                facilities.push(facilityInfo);
            }
            
            console.log(`📊 Migration Status:`);
            console.log(`   ${hasNullId} facilities have id: null (need migration)`);
            console.log(`   ${hasNonNullId} facilities have non-null id values`);
            console.log(`   ${noIdField} facilities have no id field (clean)`);
            
            if (hasNullId > 0) {
                console.log(`\n🔍 Facilities with id: null:`);
                facilities
                    .filter(f => f.status === 'HAS_NULL_ID')
                    .forEach(f => console.log(`   - ${f.name} (${f.documentId})`));
            }
            
            return { 
                hasNullId, 
                hasNonNullId, 
                noIdField, 
                total: facilitiesSnapshot.docs.length,
                facilities 
            };
            
        } catch (error) {
            console.error('❌ Status check failed:', error);
            throw error;
        }
    }
}

// Make it available globally for console use
if (typeof window !== 'undefined') {
    window.FacilityIdNullRemovalMigration = FacilityIdNullRemovalMigration;
}