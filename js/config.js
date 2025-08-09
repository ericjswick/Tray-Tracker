// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
export const firebaseConfig = {
    apiKey: "AIzaSyD3Tc8crUqOXEg4rKIIYvsyT-LJPEpTIcA",
    authDomain: "si-bone-tracking.firebaseapp.com",
    projectId: "si-bone-tracking",
    storageBucket: "si-bone-tracking.firebasestorage.app",
    messagingSenderId: "1065056003859",
    appId: "1:1065056003859:web:aaae14ed73ec3dcae51ce6",
    measurementId: "G-99MZFWPBJR"
};


/*
=== FIREBASE SETUP INSTRUCTIONS ===

1. Go to https://console.firebase.google.com
2. Create a new project named "sibone-tray-tracker"
3. Enable Authentication > Sign-in method > Email/Password
4. Create Firestore Database in production mode
5. Enable Storage
6. Copy your config from Project Settings and replace the above config

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