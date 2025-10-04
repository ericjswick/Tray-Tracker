const admin = require('firebase-admin');
const path = require('path');

// Path to service account key
const serviceAccountPath = path.join(__dirname, '../server/config/firebase-service-account.json');

// Initialize Firebase Admin SDK with service account
try {
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
} catch (error) {
  console.log('Firebase already initialized or error:', error.message);
}

const db = admin.firestore();

async function analyzePhysicianNames() {
  try {
    const physiciansRef = db.collection('physicians');
    const snapshot = await physiciansRef.get();

    const withoutFullName = [];
    const withFullName = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.full_name) {
        withoutFullName.push({
          id: doc.id,
          first_name: data.first_name,
          last_name: data.last_name,
          name: data.name
        });
      } else {
        withFullName.push({
          id: doc.id,
          full_name: data.full_name
        });
      }
    });

    console.log('📊 PHYSICIAN NAME ANALYSIS\n');
    console.log('='.repeat(80));
    console.log(`Total physicians: ${snapshot.size}`);
    console.log(`With full_name: ${withFullName.length}`);
    console.log(`Without full_name: ${withoutFullName.length}`);
    console.log('='.repeat(80));

    if (withoutFullName.length > 0) {
      console.log('\n❌ Physicians WITHOUT full_name field:\n');
      withoutFullName.forEach(p => {
        console.log(`ID: ${p.id}`);
        console.log(`  first_name: ${p.first_name || 'N/A'}`);
        console.log(`  last_name: ${p.last_name || 'N/A'}`);
        console.log(`  name: ${p.name || 'N/A'}`);
        console.log('-'.repeat(40));
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

analyzePhysicianNames();
