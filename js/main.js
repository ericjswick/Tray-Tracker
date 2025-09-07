// js/main.js - Updated for Tray Tracker
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
import { SurgeonManager } from './SurgeonManager.js';
import { CaseTypeManager } from './CaseTypeManager.js';
import { CasesManager } from './CasesManager.js';
import { FrontendLogger } from './utils/FrontendLogger.js';
import { DuplicateRemover } from './utils/DuplicateRemover.js';


// Initialize Firebase
let firebaseApp, db, auth, storage;

try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    storage = getStorage(firebaseApp);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization failed:', error);
    alert('Firebase configuration error. Please check your configuration in js/config.js');
}

// Main Application Class
class SIBoneApp {
    constructor() {
        // Initialize frontend logger first
        this.logger = new FrontendLogger();
        window.frontendLogger = this.logger;
        
        // Log app initialization
        this.logger.info('Tray Tracker frontend starting', {
            userAgent: navigator.userAgent,
            url: window.location.href
        }, 'app-init');
        
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
        this.surgeonManager = new SurgeonManager(db);
        this.caseTypeManager = new CaseTypeManager(db);
        this.casesManager = new CasesManager(this.dataManager);
        this.duplicateRemover = new DuplicateRemover(db);
    }

    init() {
        console.log('Tray Tracker initialized with Firebase');
        this.setupErrorHandling();
        this.setupGlobalStyles();

        // Initialize view mode when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeUI();
            });
        } else {
            this.initializeUI();
        }
    }

    setupGlobalStyles() {
        // Add custom CSS for improved components
        const customStyles = document.createElement('style');
        customStyles.textContent = `
            /* Additional styles for enhanced components */
            .tray-info-card {
                background: var(--gray-50);
                border-radius: 0.5rem;
                padding: 1rem;
                border: 1px solid var(--gray-200);
            }

            .tray-info-header {
                display: flex;
                justify-content: between;
                align-items: center;
                margin-bottom: 1rem;
            }

            .tray-info-header h6 {
                margin: 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--gray-800);
            }

            .tray-info-details {
                display: grid;
                gap: 0.5rem;
            }

            .info-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.875rem;
                color: var(--gray-600);
            }

            .info-item i {
                color: var(--gray-400);
                width: 16px;
            }

            .history-entry {
                display: flex;
                gap: 1rem;
                margin-bottom: 1.5rem;
                position: relative;
            }

            .history-timeline {
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
            }

            .history-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 0.875rem;
                flex-shrink: 0;
                z-index: 2;
            }

            .action-created { background: var(--success-green); }
            .action-checkin { background: var(--primary-blue); }
            .action-pickup { background: var(--warning-orange); }
            .action-reassign { background: var(--secondary-blue); }
            .action-turnover { background: #8B5CF6; }
            .action-update { background: var(--gray-500); }
            .action-default { background: var(--gray-400); }

            .history-line {
                width: 2px;
                height: 100%;
                background: var(--gray-200);
                position: absolute;
                top: 40px;
                left: 50%;
                transform: translateX(-50%);
            }

            .history-entry:last-child .history-line {
                display: none;
            }

            .history-content {
                flex: 1;
                min-width: 0;
            }

            .history-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 0.5rem;
                flex-wrap: wrap;
                gap: 0.5rem;
            }

            .history-action {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                color: var(--gray-800);
            }

            .history-time {
                font-size: 0.75rem;
                color: var(--gray-500);
                white-space: nowrap;
            }

            .history-details {
                color: var(--gray-600);
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
                line-height: 1.4;
            }

            .history-meta {
                margin-bottom: 0.75rem;
            }

            .history-photo img {
                max-width: 120px;
                max-height: 120px;
                object-fit: cover;
                border-radius: 0.375rem;
                border: 1px solid var(--gray-200);
                cursor: pointer;
                transition: all 0.2s;
            }

            .history-photo img:hover {
                transform: scale(1.05);
                box-shadow: var(--shadow-lg);
            }

            .history-photo img.expanded {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(1);
                max-width: 90vw;
                max-height: 90vh;
                z-index: 10000;
                box-shadow: var(--shadow-xl);
                border-radius: 0.5rem;
            }

            .empty-state {
                text-align: center;
                padding: 3rem 1rem;
                color: var(--gray-500);
            }

            .location-card,
            .user-card {
                background: white;
                border-radius: 0.75rem;
                padding: 1.5rem;
                box-shadow: var(--shadow);
                border: 1px solid var(--gray-200);
                transition: all 0.2s;
                height: 100%;
                display: flex;
                flex-direction: column;
            }

            .location-card:hover,
            .user-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }

            .location-card-header,
            .user-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 1rem;
            }

            .location-card-title,
            .user-name {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--gray-800);
                margin: 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .location-type-icon,
            .user-avatar {
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, var(--primary-blue), var(--secondary-blue));
                border-radius: 0.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 0.875rem;
            }

            .user-avatar {
                border-radius: 50%;
                width: 40px;
                height: 40px;
            }

            .location-card-content,
            .user-details {
                flex: 1;
                margin-bottom: 1.5rem;
            }

            .location-detail,
            .user-detail {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
            }

            .location-detail i,
            .user-detail i {
                color: var(--gray-400);
                width: 16px;
            }

            .location-detail-value,
            .location-detail-empty {
                color: var(--gray-700);
            }

            .location-detail-empty {
                color: var(--gray-400);
                font-style: italic;
            }

            .location-card-actions,
            .user-actions {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
            }

            .user-info {
                flex: 1;
            }

            .user-role {
                display: inline-block;
                padding: 0.25rem 0.75rem;
                background: var(--light-blue);
                color: var(--primary-blue);
                border-radius: 1rem;
                font-size: 0.75rem;
                font-weight: 600;
                margin-top: 0.5rem;
            }

            .user-status {
                margin-top: 0.5rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
                font-size: 0.75rem;
                font-weight: 500;
            }

            .user-status i {
                font-size: 0.5rem;
            }

            /* Role-specific colors */
            .role-admin { background: #FEF2F2; color: var(--danger-red); }
            .role-manager { background: #FFFBEB; color: var(--warning-orange); }
            .role-rep { background: #ECFDF5; color: var(--success-green); }
            .role-specialist { background: #EFF6FF; color: var(--primary-blue); }

            /* Tray Requirements Builder */
            .tray-requirements-builder .tray-requirement-item {
                background: #f8f9fa;
                transition: all 0.2s ease;
            }

            .tray-requirements-builder .tray-requirement-item:hover {
                background: #e9ecef;
            }

            .tray-requirements-builder .form-label.small {
                font-weight: 600;
                color: #495057;
                margin-bottom: 0.25rem;
            }

            .tray-requirements-builder .form-select-sm,
            .tray-requirements-builder .form-control-sm {
                font-size: 0.875rem;
            }

            .tray-requirements-builder .btn-outline-danger:hover {
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(customStyles);
    }

    initializeUI() {
        // Initialize DataManager first - this sets up Firebase listeners
        if (this.dataManager) {
            console.log('Initializing DataManager and Firebase listeners...');
            this.dataManager.initializeData();
        }

        // Initialize managers in the correct order
        if (this.trayManager) {
            this.trayManager.initializeViewMode();
        }

        if (this.locationManager) {
            this.locationManager.initializeViewMode();
        }

        if (this.surgeonManager) {
            this.surgeonManager.initializeViewMode();
        }

        if (this.caseTypeManager) {
            this.caseTypeManager.initializeViewMode();
        }

        // Initialize UserManager last to ensure DataManager is ready
        if (this.userManager) {
            // Small delay to ensure DataManager listeners are set up
            setTimeout(() => {
                this.userManager.initializeViewMode();
            }, 200);
        }

        // Initialize URL routing FIRST (before other managers that might navigate)
        if (this.viewManager) {
            this.viewManager.initializeRouting().then(() => {
                console.log('✅ Routing initialized - ready for authentication flows');
            });
        }

        // Setup global click handlers for photo expansion
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('expanded')) {
                e.target.classList.remove('expanded');
            }
        });

        // Setup keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close expanded photos
                document.querySelectorAll('.expanded').forEach(img => {
                    img.classList.remove('expanded');
                });
            }
        });
    }

    setupErrorHandling() {
        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showErrorNotification('An unexpected error occurred. Please refresh the page and try again.');
            event.preventDefault();
        });

        // Global error handler for JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            this.showErrorNotification('An error occurred. Please refresh the page if the problem persists.');
        });
    }

    showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-error';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            background: var(--danger-red);
            box-shadow: var(--shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; margin-left: auto; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 6000);
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
        if (this.surgeonManager) {
            this.surgeonManager.cleanup();
        }
        if (this.caseTypeManager) {
            this.caseTypeManager.cleanup();
        }
    }
}

// Initialize the application
window.app = new SIBoneApp();
app.init();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    app.cleanup();
    if (window.frontendLogger) {
        window.frontendLogger.cleanup();
    }
});

// Export for debugging purposes
export { SIBoneApp };