const admin = require('firebase-admin');
const path = require('path');

// Initialize MyRepData Firebase project
const myRepDataServiceAccount = require(path.join(__dirname, '../server/config/firebase-service-account.json'));

const myRepDataApp = admin.initializeApp({
  credential: admin.credential.cert(myRepDataServiceAccount)
}, 'myrepdata');

// Initialize Tray Tracker Dino Firebase project
const dinoServiceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));

const dinoApp = admin.initializeApp({
  credential: admin.credential.cert(dinoServiceAccount)
}, 'dino');

async function migrateTrays() {
  try {
    console.log('📦 Fetching tray tracking records from MyRepData...');

    const myRepDataDb = myRepDataApp.firestore();
    const traysSnapshot = await myRepDataDb.collection('tray_tracking').get();

    console.log(`Found ${traysSnapshot.size} tray tracking records in MyRepData`);

    if (traysSnapshot.empty) {
      console.log('No tray tracking records found in MyRepData');
      return;
    }

    const dinoDb = dinoApp.firestore();
    const batch = dinoDb.batch();
    let count = 0;

    console.log('\n📋 Tray tracking record details:');
    traysSnapshot.forEach((doc) => {
      const trayData = doc.data();
      console.log(`\nTray Tracking ID: ${doc.id}`);
      console.log(`  Tray Name: ${trayData.tray_name || 'N/A'}`);
      console.log(`  Tray ID: ${trayData.tray_id || 'N/A'}`);
      console.log(`  Status: ${trayData.status || 'N/A'}`);
      console.log(`  Type: ${trayData.type || 'N/A'}`);
      console.log(`  Location: ${trayData.location || 'N/A'}`);
      console.log(`  Facility: ${trayData.facility || 'N/A'}`);
      console.log(`  Surgeon: ${trayData.surgeon || 'N/A'}`);
      console.log(`  Implant Type ID: ${trayData.implant_type_id || 'N/A'}`);
      console.log(`  Fields: ${Object.keys(trayData).join(', ')}`);

      const trayRef = dinoDb.collection('tray_tracking').doc(doc.id);
      batch.set(trayRef, trayData);
      count++;
    });

    console.log(`\n🚀 Migrating ${count} tray tracking records to Tray Tracker Dino...`);
    await batch.commit();

    console.log(`✅ Successfully migrated ${count} tray tracking records!`);

    // Verify migration
    const dinoTraysSnapshot = await dinoDb.collection('tray_tracking').get();
    console.log(`\n✅ Verification: Tray Tracker Dino now has ${dinoTraysSnapshot.size} tray tracking records`);

  } catch (error) {
    console.error('❌ Error migrating trays:', error);
  } finally {
    // Cleanup
    await myRepDataApp.delete();
    await dinoApp.delete();
  }
}

migrateTrays();
