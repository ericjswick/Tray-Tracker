// config/dino-dev-1.config.js - Dino Development Environment 1
export const firebaseConfig = {
    apiKey: "AIzaSyDUR4NEfHH0s8aKYvg4RqyyH13h5ZyRFwk",
    authDomain: "tray-tracker-dino.firebaseapp.com",
    projectId: "tray-tracker-dino",
    storageBucket: "tray-tracker-dino.firebasestorage.app",
    messagingSenderId: "587568292924",
    appId: "1:587568292924:web:462b3cb07fc808f86bcf39",
    measurementId: "G-97ZVXH82ZR"
};

// Google Places API configuration
export const googlePlacesConfig = {
    apiKey: "AIzaSyAG0BVldOukQNWUV-XiC5oDe2OTX33EYaA"
};

// Environment-specific settings
export const environmentConfig = {
    name: "dino-dev-1",
    description: "Dino Development Environment 1",
    isDevelopment: true,
    enableConsoleLogging: true,
    enableDebugMode: true,
    enableApiLogging: true  // Global toggle for API logging - set to false in production
};
