const admin = require('firebase-admin');
const path = require('path');

// Initialize MyRepData Firebase project
const myRepDataServiceAccount = require(path.join(__dirname, '../server/config/firebase-service-account.json'));

const myRepDataApp = admin.initializeApp({
  credential: admin.credential.cert(myRepDataServiceAccount)
}, 'myrepdata');

async function listCollections() {
  try {
    const db = myRepDataApp.firestore();

    console.log('📋 Listing all collections in MyRepData...\n');

    const collections = await db.listCollections();

    console.log(`Found ${collections.length} collections:\n`);

    for (const collection of collections) {
      console.log(`Collection: ${collection.id}`);

      // Get count of documents
      const snapshot = await collection.limit(5).get();
      console.log(`  Documents: ${snapshot.size} (showing first 5)`);

      // Show first document structure
      if (!snapshot.empty) {
        const firstDoc = snapshot.docs[0];
        console.log(`  Sample document ID: ${firstDoc.id}`);
        console.log(`  Fields: ${Object.keys(firstDoc.data()).join(', ')}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await myRepDataApp.delete();
  }
}

listCollections();
