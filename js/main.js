// js/main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js";

// Import configuration
import { firebaseConfig } from './config.js';

// Import all manager classes
import { AuthManager } from './AuthManager.js';
import { DataManager } from './DataManager.js';
import { TrayManager } from './TrayManager.js';
import { ModalManager } from './ModalManager.js';
import { PhotoManager } from './PhotoManager.js';
import { MapManager } from './MapManager.js';
import { ViewManager } from './ViewManager.js';
import { NotificationManager } from './NotificationManager.js';
import { DemoManager } from './DemoManager.js';
import { UserManager } from './UserManager.js';
import { LocationManager } from './LocationManager.js';

// Initialize Firebase
let firebaseApp, db, auth, storage;

try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    storage = getStorage(firebaseApp);
    console.log('Firebase initialized successfully');
    document.getElementById('firebaseSetup').style.display = 'none';
} catch (error) {
    console.error('Firebase initialization failed:', error);
    alert('Firebase configuration error. Please check your configuration in js/config.js');
}

// Main Application Class
class SIBoneApp {
    constructor() {
        // Initialize all managers with their dependencies
        this.authManager = new AuthManager(auth, db);
        this.dataManager = new DataManager(db);
        this.trayManager = new TrayManager(this.dataManager);
        this.modalManager = new ModalManager(this.dataManager);
        this.photoManager = new PhotoManager(storage);
        this.mapManager = new MapManager();
        this.viewManager = new ViewManager();
        this.notificationManager = new NotificationManager(db);
        this.demoManager = new DemoManager(auth, this.dataManager, db);
        this.userManager = new UserManager(auth, db, this.dataManager);
        this.locationManager = new LocationManager(db);
    }

    init() {
        console.log('SI-BONE Surgical Tray Tracker initialized with Firebase');
        this.setupErrorHandling();

        // Initialize view mode when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeUI();
            });
        } else {
            this.initializeUI();
        }
    }

    initializeUI() {
        // Initialize tray view mode
        if (this.trayManager) {
            this.trayManager.initializeViewMode();
        }

        // Initialize user manager view mode
        if (this.userManager) {
            this.userManager.initializeViewMode();
        }

        // Initialize location manager view mode
        if (this.locationManager) {
            this.locationManager.initializeViewMode();
        }
    }

    setupErrorHandling() {
        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            // Prevent the default browser behavior
            event.preventDefault();
        });

        // Global error handler for JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
        });
    }

    cleanup() {
        // Cleanup listeners when app is destroyed
        if (this.dataManager) {
            this.dataManager.cleanup();
        }
        if (this.authManager) {
            this.authManager.cleanup();
        }
        if (this.photoManager) {
            this.photoManager.stopCamera();
        }
        if (this.locationManager) {
            this.locationManager.cleanup();
        }
    }
}

// Initialize the application
window.app = new SIBoneApp();
app.init();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    app.cleanup();
});

// Export for debugging purposes
export { SIBoneApp };