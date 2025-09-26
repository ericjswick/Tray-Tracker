// PhysicianTimestampMigration.js - Move physicians.createdAt to physicians.created_at
import { collection, getDocs, updateDoc, doc, deleteField } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class PhysicianTimestampMigration {
    constructor(db) {
        this.db = db;
    }

    async migratePhysicians() {
        try {
            console.log('🔄 Starting physician createdAt → created_at migration...');

            // Get all physicians
            const physiciansSnapshot = await getDocs(collection(this.db, 'physicians'));
            let updatedCount = 0;
            let skippedCount = 0;
            let errors = [];

            for (const physicianDoc of physiciansSnapshot.docs) {
                const physicianData = physicianDoc.data();
                const physicianId = physicianDoc.id;

                try {
                    // Check if physician has createdAt field but no created_at field
                    if (physicianData.hasOwnProperty('createdAt') && physicianData.createdAt &&
                        !physicianData.hasOwnProperty('created_at')) {

                        console.log(`🔧 Moving createdAt to created_at for physician: ${physicianData.full_name || physicianId}`);

                        // Update the document: set created_at and remove createdAt
                        await updateDoc(doc(this.db, 'physicians', physicianId), {
                            created_at: physicianData.createdAt,
                            createdAt: deleteField()
                        });

                        updatedCount++;
                        console.log(`✅ Migrated physician: ${physicianData.full_name || physicianId} → created_at`);

                    } else if (physicianData.hasOwnProperty('createdAt') && physicianData.createdAt &&
                               physicianData.hasOwnProperty('created_at')) {

                        // Both fields exist - check if they match
                        const createdAtTime = physicianData.createdAt?.toDate?.()?.getTime() || physicianData.createdAt?.getTime?.() || new Date(physicianData.createdAt).getTime();
                        const created_atTime = physicianData.created_at?.toDate?.()?.getTime() || physicianData.created_at?.getTime?.() || new Date(physicianData.created_at).getTime();

                        if (createdAtTime === created_atTime) {
                            console.log(`🔧 Removing duplicate createdAt field for physician: ${physicianData.full_name || physicianId}`);

                            // Remove the createdAt field since created_at already exists with same value
                            await updateDoc(doc(this.db, 'physicians', physicianId), {
                                createdAt: deleteField()
                            });

                            updatedCount++;
                            console.log(`✅ Removed duplicate createdAt field: ${physicianData.full_name || physicianId}`);
                        } else {
                            console.log(`⚠️ Physician ${physicianData.full_name || physicianId} has conflicting createdAt and created_at timestamps - keeping both`);
                            skippedCount++;
                        }

                    } else if (!physicianData.hasOwnProperty('createdAt') && physicianData.hasOwnProperty('created_at')) {
                        console.log(`⏭️ Physician ${physicianData.full_name || physicianId} already has created_at, no createdAt field (skipping)`);
                        skippedCount++;
                    } else if (!physicianData.hasOwnProperty('createdAt') && !physicianData.hasOwnProperty('created_at')) {
                        console.log(`⏭️ Physician ${physicianData.full_name || physicianId} has no timestamp fields (skipping)`);
                        skippedCount++;
                    } else {
                        console.log(`⏭️ Physician ${physicianData.full_name || physicianId} doesn't need migration (skipping)`);
                        skippedCount++;
                    }
                } catch (error) {
                    const errorMsg = `Error updating physician ${physicianData.full_name || physicianId}: ${error.message}`;
                    console.error('❌', errorMsg);
                    errors.push(errorMsg);
                }
            }

            const result = {
                total: physiciansSnapshot.docs.length,
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
            const physiciansSnapshot = await getDocs(collection(this.db, 'physicians'));
            let needsMigration = 0;
            let alreadyMigrated = 0;
            let noTimestamp = 0;
            let conflicting = 0;

            for (const doc of physiciansSnapshot.docs) {
                const data = doc.data();

                if (data.hasOwnProperty('createdAt') && data.createdAt &&
                    !data.hasOwnProperty('created_at')) {
                    needsMigration++;
                } else if (data.hasOwnProperty('createdAt') && data.createdAt &&
                           data.hasOwnProperty('created_at')) {
                    // Both exist - check if they're the same
                    const createdAtTime = data.createdAt?.toDate?.()?.getTime() || data.createdAt?.getTime?.() || new Date(data.createdAt).getTime();
                    const created_atTime = data.created_at?.toDate?.()?.getTime() || data.created_at?.getTime?.() || new Date(data.created_at).getTime();

                    if (createdAtTime === created_atTime) {
                        needsMigration++; // Duplicate field to clean up
                    } else {
                        conflicting++;
                    }
                } else if (data.hasOwnProperty('created_at')) {
                    alreadyMigrated++;
                } else {
                    noTimestamp++;
                }
            }

            return {
                total: physiciansSnapshot.docs.length,
                needsMigration,
                alreadyMigrated,
                noTimestamp,
                conflicting,
                ready: needsMigration > 0
            };
        } catch (error) {
            console.error('❌ Error checking migration status:', error);
            throw error;
        }
    }
}