// GeolocationMigration.js - Add geolocation data to facilities based on their addresses
import { collection, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class GeolocationMigration {
    constructor(db) {
        this.db = db;
        this.results = {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
    }

    /**
     * Call geocoding API to get coordinates for an address
     * @param {string} address - The address to geocode
     * @returns {Promise<Object|null>} - Coordinates object or null if failed
     */
    async geocodeAddress(address) {
        if (!address || address.trim().length === 0) {
            return null;
        }

        try {
            // Using a free geocoding service (you can replace with your preferred service)
            // This example uses Nominatim (OpenStreetMap's geocoding service)
            const encodedAddress = encodeURIComponent(address.trim());
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`
            );

            if (!response.ok) {
                console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                // Validate coordinates
                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    console.warn(`Invalid coordinates received for address: ${address}`);
                    return null;
                }

                return {
                    latitude: lat,
                    longitude: lon,
                    geocoded_address: result.display_name || address,
                    geocoding_accuracy: result.importance || 0,
                    geocoding_source: 'nominatim',
                    geocoded_at: new Date().toISOString()
                };
            }

            return null;
        } catch (error) {
            console.error(`Error geocoding address "${address}":`, error);
            return null;
        }
    }

    /**
     * Build address string from facility data
     * @param {Object} facility - Facility document data
     * @returns {string} - Formatted address string
     */
    buildAddressString(facility) {
        const addressParts = [];
        
        // Try different address field variations
        if (facility.street_address || facility.address) {
            addressParts.push(facility.street_address || facility.address);
        }
        
        if (facility.city) {
            addressParts.push(facility.city);
        }
        
        if (facility.state || facility.state_province) {
            addressParts.push(facility.state || facility.state_province);
        }
        
        if (facility.postal_code || facility.zip_code) {
            addressParts.push(facility.postal_code || facility.zip_code);
        }
        
        if (facility.country) {
            addressParts.push(facility.country);
        }

        return addressParts.join(', ');
    }

    /**
     * Check if facility already has geolocation data
     * @param {Object} facility - Facility document data
     * @returns {boolean} - True if facility already has coordinates
     */
    hasGeolocationData(facility) {
        return facility.latitude != null && facility.longitude != null;
    }

    /**
     * Update facility with geolocation data
     * @param {string} facilityId - Document ID
     * @param {Object} geoData - Geolocation data to store
     */
    async updateFacilityGeolocation(facilityId, geoData) {
        const facilityRef = doc(this.db, 'facilities', facilityId);
        await updateDoc(facilityRef, {
            latitude: geoData.latitude,
            longitude: geoData.longitude,
            geocoded_address: geoData.geocoded_address,
            geocoding_accuracy: geoData.geocoding_accuracy,
            geocoding_source: geoData.geocoding_source,
            geocoded_at: geoData.geocoded_at
        });
    }

    /**
     * Add artificial delay to be respectful to geocoding API
     * @param {number} ms - Milliseconds to wait
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Main migration function to geocode all facilities
     * @param {Object} options - Migration options
     * @returns {Promise<Object>} - Migration results
     */
    async migrateFacilitiesGeolocation(options = {}) {
        const {
            skipExisting = true,
            delayBetweenRequests = 1000, // 1 second delay between API calls
            onProgress = null,
            onFacilityProcessed = null
        } = options;

        console.log('🗺️ Starting facilities geolocation migration...');
        
        try {
            // Reset results
            this.results = {
                total: 0,
                processed: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                errors: []
            };

            // Get all facilities
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            const facilities = [];
            
            facilitiesSnapshot.forEach((doc) => {
                facilities.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.results.total = facilities.length;
            console.log(`📊 Found ${facilities.length} facilities to process`);

            // Process each facility
            for (const facility of facilities) {
                try {
                    this.results.processed++;
                    
                    // Skip if already has geolocation data
                    if (skipExisting && this.hasGeolocationData(facility)) {
                        this.results.skipped++;
                        console.log(`⏭️ Skipping facility ${facility.name || facility.id} - already has coordinates`);
                        
                        if (onFacilityProcessed) {
                            onFacilityProcessed({
                                facility,
                                status: 'skipped',
                                reason: 'Already has coordinates'
                            });
                        }
                        continue;
                    }

                    // Build address string
                    const address = this.buildAddressString(facility);
                    
                    if (!address) {
                        this.results.failed++;
                        const error = `No address data found for facility: ${facility.name || facility.id}`;
                        this.results.errors.push(error);
                        console.warn(`⚠️ ${error}`);
                        
                        if (onFacilityProcessed) {
                            onFacilityProcessed({
                                facility,
                                status: 'failed',
                                reason: 'No address data'
                            });
                        }
                        continue;
                    }

                    console.log(`🗺️ Geocoding facility: ${facility.name || facility.id} - ${address}`);

                    // Call geocoding API
                    const geoData = await this.geocodeAddress(address);
                    
                    if (geoData) {
                        // Update facility with coordinates
                        await this.updateFacilityGeolocation(facility.id, geoData);
                        this.results.successful++;
                        
                        console.log(`✅ Successfully geocoded ${facility.name || facility.id}: ${geoData.latitude}, ${geoData.longitude}`);
                        
                        if (onFacilityProcessed) {
                            onFacilityProcessed({
                                facility,
                                status: 'success',
                                geoData,
                                address
                            });
                        }
                    } else {
                        this.results.failed++;
                        const error = `Failed to geocode address for facility: ${facility.name || facility.id} - ${address}`;
                        this.results.errors.push(error);
                        console.warn(`❌ ${error}`);
                        
                        if (onFacilityProcessed) {
                            onFacilityProcessed({
                                facility,
                                status: 'failed',
                                reason: 'Geocoding failed',
                                address
                            });
                        }
                    }

                    // Progress callback
                    if (onProgress) {
                        onProgress({
                            ...this.results,
                            currentFacility: facility.name || facility.id
                        });
                    }

                    // Respectful delay between API calls
                    if (delayBetweenRequests > 0) {
                        await this.delay(delayBetweenRequests);
                    }

                } catch (error) {
                    this.results.failed++;
                    const errorMsg = `Error processing facility ${facility.name || facility.id}: ${error.message}`;
                    this.results.errors.push(errorMsg);
                    console.error(`❌ ${errorMsg}`, error);
                    
                    if (onFacilityProcessed) {
                        onFacilityProcessed({
                            facility,
                            status: 'error',
                            error: error.message
                        });
                    }
                }
            }

            console.log('🏁 Geolocation migration completed:', this.results);
            return this.results;

        } catch (error) {
            console.error('❌ Error during geolocation migration:', error);
            throw error;
        }
    }

    /**
     * Get migration status - count facilities with/without coordinates
     * @returns {Promise<Object>} - Status information
     */
    async getMigrationStatus() {
        try {
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            const status = {
                total: 0,
                withCoordinates: 0,
                withoutCoordinates: 0,
                withoutAddresses: 0
            };

            facilitiesSnapshot.forEach((doc) => {
                const facility = doc.data();
                status.total++;

                if (this.hasGeolocationData(facility)) {
                    status.withCoordinates++;
                } else {
                    status.withoutCoordinates++;
                    
                    const address = this.buildAddressString(facility);
                    if (!address) {
                        status.withoutAddresses++;
                    }
                }
            });

            return status;
        } catch (error) {
            console.error('Error getting migration status:', error);
            throw error;
        }
    }
}