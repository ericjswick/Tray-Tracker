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

async function comparePhysicianIds() {
  try {
    const myRepDataDb = myRepDataApp.firestore();
    const dinoDb = dinoApp.firestore();

    // Get all physicians from both databases
    const myRepDataPhysicians = await myRepDataDb.collection('physicians').get();
    const dinoPhysicians = await dinoDb.collection('physicians').get();

    console.log(`MyRepData physicians: ${myRepDataPhysicians.size}`);
    console.log(`Dino physicians: ${dinoPhysicians.size}\n`);

    // Get physician IDs used in MyRepData trays
    const myRepDataTrays = await myRepDataDb.collection('tray_tracking').where('physician_id', '!=', '').limit(10).get();

    console.log('Checking physician IDs from MyRepData trays:\n');

    const myRepDataPhysicianMap = new Map();
    myRepDataPhysicians.forEach(doc => {
      myRepDataPhysicianMap.set(doc.id, doc.data());
    });

    const dinoPhysicianMap = new Map();
    dinoPhysicians.forEach(doc => {
      dinoPhysicianMap.set(doc.id, doc.data());
    });

    myRepDataTrays.forEach(doc => {
      const trayData = doc.data();
      const physicianId = trayData.physician_id || trayData.surgeon;

      if (physicianId) {
        console.log(`Tray: ${trayData.tray_name}`);
        console.log(`  Physician ID: ${physicianId}`);

        const myRepDataPhysician = myRepDataPhysicianMap.get(physicianId);
        console.log(`  Exists in MyRepData physicians: ${myRepDataPhysician ? 'YES' : 'NO'}`);
        if (myRepDataPhysician) {
          console.log(`    Name: ${myRepDataPhysician.full_name || myRepDataPhysician.name || 'N/A'}`);
        }

        const dinoPhysician = dinoPhysicianMap.get(physicianId);
        console.log(`  Exists in Dino physicians: ${dinoPhysician ? 'YES' : 'NO'}`);
        if (dinoPhysician) {
          console.log(`    Name: ${dinoPhysician.full_name || dinoPhysician.name || 'N/A'}`);
        }
        console.log('');
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await myRepDataApp.delete();
    await dinoApp.delete();
  }
}

comparePhysicianIds();
