// UserLocationFacilityMigration.js - Add location_facility_id field to existing users
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class UserLocationFacilityMigration {
    constructor(db) {
        this.db = db;
    }

    async migrateUsers() {
        try {
            console.log('🔄 Starting user location_facility_id migration...');
            
            // Get all users
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            let updatedCount = 0;
            let skippedCount = 0;
            
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                
                // Skip if user already has location_facility_id field
                if (userData.hasOwnProperty('location_facility_id')) {
                    console.log(`⏭️ Skipping user ${userData.name} - already has location_facility_id`);
                    skippedCount++;
                    continue;
                }
                
                // Add location_facility_id field as null/empty
                await updateDoc(doc(this.db, 'users', userDoc.id), {
                    location_facility_id: null
                });
                
                console.log(`✅ Added location_facility_id to user: ${userData.name}`);
                updatedCount++;
            }
            
            console.log(`🎉 Migration completed! Updated: ${updatedCount}, Skipped: ${skippedCount}`);
            return { updated: updatedCount, skipped: skippedCount };
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    async checkMigrationStatus() {
        try {
            const usersSnapshot = await getDocs(collection(this.db, 'users'));
            let hasField = 0;
            let missingField = 0;
            
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                
                if (userData.hasOwnProperty('location_facility_id')) {
                    hasField++;
                } else {
                    missingField++;
                    console.log(`Missing location_facility_id: ${userData.name} (${userDoc.id})`);
                }
            }
            
            console.log(`📊 Migration Status: ${hasField} users have location_facility_id, ${missingField} missing`);
            return { hasField, missingField };
            
        } catch (error) {
            console.error('❌ Status check failed:', error);
            throw error;
        }
    }
}

// Make it available globally for console use
if (typeof window !== 'undefined') {
    window.UserLocationFacilityMigration = UserLocationFacilityMigration;
}