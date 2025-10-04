const admin = require('firebase-admin');
const path = require('path');

// Initialize MyRepData
const myRepDataServiceAccount = require(path.join(__dirname, '../server/config/firebase-service-account.json'));
const myRepDataApp = admin.initializeApp({
  credential: admin.credential.cert(myRepDataServiceAccount)
}, 'myrepdata');

// Initialize Dino
const dinoServiceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));
const dinoApp = admin.initializeApp({
  credential: admin.credential.cert(dinoServiceAccount)
}, 'dino');

async function migratePhysicians() {
  try {
    const myRepDataDb = myRepDataApp.firestore();
    const dinoDb = dinoApp.firestore();

    console.log('📋 Fetching physicians from MyRepData...\n');

    const physiciansSnapshot = await myRepDataDb.collection('physicians').get();

    console.log(`Found ${physiciansSnapshot.size} physicians in MyRepData\n`);

    const batch = dinoDb.batch();
    let count = 0;

    physiciansSnapshot.forEach(doc => {
      const physicianData = doc.data();

      console.log(`Physician ID: ${doc.id}`);
      console.log(`  Name: ${physicianData.full_name || physicianData.name || 'N/A'}`);

      // Use the SAME document ID from MyRepData
      const physicianRef = dinoDb.collection('physicians').doc(doc.id);
      batch.set(physicianRef, physicianData, { merge: true });
      count++;
    });

    console.log(`\n🚀 Migrating ${count} physicians to Tray Tracker Dino (preserving IDs)...`);
    await batch.commit();

    console.log(`✅ Successfully migrated ${count} physicians!`);

    // Verify
    const dinoPhysiciansSnapshot = await dinoDb.collection('physicians').get();
    console.log(`\n✅ Verification: Tray Tracker Dino now has ${dinoPhysiciansSnapshot.size} physicians total`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await myRepDataApp.delete();
    await dinoApp.delete();
  }
}

migratePhysicians();
