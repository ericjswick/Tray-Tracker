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

  console.log('✅ Firebase Admin initialized with project:', serviceAccount.project_id);
} catch (error) {
  console.log('Firebase already initialized or error:', error.message);
}

const db = admin.firestore();

async function getPhysicians() {
  try {
    console.log('📋 Fetching physicians from MyRepData Firestore...\n');

    const physiciansRef = db.collection('physicians');
    const snapshot = await physiciansRef.get();

    if (snapshot.empty) {
      console.log('No physicians found in the collection.');
      return;
    }

    console.log(`Found ${snapshot.size} physicians:\n`);
    console.log('='.repeat(80));

    const physiciansArray = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const physician = {
        id: doc.id,
        ...data
      };

      physiciansArray.push(physician);

      console.log(`\nID: ${doc.id}`);
      console.log(`Name: ${data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim()}`);
      console.log(`Title: ${data.title || 'N/A'}`);
      console.log(`Specialty: ${data.specialty || 'N/A'}`);
      console.log(`Email: ${data.email || 'N/A'}`);
      console.log(`Phone: ${data.phone || 'N/A'}`);
      console.log(`Active: ${data.active !== undefined ? data.active : 'N/A'}`);
      console.log(`Hospital: ${data.hospital || 'N/A'}`);
      console.log(`Preferred Facilities: ${data.preferred_facilities ? JSON.stringify(data.preferred_facilities) : 'N/A'}`);
      console.log(`Created At: ${data.created_at || data.createdAt || 'N/A'}`);
      console.log('-'.repeat(80));
    });

    console.log('\n\n📊 SUMMARY:');
    console.log(`Total Physicians: ${physiciansArray.length}`);

    // Analyze name formats
    const withFullName = physiciansArray.filter(p => p.full_name).length;
    const withFirstLastName = physiciansArray.filter(p => p.first_name || p.last_name).length;
    console.log(`With full_name: ${withFullName}`);
    console.log(`With first_name/last_name: ${withFirstLastName}`);

    // Output JSON
    console.log('\n\n📄 JSON Format:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(physiciansArray, null, 2));

    return physiciansArray;

  } catch (error) {
    console.error('❌ Error fetching physicians:', error);
    console.error('Error details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  } finally {
    process.exit(0);
  }
}

getPhysicians();
