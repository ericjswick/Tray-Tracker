const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkPhysicians() {
  const db = app.firestore();

  // Get tray tracking records with physician_id
  const traySnapshot = await db.collection('tray_tracking').where('physician_id', '!=', '').limit(5).get();

  console.log('Sample physician IDs from tray_tracking:\n');
  traySnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Tray: ${data.tray_name}`);
    console.log(`  physician_id: "${data.physician_id}" (length: ${data.physician_id ? data.physician_id.length : 0})`);
    console.log(`  surgeon: "${data.surgeon}" (length: ${data.surgeon ? data.surgeon.length : 0})`);
    console.log('');
  });

  await app.delete();
}

checkPhysicians();
