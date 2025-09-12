// js/DemoManager.js
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, getDocs, collection, query, limit, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { TRAY_STATUS } from './constants/TrayStatus.js';

export class DemoManager {
    constructor(auth, dataManager, db) {
        this.auth = auth;
        this.dataManager = dataManager;
        this.db = db;
    }

    async checkAndInitializeData() {
        try {
            // Check if users exist
            const usersExist = await this.checkUsersExist();

            // Check if trays exist
            const traysExist = await this.checkTraysExist();

            // Check if facilities exist
            const facilitiesExist = await this.checkLocationsExist();

            // Check if physicians exist
            const physiciansExist = await this.checkSurgeonsExist();

            const caseTypesExist = await this.checkCaseTypesExist();

            // If no data exists, initialize demo data
            if (!usersExist) {
                console.log('No User data found, initializing...');
                await this.createDemoUsers();
                // Wait a moment for users to be created
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            if (!traysExist) {
                console.log('No Tray data found, initializing...');
                // Then create demo trays
                await this.createDemoTrays();
            }
            if (!facilitiesExist) {
                console.log('No Facility data found, initializing...');
                // Create demo facilities
                await this.createDemoLocations();
            }
            // Initialize physicians if they don't exist
            if (!physiciansExist) {
                console.log('No Physician data found, initializing...');
                await this.createDemoSurgeons();
            }

            if (!caseTypesExist) {
                console.log('No Case Types data found, initializing...');
                await this.createDemoCaseTypes();
            }

            if (!usersExist || !traysExist || !facilitiesExist || !physiciansExist || !caseTypesExist) {
                return true;
            }

            console.log('Demo data already exists');
            return false;
        } catch (error) {
            console.error('Error checking/initializing demo data:', error);
            return false;
        }
    }

    getDateString(daysFromToday) {
        const date = new Date();
        date.setDate(date.getDate() + daysFromToday);
        return date.toISOString().split('T')[0];
    }

    async checkUsersExist() {
        try {
            const usersQuery = query(collection(this.db, 'users'), limit(1));
            const usersSnapshot = await getDocs(usersQuery);
            return !usersSnapshot.empty;
        } catch (error) {
            console.error('Error checking users:', error);
            return false;
        }
    }

    async checkCaseTypesExist() {
        try {
            const caseTypesQuery = query(collection(this.db, 'casetypes'), limit(1));
            const caseTypesSnapshot = await getDocs(caseTypesQuery);
            return !caseTypesSnapshot.empty;
        } catch (error) {
            console.error('Error checking case types:', error);
            return false;
        }
    }

    async checkTraysExist() {
        try {
            const traysQuery = query(collection(this.db, 'tray_tracking'), limit(1));
            const traysSnapshot = await getDocs(traysQuery);
            return !traysSnapshot.empty;
        } catch (error) {
            console.error('Error checking trays:', error);
            return false;
        }
    }

    async checkLocationsExist() {
        try {
            const facilitiesQuery = query(collection(this.db, 'facilities'), limit(1));
            const facilitiesSnapshot = await getDocs(facilitiesQuery);
            return !facilitiesSnapshot.empty;
        } catch (error) {
            console.error('Error checking facilities:', error);
            return false;
        }
    }

    // Check if physicians exist
    async checkSurgeonsExist() {
        try {
            const physiciansQuery = query(collection(this.db, 'physicians'), limit(1));
            const physiciansSnapshot = await getDocs(physiciansQuery);
            return !physiciansSnapshot.empty;
        } catch (error) {
            console.error('Error checking physicians:', error);
            return false;
        }
    }

    // Helper method to get existing facility names
    async getExistingFacilityNames() {
        try {
            const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
            const existingNames = new Set();
            facilitiesSnapshot.forEach((doc) => {
                const name = doc.data().name;
                if (name) {
                    existingNames.add(name.toLowerCase().trim());
                }
            });
            return existingNames;
        } catch (error) {
            console.error('Error getting existing facility names:', error);
            return new Set();
        }
    }

    // Helper method to get existing physician names and emails
    async getExistingSurgeonIdentifiers() {
        try {
            const physiciansSnapshot = await getDocs(collection(this.db, 'physicians'));
            const existingNames = new Set();
            const existingEmails = new Set();
            
            physiciansSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.full_name) {
                    existingNames.add(data.full_name.toLowerCase().trim());
                }
                if (data.name) {
                    existingNames.add(data.name.toLowerCase().trim());
                }
                if (data.email) {
                    existingEmails.add(data.email.toLowerCase().trim());
                }
            });
            
