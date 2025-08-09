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

            // If no users, trays, or locations exist, initialize demo data
            if (!usersExist || !traysExist || !locationsExist) {
                console.log('No demo data found, initializing...');
                await this.initializeDemoDataSilently();
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

    async initializeDemoDataSilently() {
        try {
            // Create demo users first
            await this.createDemoUsers();

            // Wait a moment for users to be created
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Create demo locations
            await this.createDemoLocations();

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
        const demoTrays = [
            {
                name: 'Fusion Set Alpha',
                type: 'fusion',
                status: 'available',
                location: 'trunk',
                facility: '',
                caseDate: '',
                surgeon: '',
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
                surgeon: 'Dr. Max Ots',
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
                surgeon: '',
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
                surgeon: 'Dr. Branko Prpa',
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
                surgeon: '',
                notes: 'Demo tray - Professional fusion set',
                isDemoTray: true
            },
            {
                name: 'Emergency Revision Set',
                type: 'revision',
                status: 'available',
                location: 'corporate',
                facility: '',
                caseDate: '',
                surgeon: '',
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

                // Add initial history entry
                await this.dataManager.addHistoryEntry(
                    savedTray.id,
                    'created',
                    `Demo tray initialized at ${tray.location}`,
                    null
                );

                console.log(`Created demo tray: ${tray.name}`);
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

    async initializeDemoData() {
        if (!confirm('This will create demo trays and user accounts. Continue?')) {
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
}