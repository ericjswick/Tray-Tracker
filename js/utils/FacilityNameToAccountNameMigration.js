// FacilityNameToAccountNameMigration.js - Move facilities.name to facilities.account_name
import { collection, getDocs, updateDoc, doc, deleteField } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class FacilityNameToAccountNameMigration {
    constructor(db) {
        this.db = db;
    }

    async migrateFacilities() {
        try {
            console.log('🔄 Starting facility name → account_name migration...');
            
            // Get all facilities
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            let updatedCount = 0;
            let skippedCount = 0;
            let errors = [];
            
            for (const facilityDoc of facilitiesSnapshot.docs) {
                const facilityData = facilityDoc.data();
                const facilityId = facilityDoc.id;
                
                try {
                    // Check if facility has name field but no account_name field
                    if (facilityData.hasOwnProperty('name') && facilityData.name && 
                        !facilityData.hasOwnProperty('account_name')) {
                        
                        console.log(`🔧 Moving name to account_name for facility: ${facilityData.name}`);
                        
                        // Update the document: set account_name and remove name
                        await updateDoc(doc(this.db, 'facilities', facilityId), {
                            account_name: facilityData.name,
                            name: deleteField()
                        });
                        
                        updatedCount++;
                        console.log(`✅ Migrated facility: ${facilityData.name} → account_name`);
                        
                    } else if (facilityData.hasOwnProperty('name') && facilityData.name && 
                               facilityData.hasOwnProperty('account_name')) {
                        
                        // Both fields exist - check if they match
                        if (facilityData.name === facilityData.account_name) {
                            console.log(`🔧 Removing duplicate name field for facility: ${facilityData.account_name}`);
                            
                            // Remove the name field since account_name already exists with same value
                            await updateDoc(doc(this.db, 'facilities', facilityId), {
                                name: deleteField()
                            });
                            
                            updatedCount++;
                            console.log(`✅ Removed duplicate name field: ${facilityData.account_name}`);
                        } else {
                            console.log(`⚠️ Facility ${facilityId} has conflicting name (${facilityData.name}) and account_name (${facilityData.account_name}) - skipping`);
                            skippedCount++;
                        }
                        
                    } else if (!facilityData.hasOwnProperty('name') && facilityData.hasOwnProperty('account_name')) {
                        console.log(`⏭️ Facility ${facilityData.account_name} already has account_name, no name field (skipping)`);
                        skippedCount++;
                    } else if (!facilityData.hasOwnProperty('name') && !facilityData.hasOwnProperty('account_name')) {
                        console.log(`⚠️ Facility ${facilityId} has no name or account_name field (skipping)`);
                        skippedCount++;
                    } else {
                        console.log(`⏭️ Facility ${facilityData.account_name || facilityId} doesn't need migration (skipping)`);
                        skippedCount++;
                    }
                } catch (error) {
                    const errorMsg = `Error updating facility ${facilityData.name || facilityData.account_name || facilityId}: ${error.message}`;
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
            let hasNameOnly = 0;
            let hasAccountNameOnly = 0;
            let hasBothMatching = 0;
            let hasBothConflicting = 0;
            let hasNeither = 0;
            let facilities = [];
            
            for (const facilityDoc of facilitiesSnapshot.docs) {
                const facilityData = facilityDoc.data();
                const facilityInfo = {
                    documentId: facilityDoc.id,
                    name: facilityData.name || null,
                    account_name: facilityData.account_name || null
                };
                
                if (facilityData.hasOwnProperty('name') && facilityData.name && 
                    !facilityData.hasOwnProperty('account_name')) {
                    hasNameOnly++;
                    facilityInfo.status = 'HAS_NAME_ONLY';
                } else if (!facilityData.hasOwnProperty('name') && 
                           facilityData.hasOwnProperty('account_name') && facilityData.account_name) {
                    hasAccountNameOnly++;
                    facilityInfo.status = 'HAS_ACCOUNT_NAME_ONLY';
                } else if (facilityData.hasOwnProperty('name') && facilityData.name && 
                           facilityData.hasOwnProperty('account_name') && facilityData.account_name) {
                    if (facilityData.name === facilityData.account_name) {
                        hasBothMatching++;
                        facilityInfo.status = 'HAS_BOTH_MATCHING';
                    } else {
                        hasBothConflicting++;
                        facilityInfo.status = 'HAS_BOTH_CONFLICTING';
                    }
                } else {
                    hasNeither++;
                    facilityInfo.status = 'HAS_NEITHER';
                }
                
                facilities.push(facilityInfo);
            }
            
            console.log(`📊 Migration Status:`);
            console.log(`   ${hasNameOnly} facilities have name only (need migration)`);
            console.log(`   ${hasBothMatching} facilities have both matching (can remove name)`);
            console.log(`   ${hasBothConflicting} facilities have both conflicting (manual review needed)`);
            console.log(`   ${hasAccountNameOnly} facilities have account_name only (clean)`);
            console.log(`   ${hasNeither} facilities have neither field`);
            
            if (hasNameOnly > 0) {
                console.log(`\n🔍 Facilities with name only (need migration):`);
                facilities
                    .filter(f => f.status === 'HAS_NAME_ONLY')
                    .forEach(f => console.log(`   - ${f.name} (${f.documentId})`));
            }
            
            if (hasBothMatching > 0) {
                console.log(`\n🔍 Facilities with matching name/account_name (can clean up):`);
                facilities
                    .filter(f => f.status === 'HAS_BOTH_MATCHING')
                    .forEach(f => console.log(`   - ${f.account_name} (${f.documentId})`));
            }
            
            if (hasBothConflicting > 0) {
                console.log(`\n⚠️ Facilities with conflicting name/account_name (manual review):`);
                facilities
                    .filter(f => f.status === 'HAS_BOTH_CONFLICTING')
                    .forEach(f => console.log(`   - name: "${f.name}" vs account_name: "${f.account_name}" (${f.documentId})`));
            }
            
            return { 
                hasNameOnly, 
                hasAccountNameOnly, 
                hasBothMatching,
                hasBothConflicting,
                hasNeither,
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
    window.FacilityNameToAccountNameMigration = FacilityNameToAccountNameMigration;
}