            return { names: existingNames, emails: existingEmails };
        } catch (error) {
            console.error('Error getting existing physician identifiers:', error);
            return { names: new Set(), emails: new Set() };
        }
    }

    async initializeDemoDataSilently() {
        try {
            // Create demo users first
            await this.createDemoUsers();

            // Wait a moment for users to be created
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Create demo facilities
            await this.createDemoLocations();

            await this.createDemoCaseTypes();

            // Create demo physicians
            await this.createDemoSurgeons();

            // Then create demo trays
            await this.createDemoTrays();

            console.log('Demo data initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing demo data:', error);
            throw error;
        }
    }

    async createDemoUsers() {
        const demoUsers = [
            {
                id: 'demo-eric',
                email: 'eric@sibone.com',
                name: 'Eric Swick',
                role: 'Territory Manager',
                phone: '+1-555-0101',
                password: 'Demo@123'
            },
            {
                id: 'demo-dino',
                email: 'dino@sibone.com',
                name: 'Dino B',
                role: 'Sales Rep',
                phone: '+1-555-0102',
                password: 'Demo@123'
            },
            {
                id: 'demo-mitch',
                email: 'mitch@sibone.com',
                name: 'Mitch Brees',
                role: 'Clinical Specialist',
                phone: '+1-555-0103',
                password: 'Demo@123'
            }
        ];

        for (const user of demoUsers) {
            try {
                // Try to create user account
                let userCredential;
                try {
                    userCredential = await createUserWithEmailAndPassword(this.auth, user.email, user.password);
                } catch (authError) {
                    // If user already exists, that's fine
                    if (authError.code === 'auth/email-already-in-use') {
                        console.log(`User ${user.email} already exists`);
                        continue;
                    } else {
                        throw authError;
                    }
                }

                // Create user profile in Firestore
                if (userCredential) {
                    await setDoc(doc(this.db, 'users', userCredential.user.uid), {
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        phone: user.phone,
                        createdAt: serverTimestamp(),
                        isDemoUser: true
                    });
                    console.log(`Created demo user: ${user.name}`);
                }

            } catch (error) {
                console.error(`Error creating demo user ${user.email}:`, error);
                // Continue with other users even if one fails
            }
        }
    }

    async createDemoTrays() {
        // Wait for physicians and case types to be created and available
        let attempts = 0;
        while ((!window.app.surgeonManager?.currentSurgeons || window.app.surgeonManager.currentSurgeons.length === 0 ||
                !window.app.caseTypeManager?.currentCaseTypes || window.app.caseTypeManager.currentCaseTypes.length === 0) && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        // Get available physicians and case types for demo trays
        const availablePhysicians = window.app.surgeonManager?.currentSurgeons || [];
        const availableCaseTypes = window.app.caseTypeManager?.currentCaseTypes || [];

        const demoTrays = [
            {
                tray_id: 'TRY-001',
                name: 'SI Fusion Lateral Set Alpha',
                case_type_compatibility: ['SI fusion – lateral', 'SI fusion – Oblique/Postero lateral'],
                status: TRAY_STATUS.AVAILABLE,
                location: 'cleaning',
                facility_id: '',
                notes: 'Demo tray - SI joint fusion lateral approach instrumentation',
                isDemoTray: true
            },
            {
                tray_id: 'TRY-002', 
                name: 'Spine Fusion Long Construct Beta',
                case_type_compatibility: ['Spine fusion – Long Construct', 'Revision Surgery – Spine fusion'],
                status: TRAY_STATUS.IN_USE,
                location: 'sterile_processing',
                facility_id: 'facility-001',
                physician_id: availablePhysicians.find(p => p.full_name === 'Dr. Max Ots')?.id || '',
                notes: 'Demo tray - Multi-level spine fusion instrumentation',
                isDemoTray: true
            },
            {
                tray_id: 'TRY-003',
                name: 'Minimally Invasive Spine Gamma',
                case_type_compatibility: ['Minimally Invasive Spine fusion', 'Spine fusion – Short construct'],
                status: TRAY_STATUS.AVAILABLE,
                location: 'cleaning',
                facility_id: '',
                notes: 'Demo tray - Minimally invasive spine fusion tools',
                isDemoTray: true
            },
            {
                tray_id: 'TRY-004',
                name: 'SI Revision Complete Set Delta',
                case_type_compatibility: ['Revision Surgery – SI fusion', 'SI fusion – Intra–articular'],
                status: TRAY_STATUS.IN_USE,
                location: 'operating_room',
                facility_id: 'facility-002',
                physician_id: availablePhysicians.find(p => p.full_name === 'Dr. Branko Prpa')?.id || '',
                notes: 'Demo tray - SI joint revision surgery complete set',
                isDemoTray: true
            },
            {
                tray_id: 'TRY-005',
                name: 'Sacral Fracture TNT Pro',
                case_type_compatibility: ['Sacral fracture – TNT/TORQ'],
                status: TRAY_STATUS.AVAILABLE,
                location: 'sterile_storage',
                facility_id: '',
                notes: 'Demo tray - TNT/TORQ sacral fracture repair system',
                isDemoTray: true
            },
            {
                tray_id: 'TRY-006',
                name: 'SI Medial-Lateral Emergency Set',
                case_type_compatibility: ['SI fusion – Medial to lateral', 'SI fusion – lateral'],
                status: 'in_transit',
                location: 'in_transit',
                facility_id: 'facility-003',
                physician_id: availablePhysicians.find(p => p.full_name === 'Dr. Syed Mehdi')?.id || '',
                notes: 'Demo tray - Emergency medial-lateral SI fusion set',
                isDemoTray: true
            }
        ];

        // Get current user or use first demo user ID
        const currentUserId = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

        for (const tray of demoTrays) {
            try {
                // Add MyRepData compatible fields
                tray.created_at = serverTimestamp();
                tray.updated_at = serverTimestamp();
                tray.created_by = currentUserId;
                
                // Create tray directly in tray_tracking collection
                const docRef = await addDoc(collection(this.db, 'tray_tracking'), tray);

                // Add initial activity log entry with physician name if assigned
                let activityDescription = `Demo tray initialized at ${tray.location}`;
                if (tray.physician_id) {
                    const physician = availablePhysicians.find(p => p.id === tray.physician_id);
                    if (physician) {
                        activityDescription += ` assigned to ${physician.full_name}`;
                    }
                }

                // Create activity log entry
                await addDoc(collection(this.db, 'activities'), {
                    type: 'tray_created',
                    tray_id: docRef.id,
                    physician_id: tray.physician_id || null,
                    facility_id: tray.facility_id || null,
                    description: activityDescription,
                    created_at: serverTimestamp(),
                    user_id: currentUserId
                });

                console.log(`Created demo tray: ${tray.name}${tray.physician_id ? ' with physician assigned' : ''}`);
            } catch (error) {
                console.error(`Error creating demo tray ${tray.name}:`, error);
                // Continue with other trays even if one fails
            }
        }
    }

    async createDemoLocations() {
        // MyRepData-compatible facilities structure
        const demoFacilities = [
            {
                name: 'Aurora Medical Center - Grafton',
                type: 'hospital',
                specialty: 'orthopedic',
                address: '975 Port Washington Rd',
                city: 'Grafton',
                state: 'WI',
                zip: '53024',
                phone: '+1-262-329-1000',
                territory: 'Wisconsin East',
                notes: 'Primary facility for orthopedic procedures',
                active: true,
                isDemoFacility: true
            },
            {
                name: 'Froedtert Hospital',
                type: 'hospital',
                specialty: 'neurosurgery',
                address: '9200 W Wisconsin Ave',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53226',
                phone: '+1-414-805-3000',
                territory: 'Wisconsin East',
                notes: 'Level 1 trauma center with advanced spine services',
                active: true,
                isDemoFacility: true
            },
            {
                name: 'Aurora Medical Center - Summit',
                type: 'outpatient',
                specialty: 'spine',
                address: '36500 Aurora Dr',
                city: 'Summit',
                state: 'WI',
                zip: '53066',
                phone: '+1-262-434-1000',
                territory: 'Wisconsin East',
                notes: 'Specialized in minimally invasive procedures',
                active: true,
                isDemoFacility: true
            },
            {
                name: 'ProHealth Waukesha Memorial Hospital',
                type: 'hospital',
                specialty: 'orthopedic',
                address: 'W27W24500 National Ave',
                city: 'Waukesha',
                state: 'WI',
                zip: '53188',
                phone: '+1-262-928-1000',
                territory: 'Wisconsin West',
                notes: 'Comprehensive orthopedic and spine services',
                active: true,
                isDemoFacility: true
            },
            {
                name: 'Children\'s Hospital of Wisconsin',
                type: 'specialty',
                specialty: 'pediatric',
                address: '9000 W Wisconsin Ave',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53226',
                phone: '+1-414-266-2000',
                territory: 'Wisconsin East',
                notes: 'Pediatric and adolescent spine surgery center',
                active: true,
                isDemoFacility: true
            },
            {
                name: 'Medical College of Wisconsin',
                type: 'academic',
                specialty: 'research',
                address: '8701 W Watertown Plank Rd',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53226',
                phone: '+1-414-955-8000',
                territory: 'Wisconsin East',
                notes: 'Academic medical center and research facility',
                active: true,
                isDemoFacility: true
            }
        ];

        // Check which facilities already exist
        const existingNames = await this.getExistingFacilityNames();

        for (const facility of demoFacilities) {
            try {
                // Skip if facility already exists
                if (existingNames.has(facility.name.toLowerCase().trim())) {
                    console.log(`Facility already exists, skipping: ${facility.name}`);
                    continue;
                }

                facility.created_at = serverTimestamp();
                facility.updated_at = serverTimestamp();
                facility.created_by = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

                await addDoc(collection(this.db, 'facilities'), facility);
                console.log(`Created demo facility: ${facility.name}`);
            } catch (error) {
                console.error(`Error creating demo facility ${facility.name}:`, error);
                // Continue with other facilities even if one fails
            }
        }
    }

    // Create demo physicians (MyRepData compatible)
    async createDemoSurgeons() {
        // Wait for facilities to be created first
        let attempts = 0;
        while (attempts < 10) {
            try {
                const facilitiesSnapshot = await getDocs(collection(this.db, 'facilities'));
                if (!facilitiesSnapshot.empty) break;
            } catch (error) {
                console.log('Waiting for facilities to be created...');
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        const demoPhysicians = [
            {
                full_name: 'Dr. Max Ots',
                specialty: 'Orthopedic Spine Surgery',
                hospital: 'Froedtert Hospital',
                phone: '+1-414-805-3100',
                email: 'max.ots@froedtert.com',
                territory: 'Wisconsin East',
                years_experience: 15,
                notes: 'Specialized in complex spinal deformity and SI joint fusion',
                active: true,
                isDemoPhysician: true
            },
            {
                full_name: 'Dr. Branko Prpa',
                specialty: 'Neurosurgery',
                hospital: 'Aurora Medical Center - Summit',
                phone: '+1-262-434-1050',
                email: 'branko.prpa@aurora.org',
                territory: 'Wisconsin East',
                years_experience: 12,
                notes: 'Focus on minimally invasive spine surgery and SI joint procedures',
                active: true,
                isDemoPhysician: true
            },
            {
                full_name: 'Dr. Syed Mehdi',
                specialty: 'Orthopedic Surgery',
                hospital: 'Aurora Medical Center - Grafton',
                phone: '+1-262-329-1050',
                email: 'syed.mehdi@aurora.org',
                territory: 'Wisconsin East',
                years_experience: 18,
                notes: 'Extensive experience with SI joint pathology and fusion techniques',
                active: true,
                isDemoPhysician: true
            },
            {
                full_name: 'Dr. Jennifer Smith',
                specialty: 'Orthopedic Spine Surgery',
                hospital: 'Children\'s Hospital of Wisconsin',
                phone: '+1-414-266-2000',
                email: 'jennifer.smith@chw.org',
                territory: 'Wisconsin East',
                years_experience: 8,
                notes: 'Pediatric and adult spine surgery, SI joint specialist',
                active: true,
                isDemoPhysician: true
            },
            {
                full_name: 'Dr. Michael Johnson',
                specialty: 'Pain Management',
                hospital: 'Medical College of Wisconsin',
                phone: '+1-414-955-8000',
                email: 'michael.johnson@mcw.edu',
                territory: 'Wisconsin East',
                years_experience: 20,
                notes: 'SI joint injections and minimally invasive fusion procedures',
                active: true,
                isDemoPhysician: true
            },
            {
                full_name: 'Dr. Sarah Williams',
                specialty: 'Orthopedic Surgery',
                hospital: 'ProHealth Waukesha Memorial Hospital',
                phone: '+1-262-928-1000',
                email: 'sarah.williams@prohealth.com',
                territory: 'Wisconsin West',
                years_experience: 10,
                notes: 'SI joint dysfunction and fusion, sports medicine',
                active: true,
                isDemoPhysician: true
            }
        ];

        // Check which physicians already exist
        const existingIdentifiers = await this.getExistingSurgeonIdentifiers();

        for (const physician of demoPhysicians) {
            try {
                // Skip if physician already exists by name or email
                const nameExists = existingIdentifiers.names.has(physician.full_name.toLowerCase().trim());
                const emailExists = physician.email && existingIdentifiers.emails.has(physician.email.toLowerCase().trim());
                
                if (nameExists || emailExists) {
                    console.log(`Physician already exists, skipping: ${physician.full_name}${physician.email ? ` (${physician.email})` : ''}`);
                    continue;
                }

                physician.created_at = serverTimestamp();
                physician.updated_at = serverTimestamp();
                physician.created_by = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

                await addDoc(collection(this.db, 'physicians'), physician);
                console.log(`Created demo physician: ${physician.full_name}`);
            } catch (error) {
                console.error(`Error creating demo physician ${physician.full_name}:`, error);
                // Continue with other physicians even if one fails
            }
        }
    }

    async createDemoCaseTypes() {
        // MyRepData-compatible case types based on the hardcoded values from MyRepData-internal
        const demoCaseTypes = [
            {
                name: 'SI fusion – lateral',
                description: 'Lateral approach sacroiliac joint fusion procedures',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'SI fusion – Intra–articular',
                description: 'Intra-articular sacroiliac joint fusion procedures',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'SI fusion – Oblique/Postero lateral',
                description: 'Oblique and postero-lateral approach SI joint fusion',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'SI fusion – Medial to lateral',
                description: 'Medial to lateral approach SI joint fusion',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Spine fusion – Long Construct',
                description: 'Multi-level spine fusion requiring extensive instrumentation',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Spine fusion – Short construct',
                description: 'Limited level spine fusion procedures',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Sacral fracture – TNT/TORQ',
                description: 'Sacral fracture repair using TNT/TORQ instrumentation system',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Revision Surgery – Spine fusion',
                description: 'Revision procedures for failed spine fusion surgeries',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Revision Surgery – SI fusion',
                description: 'Revision procedures for failed SI joint fusion surgeries',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Minimally Invasive Spine fusion',
                description: 'Minimally invasive spinal fusion procedures',
                active: true,
                isDemoCaseType: true
            }
        ];

        // First, check for existing case types to prevent duplicates
        console.log('Checking for existing case types...');
        const existingCaseTypesSnapshot = await getDocs(collection(this.db, 'casetypes'));
        const existingCaseTypeNames = new Set();
        
        existingCaseTypesSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.name) {
                existingCaseTypeNames.add(data.name.trim().toLowerCase());
            }
        });

        console.log(`Found ${existingCaseTypeNames.size} existing case types`);
        console.log('Creating demo case types...', demoCaseTypes.length);
        
        let created = 0;
        let skipped = 0;
        
        for (const caseType of demoCaseTypes) {
            try {
                const caseTypeName = caseType.name.trim().toLowerCase();
                
                // Check if case type already exists (case-insensitive)
                if (existingCaseTypeNames.has(caseTypeName)) {
                    console.log(`⏭️  Skipping case type "${caseType.name}" - already exists`);
                    skipped++;
                    continue;
                }

                caseType.created_at = serverTimestamp();
                caseType.updated_at = serverTimestamp();
                caseType.created_by = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

                console.log(`Attempting to create case type: ${caseType.name}`);
                const docRef = await addDoc(collection(this.db, 'casetypes'), caseType);
                console.log(`✅ Created demo case type: ${caseType.name} with ID: ${docRef.id}`);
                
                // Add to existing names set to prevent duplicates within this batch
                existingCaseTypeNames.add(caseTypeName);
                created++;
                
            } catch (error) {
                console.error(`❌ Error creating demo case type ${caseType.name}:`, error);
                console.error('Error details:', error.code, error.message);
            }
        }
        
        console.log(`Finished creating demo case types: ${created} created, ${skipped} skipped`);
        
        // Refresh case types data if any were created
        if (created > 0 && window.app?.caseTypeManager?.loadCaseTypes) {
            setTimeout(() => {
                window.app.caseTypeManager.loadCaseTypes();
            }, 1000);
        }
    }

    async initializeDemoData() {
        if (!confirm('This will create demo trays, users, locations, and surgeons. Continue?')) {
            return;
        }

        try {
            await this.initializeDemoDataSilently();
            alert('Demo data initialized successfully!');
        } catch (error) {
            console.error('Error initializing demo data:', error);
            alert('Error initializing demo data: ' + error.message);
        }
    }

    async clearDemoData() {
        if (!confirm('This will delete all demo data from both old and new collections. This action cannot be undone. Continue?')) {
            return;
        }

        try {
            let deletedCount = 0;
            const collections = [
                // New MyRepData collections
                { name: 'tray_tracking', demoField: 'isDemoTray' },
                { name: 'physicians', demoField: 'isDemoPhysician' },
                { name: 'facilities', demoField: 'isDemoFacility' },
                { name: 'casetypes', demoField: 'isDemoCaseType' },
                { name: 'activities', demoField: 'isDemoActivity' },
                
                // Old legacy collections (in case they still exist)
                { name: 'trays', demoField: 'isDemoTray' },
                { name: 'locations', demoField: 'isDemoLocation' },
                { name: 'surgeons', demoField: 'isDemoSurgeon' },
                { name: 'users', demoField: 'isDemoUser' }
            ];

            for (const collectionInfo of collections) {
                try {
                    console.log(`Checking collection: ${collectionInfo.name}`);
                    const snapshot = await getDocs(collection(this.db, collectionInfo.name));
                    
                    const deletePromises = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data[collectionInfo.demoField]) {
                            deletePromises.push(deleteDoc(doc.ref));
                            deletedCount++;
                        }
                    });

                    // Wait for all deletions in this collection to complete
                    await Promise.all(deletePromises);
                    console.log(`Cleared ${deletePromises.length} demo items from ${collectionInfo.name}`);
                } catch (error) {
                    console.warn(`Collection ${collectionInfo.name} may not exist or error occurred:`, error.message);
                    // Continue with other collections even if one fails
                }
            }

            // Also clear any demo history/activity entries
            try {
                const historySnapshot = await getDocs(collection(this.db, 'history'));
                const historyDeletePromises = [];
                historySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.description && data.description.includes('Demo tray')) {
                        historyDeletePromises.push(deleteDoc(doc.ref));
                        deletedCount++;
                    }
                });
                await Promise.all(historyDeletePromises);
                console.log(`Cleared ${historyDeletePromises.length} demo history entries`);
            } catch (error) {
                console.warn('History collection may not exist:', error.message);
            }

            alert(`Demo data cleared successfully! Deleted ${deletedCount} items across all collections.`);
            
            // Refresh the page to ensure UI reflects the changes
            if (deletedCount > 0) {
                window.location.reload();
            }
        } catch (error) {
            console.error('Error clearing demo data:', error);
            alert('Error clearing demo data: ' + error.message);
        }
    }

    getCaseTypeIds(caseTypeNames, availableCaseTypes) {
        return caseTypeNames
            .map(name => {
                const caseType = availableCaseTypes.find(ct => ct.name === name);
                return caseType ? caseType.id : null;
            })
            .filter(id => id !== null);
    }
}