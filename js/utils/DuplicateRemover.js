// DuplicateRemover.js - Utility to remove duplicate data from Firebase collections
import { 
    collection, 
    getDocs, 
    deleteDoc, 
    doc,
    query,
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class DuplicateRemover {
    constructor(db) {
        this.db = db;
    }

    // Remove duplicate locations based on name
    async removeDuplicateLocations() {
        try {
            console.log('Starting duplicate location removal...');
            const locationsSnapshot = await getDocs(collection(this.db, 'locations'));
            
            const locationMap = new Map();
            const duplicatesToDelete = [];
            
            // Group locations by name, keeping the first one (oldest)
            locationsSnapshot.forEach((doc) => {
                const data = doc.data();
                const name = data.name?.trim().toLowerCase();
                
                if (!name) {
                    console.warn('Found location without name:', doc.id);
                    return;
                }
                
                if (locationMap.has(name)) {
                    // This is a duplicate - mark for deletion
                    duplicatesToDelete.push({
                        id: doc.id,
                        name: data.name,
                        originalId: locationMap.get(name).id
                    });
                    console.log(`Found duplicate location: "${data.name}" (${doc.id}), keeping original (${locationMap.get(name).id})`);
                } else {
                    // First occurrence - keep this one
                    locationMap.set(name, {
                        id: doc.id,
                        name: data.name,
                        data: data
                    });
                }
            });

            console.log(`Found ${duplicatesToDelete.length} duplicate locations to remove`);
            
            // Delete duplicates
            for (const duplicate of duplicatesToDelete) {
                try {
                    await deleteDoc(doc(this.db, 'locations', duplicate.id));
                    console.log(`✓ Deleted duplicate location: "${duplicate.name}" (${duplicate.id})`);
                } catch (error) {
                    console.error(`✗ Error deleting location ${duplicate.id}:`, error);
                }
            }
            
            console.log(`Completed location deduplication. Removed ${duplicatesToDelete.length} duplicates.`);
            return duplicatesToDelete.length;
            
        } catch (error) {
            console.error('Error removing duplicate locations:', error);
            throw error;
        }
    }

    // Remove duplicate surgeons based on name or email
    async removeDuplicateSurgeons() {
        try {
            console.log('Starting duplicate surgeon removal...');
            const surgeonsSnapshot = await getDocs(collection(this.db, 'surgeons'));
            
            const surgeonsByName = new Map();
            const surgeonsByEmail = new Map();
            const duplicatesToDelete = [];
            
            // First pass - group by name and email
            surgeonsSnapshot.forEach((doc) => {
                const data = doc.data();
                const name = data.name?.trim();
                const email = data.email?.trim().toLowerCase();
                
                if (!name && !email) {
                    console.warn('Found surgeon without name or email:', doc.id);
                    return;
                }
                
                const surgeonInfo = {
                    id: doc.id,
                    name: data.name,
                    email: data.email,
                    data: data
                };
                
                // Check for duplicate by name
                if (name) {
                    const nameKey = name.toLowerCase();
                    if (surgeonsByName.has(nameKey)) {
                        duplicatesToDelete.push({
                            id: doc.id,
                            name: data.name,
                            email: data.email,
                            reason: 'duplicate name',
                            originalId: surgeonsByName.get(nameKey).id
                        });
                        console.log(`Found duplicate surgeon by name: "${data.name}" (${doc.id}), keeping original (${surgeonsByName.get(nameKey).id})`);
                    } else {
                        surgeonsByName.set(nameKey, surgeonInfo);
                    }
                }
                
                // Check for duplicate by email
                if (email && !duplicatesToDelete.find(d => d.id === doc.id)) {
                    if (surgeonsByEmail.has(email)) {
                        duplicatesToDelete.push({
                            id: doc.id,
                            name: data.name,
                            email: data.email,
                            reason: 'duplicate email',
                            originalId: surgeonsByEmail.get(email).id
                        });
                        console.log(`Found duplicate surgeon by email: "${data.email}" (${doc.id}), keeping original (${surgeonsByEmail.get(email).id})`);
                    } else {
                        surgeonsByEmail.set(email, surgeonInfo);
                    }
                }
            });

            console.log(`Found ${duplicatesToDelete.length} duplicate surgeons to remove`);
            
            // Delete duplicates
            for (const duplicate of duplicatesToDelete) {
                try {
                    await deleteDoc(doc(this.db, 'surgeons', duplicate.id));
                    console.log(`✓ Deleted duplicate surgeon: "${duplicate.name}" (${duplicate.email}) - ${duplicate.reason} (${duplicate.id})`);
                } catch (error) {
                    console.error(`✗ Error deleting surgeon ${duplicate.id}:`, error);
                }
            }
            
            console.log(`Completed surgeon deduplication. Removed ${duplicatesToDelete.length} duplicates.`);
            return duplicatesToDelete.length;
            
        } catch (error) {
            console.error('Error removing duplicate surgeons:', error);
            throw error;
        }
    }

    // Remove duplicate case types based on name
    async removeDuplicateCaseTypes() {
        try {
            console.log('Starting duplicate case type removal...');
            const caseTypesSnapshot = await getDocs(collection(this.db, 'casetypes'));
            
            const caseTypeMap = new Map();
            const duplicatesToDelete = [];
            
            // Group case types by name, keeping the first one (oldest)
            caseTypesSnapshot.forEach((doc) => {
                const data = doc.data();
                const name = data.name?.trim();
                
                if (!name) {
                    console.warn('Found case type without name:', doc.id);
                    return;
                }
                
                // Use case-insensitive comparison for duplicates
                const nameKey = name.toLowerCase();
                
                if (caseTypeMap.has(nameKey)) {
                    // This is a duplicate - mark for deletion
                    duplicatesToDelete.push({
                        id: doc.id,
                        name: data.name,
                        originalId: caseTypeMap.get(nameKey).id,
                        originalName: caseTypeMap.get(nameKey).name
                    });
                    console.log(`Found duplicate case type: "${data.name}" (${doc.id}), keeping original "${caseTypeMap.get(nameKey).name}" (${caseTypeMap.get(nameKey).id})`);
                } else {
                    // First occurrence - keep this one
                    caseTypeMap.set(nameKey, {
                        id: doc.id,
                        name: data.name,
                        data: data
                    });
                }
            });

            console.log(`Found ${duplicatesToDelete.length} duplicate case types to remove`);
            
            // Delete duplicates
            for (const duplicate of duplicatesToDelete) {
                try {
                    await deleteDoc(doc(this.db, 'casetypes', duplicate.id));
                    console.log(`✓ Deleted duplicate case type: "${duplicate.name}" (${duplicate.id}), kept "${duplicate.originalName}"`);
                } catch (error) {
                    console.error(`✗ Error deleting case type ${duplicate.id}:`, error);
                }
            }
            
            console.log(`Completed case type deduplication. Removed ${duplicatesToDelete.length} duplicates.`);
            return duplicatesToDelete.length;
            
        } catch (error) {
            console.error('Error removing duplicate case types:', error);
            throw error;
        }
    }

    // Remove all duplicates
    async removeAllDuplicates() {
        try {
            console.log('🧹 Starting comprehensive duplicate removal...');
            
            const locationDuplicates = await this.removeDuplicateLocations();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between operations
            
            const surgeonDuplicates = await this.removeDuplicateSurgeons();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between operations
            
            const caseTypeDuplicates = await this.removeDuplicateCaseTypes();
            
            const totalRemoved = locationDuplicates + surgeonDuplicates + caseTypeDuplicates;
            console.log(`🎉 Duplicate removal completed! Total duplicates removed: ${totalRemoved}`);
            
            // Refresh the map and data after cleanup
            if (totalRemoved > 0) {
                console.log('🔄 Refreshing map and location data after duplicate removal...');
                
                // Force refresh location data
                if (window.app && window.app.locationManager) {
                    setTimeout(() => {
                        if (window.app.locationManager.loadLocations) {
                            window.app.locationManager.loadLocations();
                        }
                    }, 1000);
                }
                
                // Force refresh tray data (which updates the map)
                if (window.app && window.app.trayManager && window.app.trayManager.loadTrays) {
                    setTimeout(() => {
                        window.app.trayManager.loadTrays();
                    }, 1500);
                }
                
                // Clear and refresh map markers
                if (window.app && window.app.mapManager && window.app.mapManager.clearAndRefreshMap) {
                    setTimeout(() => {
                        window.app.mapManager.clearAndRefreshMap();
                    }, 2000);
                }
            }
            
            return {
                locations: locationDuplicates,
                surgeons: surgeonDuplicates,
                caseTypes: caseTypeDuplicates,
                total: totalRemoved
            };
            
        } catch (error) {
            console.error('Error in comprehensive duplicate removal:', error);
            throw error;
        }
    }
}

// Make it available globally for browser console use
if (typeof window !== 'undefined') {
    window.DuplicateRemover = DuplicateRemover;
}