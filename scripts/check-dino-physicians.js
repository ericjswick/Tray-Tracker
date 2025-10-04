const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkPhysicians() {
  const db = app.firestore();

  // Get all physicians
  const physiciansSnapshot = await db.collection('physicians').get();

  console.log(`Total physicians in Tray Tracker Dino: ${physiciansSnapshot.size}\n`);

  // Get some sample tray physician IDs
  const traySnapshot = await db.collection('tray_tracking').where('physician_id', '!=', '').limit(3).get();

  console.log('Checking if tray physician IDs exist in physicians collection:\n');

  traySnapshot.forEach(doc => {
    const trayData = doc.data();
    const physicianId = trayData.physician_id || trayData.surgeon;

    if (physicianId) {
      const physician = physiciansSnapshot.docs.find(p => p.id === physicianId);

      console.log(`Tray: ${trayData.tray_name}`);
      console.log(`  Physician ID: ${physicianId}`);
      console.log(`  Found in physicians: ${physician ? 'YES' : 'NO'}`);

      if (physician) {
        const data = physician.data();
        console.log(`  Physician name: ${data.full_name || data.name || 'N/A'}`);
      }
      console.log('');
    }
  });

  await app.delete();
}

checkPhysicians();
