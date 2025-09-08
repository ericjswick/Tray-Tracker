// Vercel-specific utilities for Firebase and authentication
const admin = require('firebase-admin');

let firestore = null;

// Initialize Firestore admin SDK for Vercel
const initializeFirestore = () => {
  if (firestore) return firestore;

  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        }),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }

    firestore = admin.firestore();
    return firestore;
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    throw new Error('Firestore initialization failed');
  }
};

// Authenticate user from request headers
const authenticateUser = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    return null;
  }
};

// Middleware to inject Firestore into Express requests
const injectFirestore = (req, res, next) => {
  req.firestore = initializeFirestore();
  next();
};

// Middleware to authenticate Express requests
const authenticateRequest = async (req, res, next) => {
  try {
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid authentication',
        details: error.message,
        statusCode: 401
      }
    });
  }
};

// Convert Firestore timestamp to ISO string
const timestampToString = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return timestamp;
};

// Convert object with timestamps to JSON-safe format
const sanitizeFirestoreData = (data) => {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Convert common timestamp fields
  if (sanitized.createdAt) {
    sanitized.createdAt = timestampToString(sanitized.createdAt);
  }
  if (sanitized.lastModified) {
    sanitized.lastModified = timestampToString(sanitized.lastModified);
  }
  if (sanitized.deletedAt) {
    sanitized.deletedAt = timestampToString(sanitized.deletedAt);
  }
  if (sanitized.scheduledDate && typeof sanitized.scheduledDate !== 'string') {
    sanitized.scheduledDate = timestampToString(sanitized.scheduledDate);
  }

  return sanitized;
};

module.exports = {
  initializeFirestore,
  authenticateUser,
  injectFirestore,
  authenticateRequest,
  timestampToString,
  sanitizeFirestoreData
};