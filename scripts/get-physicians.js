const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Note: This requires a service account key file or default credentials
try {
  admin.initializeApp({
    projectId: 'myrepdata'
  });
} catch (error) {
  console.log('Firebase already initialized or error:', error.message);
}

const db = admin.firestore();

async function getPhysicians() {
  try {
    console.log('📋 Fetching physicians from MyRepData...\n');

    const physiciansRef = db.collection('physicians');
    const snapshot = await physiciansRef.get();

    if (snapshot.empty) {
      console.log('No physicians found in the collection.');
      return;
    }

    console.log(`Found ${snapshot.size} physicians:\n`);
    console.log('='.repeat(80));

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nID: ${doc.id}`);
      console.log(`Name: ${data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim()}`);
      console.log(`Title: ${data.title || 'N/A'}`);
      console.log(`Specialty: ${data.specialty || 'N/A'}`);
      console.log(`Email: ${data.email || 'N/A'}`);
      console.log(`Phone: ${data.phone || 'N/A'}`);
      console.log(`Active: ${data.active !== undefined ? data.active : 'N/A'}`);
      console.log(`Created At: ${data.created_at || data.createdAt || 'N/A'}`);
      console.log('-'.repeat(80));
    });

    // Also output JSON for easier processing
    console.log('\n\nJSON Format:');
    console.log('='.repeat(80));
    const physiciansArray = [];
    snapshot.forEach(doc => {
      physiciansArray.push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log(JSON.stringify(physiciansArray, null, 2));

  } catch (error) {
    console.error('❌ Error fetching physicians:', error);
    console.error('Error details:', error.message);
  } finally {
    process.exit(0);
  }
}

getPhysicians();
