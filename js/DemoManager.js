// js/DemoManager.js
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, getDocs, collection, query, limit, addDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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

            // Check if locations exist
            const locationsExist = await this.checkLocationsExist();

            // NEW: Check if surgeons exist
            const surgeonsExist = await this.checkSurgeonsExist();

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
            if (!locationsExist) {
                console.log('No Location data found, initializing...');
                // Create demo locations
                await this.createDemoLocations();
            }
            // NEW: Initialize surgeons if they don't exist
            if (!surgeonsExist) {
                console.log('No Surgeon data found, initializing...');
                await this.createDemoSurgeons();
            }

            if (!caseTypesExist) {
                console.log('No Case Types data found, initializing...');
                await this.createDemoCaseTypes();
            }

            if (!usersExist || !traysExist || !locationsExist || !surgeonsExist || !caseTypesExist) {
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
            const traysQuery = query(collection(this.db, 'trays'), limit(1));
            const traysSnapshot = await getDocs(traysQuery);
            return !traysSnapshot.empty;
        } catch (error) {
            console.error('Error checking trays:', error);
            return false;
        }
    }

    async checkLocationsExist() {
        try {
            const locationsQuery = query(collection(this.db, 'locations'), limit(1));
            const locationsSnapshot = await getDocs(locationsQuery);
            return !locationsSnapshot.empty;
        } catch (error) {
            console.error('Error checking locations:', error);
            return false;
        }
    }

    // NEW: Check if surgeons exist
    async checkSurgeonsExist() {
        try {
            const surgeonsQuery = query(collection(this.db, 'surgeons'), limit(1));
            const surgeonsSnapshot = await getDocs(surgeonsQuery);
            return !surgeonsSnapshot.empty;
        } catch (error) {
            console.error('Error checking surgeons:', error);
            return false;
        }
    }

    async initializeDemoDataSilently() {
        try {
            // Create demo users first
            await this.createDemoUsers();

            // Wait a moment for users to be created
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Create demo locations
            await this.createDemoLocations();

            await this.createDemoCaseTypes();

            // NEW: Create demo surgeons
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
        // Wait for surgeons to be created and available
        let attempts = 0;
        while ((!window.app.surgeonManager?.currentSurgeons || window.app.surgeonManager.currentSurgeons.length === 0) && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        // Get available surgeon IDs for demo trays
        const availableSurgeons = window.app.surgeonManager?.currentSurgeons || [];

        const demoTrays = [
            {
                name: 'Fusion Set Alpha',
                type: 'fusion',
                status: 'available',
                location: 'trunk',
                facility: '',
                caseDate: '',
                surgeonId: '', // No surgeon assigned yet
                notes: 'Demo tray - Fusion instrumentation set',
                isDemoTray: true
            },
            {
                name: 'Revision Kit Beta',
                type: 'revision',
                status: 'in-use',
                location: 'facility',
                facility: 'Froedtert Hospital',
                caseDate: this.getDateString(1), // Tomorrow
                surgeonId: availableSurgeons.find(s => s.name === 'Dr. Max Ots')?.id || '', // Assign Dr. Max Ots if available
                notes: 'Demo tray - Scheduled for revision surgery',
                isDemoTray: true
            },
            {
                name: 'MI System Gamma',
                type: 'mi',
                status: 'available',
                location: 'corporate',
                facility: '',
                caseDate: '',
                surgeonId: '', // No surgeon assigned yet
                notes: 'Demo tray - Minimally invasive tools',
                isDemoTray: true
            },
            {
                name: 'Complete Set Delta',
                type: 'complete',
                status: 'in-use',
                location: 'facility',
                facility: 'Aurora Medical Center - Summit',
                caseDate: this.getDateString(-1), // Yesterday
                surgeonId: availableSurgeons.find(s => s.name === 'Dr. Branko Prpa')?.id || '', // Assign Dr. Branko Prpa if available
                notes: 'Demo tray - Complete surgical system',
                isDemoTray: true
            },
            {
                name: 'Fusion Pro Kit',
                type: 'fusion',
                status: 'available',
                location: 'trunk',
                facility: '',
                caseDate: '',
                surgeonId: '', // No surgeon assigned yet
                notes: 'Demo tray - Professional fusion set',
                isDemoTray: true
            },
            {
                name: 'Emergency Revision Set',
                type: 'revision',
                status: 'in-use',
                location: 'facility',
                facility: 'Aurora Medical Center - Grafton',
                caseDate: this.getDateString(2), // Day after tomorrow
                surgeonId: availableSurgeons.find(s => s.name === 'Dr. Syed Mehdi')?.id || '', // Assign Dr. Syed Mehdi if available
                notes: 'Demo tray - Emergency backup set',
                isDemoTray: true
            }
        ];

        // Get current user or use first demo user ID
        const currentUserId = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

        for (const tray of demoTrays) {
            try {
                tray.assignedTo = currentUserId;
                const savedTray = await this.dataManager.saveTray(tray);

                // Add initial history entry with surgeon name if assigned
                let historyDetails = `Demo tray initialized at ${tray.location}`;
                if (tray.surgeonId) {
                    const surgeon = availableSurgeons.find(s => s.id === tray.surgeonId);
                    if (surgeon) {
                        historyDetails += ` with surgeon ${surgeon.name}`;
                    }
                }

                await this.dataManager.addHistoryEntry(
                    savedTray.id,
                    'created',
                    historyDetails,
                    null
                );

                console.log(`Created demo tray: ${tray.name}${tray.surgeonId ? ' with surgeon assigned' : ''}`);
            } catch (error) {
                console.error(`Error creating demo tray ${tray.name}:`, error);
                // Continue with other trays even if one fails
            }
        }
    }

    async createDemoLocations() {
        const demoLocations = [
            {
                name: 'Aurora Medical Center - Grafton',
                type: 'medical_facility',
                address: '975 Port Washington Rd',
                city: 'Grafton',
                state: 'WI',
                zip: '53024',
                phone: '+1-262-329-1000',
                contact: 'Sarah Johnson, OR Manager',
                region: 'Wisconsin East',
                latitude: 43.3239,
                longitude: -87.9511,
                notes: 'Primary facility for orthopedic procedures',
                active: true,
                isDemoLocation: true
            },
            {
                name: 'Froedtert Hospital',
                type: 'medical_facility',
                address: '9200 W Wisconsin Ave',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53226',
                phone: '+1-414-805-3000',
                contact: 'Dr. Michael Chen, Chief of Surgery',
                region: 'Wisconsin East',
                latitude: 43.0509,
                longitude: -88.0034,
                notes: 'Level 1 trauma center with advanced spine services',
                active: true,
                isDemoLocation: true
            },
            {
                name: 'Aurora Medical Center - Summit',
                type: 'medical_facility',
                address: '36500 Aurora Dr',
                city: 'Summit',
                state: 'WI',
                zip: '53066',
                phone: '+1-262-434-1000',
                contact: 'Jennifer Martinez, Surgical Coordinator',
                region: 'Wisconsin East',
                latitude: 43.0166,
                longitude: -88.0711,
                notes: 'Specialized in minimally invasive procedures',
                active: true,
                isDemoLocation: true
            },
            {
                name: 'SI-BONE Corporate HQ',
                type: 'corporate',
                address: '471 El Camino Real',
                city: 'Santa Clara',
                state: 'CA',
                zip: '95050',
                phone: '+1-408-207-0700',
                contact: 'Operations Team',
                region: 'Corporate',
                latitude: 37.4419,
                longitude: -122.1430,
                notes: 'Corporate headquarters and main distribution center',
                active: true,
                isDemoLocation: true
            },
            {
                name: 'Wisconsin Distribution Center',
                type: 'warehouse',
                address: '1234 Industrial Blvd',
                city: 'Milwaukee',
                state: 'WI',
                zip: '53218',
                phone: '+1-414-555-0199',
                contact: 'Tom Wilson, Warehouse Manager',
                region: 'Wisconsin East',
                latitude: 43.0642,
                longitude: -87.9073,
                notes: 'Regional distribution and inventory management',
                active: true,
                isDemoLocation: true
            },
            {
                name: "Eric's Regional Office",
                type: 'rep_office',
                address: '789 Business Park Dr, Suite 200',
                city: 'Madison',
                state: 'WI',
                zip: '53719',
                phone: '+1-608-555-0150',
                contact: 'Eric Swick',
                region: 'Wisconsin East',
                latitude: 43.0731,
                longitude: -89.4012,
                notes: 'Territory manager office and storage facility',
                active: true,
                isDemoLocation: true
            }
        ];

        for (const location of demoLocations) {
            try {
                location.createdAt = serverTimestamp();
                location.createdBy = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

                await addDoc(collection(this.db, 'locations'), location);
                console.log(`Created demo location: ${location.name}`);
            } catch (error) {
                console.error(`Error creating demo location ${location.name}:`, error);
                // Continue with other locations even if one fails
            }
        }
    }

    // NEW: Create demo surgeons
    async createDemoSurgeons() {

        let attempts = 0;
        while ((!window.app.caseTypeManager?.currentCaseTypes || window.app.caseTypeManager.currentCaseTypes.length === 0) && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        const availableCaseTypes = window.app.caseTypeManager?.currentCaseTypes || [];


        const demoSurgeons = [
            {
                name: 'Dr. Max Ots',
                specialty: 'Orthopedic Spine Surgery',
                hospital: 'Froedtert Hospital',
                phone: '+1-414-805-3100',
                email: 'max.ots@froedtert.com',
                region: 'Wisconsin East',
                yearsExperience: 15,
                notes: 'Specialized in complex spinal deformity and SI joint fusion',
                preferredCases: this.getCaseTypeIds(['SI Joint Fusion', 'TLIF', 'Posterior Fusion'], availableCaseTypes).join(','),
                active: true,
                isDemoSurgeon: true
            },
            {
                name: 'Dr. Branko Prpa',
                specialty: 'Neurosurgery',
                hospital: 'Aurora Medical Center - Summit',
                phone: '+1-262-434-1050',
                email: 'branko.prpa@aurora.org',
                region: 'Wisconsin East',
                yearsExperience: 12,
                notes: 'Focus on minimally invasive spine surgery and SI joint procedures',
                preferredCases: this.getCaseTypeIds(['Minimally Invasive', 'SI Joint Fusion', 'Lateral Fusion'], availableCaseTypes).join(','),
                active: true,
                isDemoSurgeon: true
            },
            {
                name: 'Dr. Syed Mehdi',
                specialty: 'Orthopedic Surgery',
                hospital: 'Aurora Medical Center - Grafton',
                phone: '+1-262-329-1050',
                email: 'syed.mehdi@aurora.org',
                region: 'Wisconsin East',
                yearsExperience: 18,
                notes: 'Extensive experience with SI joint pathology and fusion techniques',
                preferredCases: this.getCaseTypeIds(['Minimally Invasive', 'SI Joint Fusion', 'Lateral Fusion'], availableCaseTypes).join(','),
                active: true,
                isDemoSurgeon: true
            },
            {
                name: 'Dr. Jennifer Smith',
                specialty: 'Orthopedic Spine Surgery',
                hospital: 'Children\'s Hospital of Wisconsin',
                phone: '+1-414-266-2000',
                email: 'jennifer.smith@chw.org',
                region: 'Wisconsin East',
                yearsExperience: 8,
                notes: 'Pediatric and adult spine surgery, SI joint specialist',
                preferredCases: this.getCaseTypeIds(['Minimally Invasive', 'SI Joint Fusion', 'Lateral Fusion'], availableCaseTypes).join(','),
                active: true,
                isDemoSurgeon: true
            },
            {
                name: 'Dr. Michael Johnson',
                specialty: 'Pain Management',
                hospital: 'Medical College of Wisconsin',
                phone: '+1-414-955-8000',
                email: 'michael.johnson@mcw.edu',
                region: 'Wisconsin East',
                yearsExperience: 20,
                notes: 'SI joint injections and minimally invasive fusion procedures',
                preferredCases: this.getCaseTypeIds(['Minimally Invasive', 'SI Joint Fusion', 'Lateral Fusion'], availableCaseTypes).join(','),
                active: true,
                isDemoSurgeon: true
            },
            {
                name: 'Dr. Sarah Williams',
                specialty: 'Orthopedic Surgery',
                hospital: 'ProHealth Waukesha Memorial Hospital',
                phone: '+1-262-928-1000',
                email: 'sarah.williams@prohealth.com',
                region: 'Wisconsin West',
                yearsExperience: 10,
                notes: 'SI joint dysfunction and fusion, sports medicine',
                preferredCases: this.getCaseTypeIds(['Minimally Invasive', 'SI Joint Fusion', 'Lateral Fusion'], availableCaseTypes).join(','),
                active: true,
                isDemoSurgeon: true
            }
        ];

        for (const surgeon of demoSurgeons) {
            try {
                surgeon.createdAt = serverTimestamp();
                surgeon.createdBy = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

                await addDoc(collection(this.db, 'surgeons'), surgeon);
                console.log(`Created demo surgeon: ${surgeon.name}`);
            } catch (error) {
                console.error(`Error creating demo surgeon ${surgeon.name}:`, error);
                // Continue with other surgeons even if one fails
            }
        }
    }

    async createDemoCaseTypes() {
        const demoCaseTypes = [
            {
                name: 'SI Joint Fusion',
                description: 'Sacroiliac joint fusion procedures using minimally invasive techniques',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Lateral Fusion',
                description: 'Lateral lumbar interbody fusion procedures',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'TLIF',
                description: 'Transforaminal lumbar interbody fusion',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'ALIF',
                description: 'Anterior lumbar interbody fusion',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Posterior Fusion',
                description: 'Posterior spinal fusion procedures',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Revision Surgery',
                description: 'Revision procedures for failed prior surgeries',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Minimally Invasive',
                description: 'General minimally invasive spinal procedures',
                active: true,
                isDemoCaseType: true
            },
            {
                name: 'Pain Management',
                description: 'Pain management and injection procedures',
                active: true,
                isDemoCaseType: true
            }
        ];

        for (const caseType of demoCaseTypes) {
            try {
                caseType.createdAt = serverTimestamp();
                caseType.createdBy = window.app?.authManager?.getCurrentUser()?.uid || 'demo-user';

                await addDoc(collection(this.db, 'casetypes'), caseType);
                console.log(`Created demo case type: ${caseType.name}`);
            } catch (error) {
                console.error(`Error creating demo case type ${caseType.name}:`, error);
            }
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
        if (!confirm('This will delete all demo data. This action cannot be undone. Continue?')) {
            return;
        }

        try {
            // Delete demo trays
            const trays = await this.dataManager.getAllTrays();
            for (const tray of trays) {
                if (tray.isDemoTray) {
                    await this.dataManager.deleteTray(tray.id);
                }
            }

            alert('Demo data cleared successfully!');
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