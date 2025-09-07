// Fix missing tray_id fields for MyRepData compatibility
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class FixTrayIdMigration {
    constructor(db) {
        this.db = db;
    }

    async runMigration() {
        console.log('🔧 Starting tray_id field migration...');
        
        try {
            // Get all trays
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            const traysToUpdate = [];
            
            traysSnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                // If tray_id is missing, add it to update list
                if (!data.tray_id) {
                    traysToUpdate.push({
                        id: docSnap.id,
                        data: data
                    });
                }
            });

            console.log(`🔧 Found ${traysToUpdate.length} trays missing tray_id field`);
            
            if (traysToUpdate.length === 0) {
                console.log('✅ All trays already have tray_id fields');
                return { success: true, updated: 0 };
            }

            // Update each tray to add tray_id field
            let updated = 0;
            for (const tray of traysToUpdate) {
                try {
                    await updateDoc(doc(this.db, 'tray_tracking', tray.id), {
                        tray_id: tray.id // Set tray_id to match Firebase document ID
                    });
                    console.log(`✅ Updated tray "${tray.data.name}" (${tray.id})`);
                    updated++;
                } catch (error) {
                    console.error(`❌ Failed to update tray ${tray.id}:`, error);
                }
            }

            console.log(`🎉 Migration complete! Updated ${updated}/${traysToUpdate.length} trays`);
            return { success: true, updated };

        } catch (error) {
            console.error('❌ Migration failed:', error);
            return { success: false, error };
        }
    }
}

// Function to run migration manually from console
window.runTrayIdMigration = async () => {
    if (!window.app || !window.app.dataManager) {
        console.error('❌ App not loaded yet');
        return;
    }
    
    const migration = new FixTrayIdMigration(window.app.dataManager.db);
    return await migration.runMigration();
};