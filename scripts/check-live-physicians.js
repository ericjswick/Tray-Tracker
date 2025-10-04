const admin = require('firebase-admin');
const path = require('path');

// Initialize Dino (live site)
const dinoServiceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));
const dinoApp = admin.initializeApp({
  credential: admin.credential.cert(dinoServiceAccount)
});

async function checkLivePhysicians() {
  try {
    const db = dinoApp.firestore();

    // Get some tray tracking records with physician IDs
    const traysSnapshot = await db.collection('tray_tracking')
      .where('physician_id', '!=', '')
      .limit(10)
      .get();

    console.log('Checking physician IDs on live site:\n');

    // Get all physicians
    const physiciansSnapshot = await db.collection('physicians').get();
    const physicianMap = new Map();
    physiciansSnapshot.forEach(doc => {
      physicianMap.set(doc.id, doc.data());
    });

    console.log(`Total physicians in database: ${physiciansSnapshot.size}\n`);

    traysSnapshot.forEach(doc => {
      const trayData = doc.data();
      const physicianId = trayData.physician_id || trayData.surgeon;

      if (physicianId) {
        console.log(`Tray: ${trayData.tray_name}`);
        console.log(`  Physician ID in tray: "${physicianId}"`);

        const physician = physicianMap.get(physicianId);
        console.log(`  Found in physicians collection: ${physician ? 'YES' : 'NO'}`);

        if (physician) {
          console.log(`  Physician name: ${physician.full_name || physician.name || 'N/A'}`);
        } else {
          // Check if it's close to any physician ID (maybe extra spaces, etc.)
          console.log(`  Searching for similar IDs...`);
          for (const [id, data] of physicianMap.entries()) {
            if (id.includes(physicianId.trim()) || physicianId.trim().includes(id)) {
              console.log(`    Similar ID found: "${id}" -> ${data.full_name || data.name}`);
            }
          }
        }
        console.log('');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dinoApp.delete();
  }
}

checkLivePhysicians();
