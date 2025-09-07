// config.js - Dynamic Configuration Loader
// Uses ENVIRONMENT_VARIABLE_FILE environment variable to load specific config

// Get environment variable for config file (defaults to 'default' if not set)
const getConfigFileName = () => {
    // Check various ways environment variables can be set
    // Use typeof to safely check if process exists (Node.js vs Browser)
    const processEnv = (typeof process !== 'undefined' && process.env) ? process.env.ENVIRONMENT_VARIABLE_FILE : undefined;
    
    const envVar = processEnv || 
                   (typeof window !== 'undefined' ? window.ENVIRONMENT_VARIABLE_FILE : undefined) || 
                   (typeof localStorage !== 'undefined' ? localStorage.getItem('ENVIRONMENT_VARIABLE_FILE') : undefined) ||
                   'default';
    
    console.log('Loading configuration:', envVar);
    window.is_enable_api_logging && window.frontendLogger?.info('Config file selection', {
        envVar,
        processEnv,
        windowEnv: typeof window !== 'undefined' ? window.ENVIRONMENT_VARIABLE_FILE : undefined,
        localStorageEnv: typeof localStorage !== 'undefined' ? localStorage.getItem('ENVIRONMENT_VARIABLE_FILE') : undefined
    }, 'config');
    return envVar;
};

// Dynamic import based on environment variable
const configFileName = getConfigFileName();
let firebaseConfig, environmentConfig;

try {
    // Try to import the specified config file
    const configModule = await import(`../config/${configFileName}.config.js`);
    firebaseConfig = configModule.firebaseConfig;
    environmentConfig = configModule.environmentConfig;
    
    console.log(`✅ Successfully loaded config: ${environmentConfig?.name || configFileName}`);
    window.is_enable_api_logging && window.frontendLogger?.info('Config loaded successfully', {
        configName: environmentConfig?.name || configFileName,
        hasFirebaseConfig: !!firebaseConfig,
        projectId: firebaseConfig?.projectId,
        authDomain: firebaseConfig?.authDomain
    }, 'config');
    
    if (environmentConfig?.enableConsoleLogging) {
        console.log('🔧 Environment Config:', environmentConfig);
        console.log('🔥 Firebase Config loaded for project:', firebaseConfig.projectId);
    }
    
} catch (error) {
    console.warn(`⚠️ Failed to load config file: ${configFileName}.config.js, falling back to default`);
    console.warn('Error:', error.message);
    
    window.is_enable_api_logging && window.frontendLogger?.warn('Config loading failed - falling back to default', {
        requestedConfig: configFileName,
        error: error.message,
        stack: error.stack,
        fallbackAction: 'loading default config'
    }, 'config');
    
    // Fallback to default configuration
    try {
        const defaultConfig = await import('../config/default.config.js');
        firebaseConfig = defaultConfig.firebaseConfig;
        environmentConfig = defaultConfig.environmentConfig;
        console.log('✅ Fallback to default configuration successful');
    } catch (fallbackError) {
        console.error('❌ Failed to load default configuration:', fallbackError);
        // Last resort: inline default config
        firebaseConfig = {
            apiKey: "AIzaSyDUR4NEfHH0s8aKYvg4RqyyH13h5ZyRFwk",
            authDomain: "tray-tracker-dino.firebaseapp.com",
            projectId: "tray-tracker-dino",
            storageBucket: "tray-tracker-dino.firebasestorage.app",
            messagingSenderId: "587568292924",
            appId: "1:587568292924:web:462b3cb07fc808f86bcf39",
            measurementId: "G-97ZVXH82ZR"
        };
        environmentConfig = {
            name: "inline-fallback",
            description: "Inline Fallback Configuration",
            isDevelopment: true,
            enableConsoleLogging: true,
            enableDebugMode: false,
            enableApiLogging: true  // Global toggle for API logging - set to false in production
        };
    }
}

export { firebaseConfig, environmentConfig };

/*
=== CONFIGURATION SYSTEM USAGE ===

To use different environments, set the ENVIRONMENT_VARIABLE_FILE variable:

1. **Environment Variable (Node.js/Server):**
   export ENVIRONMENT_VARIABLE_FILE="dino-dev-1"

2. **Browser Window Variable:**
   window.ENVIRONMENT_VARIABLE_FILE = "dino-dev-1";

3. **localStorage (Persistent in Browser):**
   localStorage.setItem('ENVIRONMENT_VARIABLE_FILE', 'dino-dev-1');

4. **Docker Environment:**
   docker run -e ENVIRONMENT_VARIABLE_FILE=dino-dev-1 ...

Available configurations:
- default.config.js (default if no env var set) - Development settings with API logging enabled
- dino-dev-1.config.js (Dino's development environment) - Development with debug mode
- production.config.js (production environment) - API logging DISABLED for performance

=== ADDING NEW CONFIGURATIONS ===

Create a new file: config/your-env-name.config.js
Export: firebaseConfig and environmentConfig objects
Set ENVIRONMENT_VARIABLE_FILE="your-env-name"

=== API LOGGING CONTROL ===

The global variable window.is_enable_api_logging controls all API logging:
- Set environmentConfig.enableApiLogging = true for development environments  
- Set environmentConfig.enableApiLogging = false for production to disable API calls
- When disabled: Console logging still works, but no API requests are sent
- This improves production performance by eliminating logging API calls

To disable API logging temporarily:
window.is_enable_api_logging = false;

=== FIREBASE SETUP INSTRUCTIONS ===

1. Go to https://console.firebase.google.com
2. Create a new project named "sibone-tray-tracker"
3. Enable Authentication > Sign-in method > Email/Password
4. Create Firestore Database in production mode
5. Enable Storage
6. Copy your config from Project Settings and replace in config files

=== FIRESTORE SECURITY RULES ===
Go to Firestore Database > Rules and update:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for team view
    }

    // Trays - authenticated users can read/write all trays
    match /trays/{trayId} {
      allow read, write: if request.auth != null;

      // History subcollection
      match /history/{historyId} {
        allow read, write: if request.auth != null;
      }
    }

    // Notifications - authenticated users can read/write
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null;
    }

    // Locations - authenticated users can read/write all locations
    match /locations/{locationId} {
      allow read, write: if request.auth != null;
    }

    // Surgeons - authenticated users can read/write all surgeons
    match /surgeons/{surgeonId} {
      allow read, write: if request.auth != null;
    }

    // Case Types - authenticated users can read/write all case types
    match /casetypes/{caseTypeId} {
      allow read, write: if request.auth != null;
    }

    // Cases - authenticated users can read/write all cases
    match /cases/{caseId} {
      allow read, write: if request.auth != null;
    }
  }
}

=== STORAGE SECURITY RULES ===
Go to Storage > Rules and update:

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tray-photos/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    match /checkin-photos/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    match /pickup-photos/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    match /turnover-photos/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
*/