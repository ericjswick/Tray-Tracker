const admin = require('firebase-admin');
const serviceAccount = require('./server/config/dev-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDisposableLineItems() {
  try {
    console.log('Fetching all documents from disposable_saved_line_items collection...\n');

    const snapshot = await db.collection('disposable_saved_line_items').get();

    if (snapshot.empty) {
      console.log('No documents found in disposable_saved_line_items collection.');
      return;
    }

    console.log(`Found ${snapshot.size} document(s):\n`);

    snapshot.forEach(doc => {
      console.log('Document ID:', doc.id);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
      console.log('---\n');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDisposableLineItems();
