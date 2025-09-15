// FacilityGeocodingMigration.js - Geocode facility addresses to update latitude/longitude
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class FacilityGeocodingMigration {
    constructor(db) {
        this.db = db;
        this.apiBaseUrl = 'https://traytracker-dev.serverdatahost.com/api';
    }

    async migrateFacilityCoordinates() {
        try {
            console.log('🌍 Starting facility geocoding migration...');
            
            // Get all facilities
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            let errors = [];
            
            for (const facilityDoc of facilitiesSnapshot.docs) {
                const facilityData = facilityDoc.data();
                const facilityId = facilityDoc.id;
                const facilityName = facilityData.account_name || 'Unknown Facility';
                
                try {
                    // Check if facility has address information
                    const address = facilityData.address;
                    if (!address || !address.street || !address.city || !address.state) {
                        console.log(`⏭️ Skipping ${facilityName} - incomplete address`);
                        skippedCount++;
                        continue;
                    }
                    
                    // Check if coordinates already exist and are valid
                    const hasValidCoords = facilityData.latitude && facilityData.longitude && 
                                         typeof facilityData.latitude === 'number' && 
                                         typeof facilityData.longitude === 'number' &&
                                         facilityData.latitude !== 0 && facilityData.longitude !== 0;
                    
                    if (hasValidCoords) {
                        console.log(`⏭️ Skipping ${facilityName} - already has valid coordinates (${facilityData.latitude}, ${facilityData.longitude})`);
                        skippedCount++;
                        continue;
                    }
                    
                    // Build full address string
                    const fullAddress = `${address.street}, ${address.city}, ${address.state}`;
                    if (address.zip) {
                        fullAddress += ` ${address.zip}`;
                    }
                    
                    console.log(`🔍 Geocoding ${facilityName}: ${fullAddress}`);
                    
                    // Call geocoding API
                    const coordinates = await this.geocodeAddress(fullAddress);
                    
                    if (coordinates && coordinates.lat && coordinates.lng) {
                        // Update facility with new coordinates
                        await updateDoc(doc(this.db, 'facilities', facilityId), {
                            latitude: coordinates.lat,
                            longitude: coordinates.lng,
                            geocoded_at: new Date().toISOString(),
                            geocoded_address: fullAddress
                        });
                        
                        updatedCount++;
                        console.log(`✅ Updated ${facilityName} with coordinates: ${coordinates.lat}, ${coordinates.lng}`);
                        
                        // Add small delay to avoid overwhelming the API
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                    } else {
                        const errorMsg = `Failed to geocode ${facilityName}: No coordinates returned for "${fullAddress}"`;
                        console.warn(`⚠️ ${errorMsg}`);
                        errors.push(errorMsg);
                        errorCount++;
                    }
                    
                } catch (error) {
                    const errorMsg = `Error geocoding ${facilityName}: ${error.message}`;
                    console.error('❌', errorMsg);
                    errors.push(errorMsg);
                    errorCount++;
                }
            }
            
            const result = {
                total: facilitiesSnapshot.docs.length,
                updated: updatedCount,
                skipped: skippedCount,
                errors: errorCount,
                errorDetails: errors
            };
            
            console.log(`🎉 Geocoding migration completed!`);
            console.log(`📊 Results: ${result.total} total, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);
            
            if (errors.length > 0) {
                console.error('❌ Errors encountered:', errors);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Geocoding migration failed:', error);
            throw error;
        }
    }

    async geocodeAddress(address) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/geocoding-simple`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.coordinates) {
                return {
                    lat: data.coordinates.lat,
                    lng: data.coordinates.lng
                };
            } else {
                throw new Error(data.error || 'Unknown geocoding error');
            }
            
        } catch (error) {
            console.error('Geocoding API error:', error);
            throw error;
        }
    }

    async checkGeocodingStatus() {
        try {
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            let hasCoordinates = 0;
            let missingCoordinates = 0;
            let incompleteAddress = 0;
            let facilities = [];
            
            for (const facilityDoc of facilitiesSnapshot.docs) {
                const facilityData = facilityDoc.data();
                const facilityInfo = {
                    documentId: facilityDoc.id,
                    name: facilityData.account_name || 'Unknown',
                    address: facilityData.address,
                    latitude: facilityData.latitude,
                    longitude: facilityData.longitude
                };
                
                // Check if has valid coordinates
                const hasValidCoords = facilityData.latitude && facilityData.longitude && 
                                     typeof facilityData.latitude === 'number' && 
                                     typeof facilityData.longitude === 'number' &&
                                     facilityData.latitude !== 0 && facilityData.longitude !== 0;
                
                // Check if has complete address
                const hasCompleteAddress = facilityData.address && 
                                         facilityData.address.street && 
                                         facilityData.address.city && 
                                         facilityData.address.state;
                
                if (hasValidCoords) {
                    hasCoordinates++;
                    facilityInfo.status = 'HAS_COORDINATES';
                } else if (!hasCompleteAddress) {
                    incompleteAddress++;
                    facilityInfo.status = 'INCOMPLETE_ADDRESS';
                } else {
                    missingCoordinates++;
                    facilityInfo.status = 'NEEDS_GEOCODING';
                }
                
                facilities.push(facilityInfo);
            }
            
            console.log(`📊 Geocoding Status:`);
            console.log(`   ${hasCoordinates} facilities have valid coordinates`);
            console.log(`   ${missingCoordinates} facilities need geocoding`);
            console.log(`   ${incompleteAddress} facilities have incomplete addresses`);
            
            if (missingCoordinates > 0) {
                console.log(`\n🔍 Facilities needing geocoding:`);
                facilities
                    .filter(f => f.status === 'NEEDS_GEOCODING')
                    .forEach(f => {
                        const addr = f.address ? `${f.address.street}, ${f.address.city}, ${f.address.state}` : 'No address';
                        console.log(`   - ${f.name}: ${addr}`);
                    });
            }
            
            if (incompleteAddress > 0) {
                console.log(`\n⚠️ Facilities with incomplete addresses:`);
                facilities
                    .filter(f => f.status === 'INCOMPLETE_ADDRESS')
                    .forEach(f => {
                        const addr = f.address ? JSON.stringify(f.address) : 'null';
                        console.log(`   - ${f.name}: ${addr}`);
                    });
            }
            
            return { 
                hasCoordinates, 
                missingCoordinates, 
                incompleteAddress, 
                total: facilitiesSnapshot.docs.length,
                facilities 
            };
            
        } catch (error) {
            console.error('❌ Geocoding status check failed:', error);
            throw error;
        }
    }
}

// Make it available globally for console use
if (typeof window !== 'undefined') {
    window.FacilityGeocodingMigration = FacilityGeocodingMigration;
}