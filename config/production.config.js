// config/production.config.js - Production Configuration
export const firebaseConfig = {
    // Production Firebase configuration would go here
    apiKey: "PRODUCTION_API_KEY",
    authDomain: "your-production-project.firebaseapp.com",
    projectId: "your-production-project",
    storageBucket: "your-production-project.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:your-production-app-id",
    measurementId: "G-PRODUCTION-ID"
};

// Production environment settings
export const environmentConfig = {
    name: "production",
    description: "Production Configuration",
    isDevelopment: false,
    enableConsoleLogging: false,  // Disable console logging in production
    enableDebugMode: false,       // Disable debug mode in production
    enableApiLogging: false       // DISABLE API logging in production for performance
};