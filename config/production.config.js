// config/production.config.js - Production Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDnZS8Fqn30r0NUd3OfgaxvhwBxIrRcYWw",
  authDomain: "myrepdata.firebaseapp.com",
  projectId: "myrepdata",
  storageBucket: "myrepdata.firebasestorage.app",
  messagingSenderId: "885636146139",
  appId: "1:885636146139:web:885864bcbc57b50f7bfdfe",
  measurementId: "G-PT1CLEXX5X"
};

// Google Places API configuration
export const googlePlacesConfig = {
    apiKey: "AIzaSyAG0BVldOukQNWUV-XiC5oDe2OTX33EYaA"
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