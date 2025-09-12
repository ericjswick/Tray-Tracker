// Migration script to convert locations to MyRepData-compatible facilities
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class FacilityMigration {
    constructor(db) {
        this.db = db;
    }

    async migrateLocationsToFacilities() {
        try {
            console.log('🚀 Starting migration from locations to MyRepData-compatible facilities...');
            
            // Get all existing locations
            const locationsSnapshot = await getDocs(collection(this.db, 'locations'));
            
            if (locationsSnapshot.empty) {
                console.log('📝 No existing locations found. Initializing with defaults...');
                await this.initializeDefaultFacilities();
                return;
            }

            const locations = [];
            locationsSnapshot.forEach(doc => {
                locations.push({ id: doc.id, ...doc.data() });
            });

            console.log(`📊 Found ${locations.length} locations to migrate`);

            // Check if facilities collection already has data
            const facilitiesSnapshot = await getDocs(query(collection(this.db, 'facilities')));
            if (!facilitiesSnapshot.empty) {
                console.log('⚠️ Facilities collection already has data. Skipping migration.');
                console.log('Use app.facilityManager.initializeDefaults() to add default facilities');
                return;
            }

            const migrated = [];
            const errors = [];

            // Migrate each location to facility format
            for (const location of locations) {
                try {
                    const facility = this.convertLocationToFacility(location);
                    const docRef = await addDoc(collection(this.db, 'facilities'), facility);
                    
                    migrated.push({
                        oldId: location.id,
                        newId: docRef.id,
                        name: facility.account_name
                    });
                    
                    console.log(`✅ Migrated: ${facility.account_name} (${facility.account_record_type})`);
                } catch (error) {
                    console.error(`❌ Failed to migrate location ${location.name}:`, error);
                    errors.push({ location: location.name, error: error.message });
                }
            }

            console.log(`🎉 Migration completed!`);
            console.log(`📈 Successfully migrated: ${migrated.length} facilities`);
            if (errors.length > 0) {
                console.log(`⚠️ Errors: ${errors.length}`);
                errors.forEach(err => console.log(`   - ${err.location}: ${err.error}`));
            }

            return {
                success: true,
                migrated: migrated.length,
                errors: errors.length,
                details: { migrated, errors }
            };

        } catch (error) {
            console.error('💥 Migration failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    convertLocationToFacility(location) {
        // Map old location types to MyRepData facility types
        const typeMapping = {
            'medical_facility': 'Hospital',
            'corporate': 'Hospital', // Corporate locations become hospitals for now
            'warehouse': 'Hospital',
            'rep_office': 'OBL',
            'hospital': 'Hospital',
            'asc': 'ASC',
            'surgery_center': 'ASC',
            'outpatient': 'OBL'
        };

        // Determine facility type
        let facilityType = 'Hospital'; // Default
        if (location.type) {
            facilityType = typeMapping[location.type.toLowerCase()] || 'Hospital';
        }

        // Determine specialty based on name/notes
        let specialty = 'General';
        const nameAndNotes = `${location.name || ''} ${location.notes || ''}`.toLowerCase();
        
        if (nameAndNotes.includes('spine')) {
            specialty = 'Ortho Spine';
        } else if (nameAndNotes.includes('pain')) {
            specialty = 'Pain Management';
        } else if (nameAndNotes.includes('neuro')) {
            specialty = 'Neurosurgery';
        } else if (nameAndNotes.includes('ortho')) {
            specialty = 'Ortho';
        }

        // Determine territory based on state/region
        let territory = '';
        if (location.region) {
            territory = location.region;
        } else if (location.state) {
            const state = location.state.toUpperCase();
            if (state === 'WI' || state === 'WISCONSIN') {
                territory = location.city && location.city.toLowerCase().includes('milwaukee') ? 
                    'Wisconsin East' : 'Wisconsin West';
            } else if (state === 'IL' || state === 'ILLINOIS') {
                territory = 'Illinois';
            } else if (state === 'MN' || state === 'MINNESOTA') {
                territory = 'Minnesota';
            }
        }

        // Convert to MyRepData-compatible facility structure
        return {
            name: location.name || 'Unknown Facility',
            account_record_type: facilityType,
            specialty: specialty,
            address: location.address || '',
            city: location.city || '',
            state: location.state || '',
            zip: location.zip || location.zipCode || '',
            phone: location.phone || '',
            territory: territory,
            priority: location.priority || 3,
            contact: {
                primary: location.contact || location.primaryContact || '',
                email: location.contactEmail || ''
            },
            npi: location.npi || '',
            notes: location.notes || `Migrated from location: ${location.type || 'Unknown'}`,
            active: location.active !== false,
            
            // Preserve geographic data
            latitude: location.latitude || location.lat || null,
            longitude: location.longitude || location.lng || null,
            
            // Add migration metadata
            createdAt: location.createdAt || serverTimestamp(),
            createdBy: location.createdBy || 'migration',
            modifiedBy: 'migration',
            lastModified: serverTimestamp(),
            
            // Mark as migrated data
            _migrated: true,
            _originalType: location.type,
            _originalId: location.id
        };
    }

    async initializeDefaultFacilities() {
        console.log('📝 Initializing default MyRepData-compatible facilities...');
        
        const defaults = [
            {
                name: 'Advanced Spine Center',
                type: 'ASC',
                specialty: 'Ortho Spine',
                address: '123 Medical Drive',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53201',
                phone: '+1-555-0456',
                territory: 'Wisconsin East',
                priority: 1,
                contact: {
                    primary: 'Sarah Johnson, OR Manager',
                    email: 'sarah.johnson@advancedspine.com'
                },
                latitude: 43.0389,
                longitude: -87.9065,
                notes: 'Premier outpatient spine surgery center'
            },
            {
                name: 'Aurora Medical Center - Grafton',
                type: 'Hospital',
                specialty: 'Ortho',
                address: '975 Port Washington Rd',
                city: 'Grafton',
                state: 'WI',
                zip: '53024',
                phone: '+1-262-329-1000',
                territory: 'Wisconsin East',
                priority: 1,
                contact: {
                    primary: 'Jennifer Martinez, Surgical Coordinator',
                    email: 'jennifer.martinez@aurora.org'
                },
                latitude: 43.3239,
                longitude: -87.9511,
                notes: 'Full-service hospital with advanced spine services'
            },
            {
                name: 'Froedtert Hospital',
                type: 'Hospital',
                specialty: 'Ortho Spine',
                address: '9200 W Wisconsin Ave',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53226',
                phone: '+1-414-805-3000',
                territory: 'Wisconsin East',
                priority: 2,
                contact: {
                    primary: 'Dr. Michael Chen, Chief of Surgery',
                    email: 'michael.chen@froedtert.com'
                },
                latitude: 43.0509,
                longitude: -88.0034,
                notes: 'Level 1 trauma center with comprehensive spine program'
            },
            {
                name: 'Pain Management Associates',
                type: 'OBL',
                specialty: 'Pain Management',
                address: '456 Wellness Blvd',
                city: 'Madison',
                state: 'WI',
                zip: '53719',
                phone: '+1-608-555-0123',
                territory: 'Wisconsin West',
                priority: 3,
                contact: {
                    primary: 'Dr. Lisa Thompson, Medical Director',
                    email: 'lisa.thompson@painmgmt.com'
                },
                latitude: 43.0731,
                longitude: -89.4012,
                notes: 'Specialized pain management and interventional procedures'
            }
        ];

        for (const defaultFacility of defaults) {
            const facilityWithMeta = {
                ...defaultFacility,
                active: true,
                createdAt: serverTimestamp(),
                createdBy: 'system',
                modifiedBy: 'system',
                lastModified: serverTimestamp(),
                _initialized: true
            };
            
            await addDoc(collection(this.db, 'facilities'), facilityWithMeta);
            console.log(`✅ Initialized: ${defaultFacility.name} (${defaultFacility.account_record_type})`);
        }

        console.log('🎉 Default facilities initialized successfully!');
        return { success: true, initialized: defaults.length };
    }
}

// Export for use in console
window.facilityMigration = null;

// Auto-initialize when database is available
if (window.app && window.app.db) {
    window.facilityMigration = new FacilityMigration(window.app.db);
    console.log('📋 Facility migration tool available at: window.facilityMigration');
    console.log('🚀 Run migration with: window.facilityMigration.migrateLocationsToFacilities()');
}