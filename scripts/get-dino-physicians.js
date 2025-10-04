const admin = require('firebase-admin');
const path = require('path');

// Check if we need to use a different service account or if the existing one works
// Tray Tracker Dino project ID from config: tray-tracker-dino

// First, let's try to initialize with the project ID from dino-dev-1.config.js
const projectId = 'tray-tracker-dino';

// Use the dev service account for Tray Tracker Dino
const serviceAccountPath = path.join(__dirname, '../server/config/dev-service-account.json');

try {
  // Check if service account exists
  const serviceAccount = require(serviceAccountPath);

  // Create a new app instance for the dino project
  const dinoApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  }, 'dino'); // Named app instance

  const db = admin.firestore(dinoApp);

  console.log('✅ Firebase Admin initialized for Tray Tracker Dino:', projectId);

  async function getPhysicians() {
    try {
      console.log('📋 Fetching physicians from Tray Tracker Dino...\n');

      const physiciansRef = db.collection('physicians');
      const snapshot = await physiciansRef.get();

      if (snapshot.empty) {
        console.log('No physicians found in the collection.');
        return;
      }

      console.log(`Found ${snapshot.size} physicians:\n`);

      const physiciansArray = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        physiciansArray.push({
          id: doc.id,
          ...data
        });

        console.log(`ID: ${doc.id}`);
        console.log(`Name: ${data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim()}`);
        console.log(`Title: ${data.title || 'N/A'}`);
        console.log(`Active: ${data.active !== undefined ? data.active : 'N/A'}`);
        console.log('-'.repeat(80));
      });

      console.log(`\nTotal: ${physiciansArray.length} physicians`);

      // Check for missing full_name
      const withoutFullName = physiciansArray.filter(p => !p.full_name);
      console.log(`Without full_name: ${withoutFullName.length}`);

      if (withoutFullName.length > 0) {
        console.log('\n❌ Physicians without full_name:');
        withoutFullName.forEach(p => {
          console.log(`  - ID: ${p.id}, first_name: ${p.first_name}, last_name: ${p.last_name}`);
        });
      }

    } catch (error) {
      console.error('❌ Error fetching physicians:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
    } finally {
      process.exit(0);
    }
  }

  getPhysicians();

} catch (error) {
  console.error('❌ Failed to initialize:', error.message);
  process.exit(1);
}
