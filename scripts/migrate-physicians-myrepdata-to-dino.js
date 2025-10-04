const admin = require('firebase-admin');
const path = require('path');

// Initialize MyRepData app
const myRepDataServiceAccount = require(path.join(__dirname, '../server/config/firebase-service-account.json'));
const myRepDataApp = admin.initializeApp({
  credential: admin.credential.cert(myRepDataServiceAccount),
  projectId: myRepDataServiceAccount.project_id
}, 'myrepdata');

// Initialize Tray Tracker Dino app
const dinoServiceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));
const dinoApp = admin.initializeApp({
  credential: admin.credential.cert(dinoServiceAccount),
  projectId: dinoServiceAccount.project_id
}, 'dino');

const myRepDataDb = admin.firestore(myRepDataApp);
const dinoDb = admin.firestore(dinoApp);

async function migratePhysicians() {
  try {
    console.log('🔄 Starting physician migration from MyRepData to Tray Tracker Dino...\n');

    // Fetch physicians from MyRepData
    console.log('📥 Fetching physicians from MyRepData...');
    const myRepDataPhysiciansRef = myRepDataDb.collection('physicians');
    const myRepDataSnapshot = await myRepDataPhysiciansRef.get();

    if (myRepDataSnapshot.empty) {
      console.log('❌ No physicians found in MyRepData');
      return;
    }

    console.log(`✅ Found ${myRepDataSnapshot.size} physicians in MyRepData\n`);

    // Get existing physicians in Dino to check for duplicates
    console.log('📥 Fetching existing physicians from Tray Tracker Dino...');
    const dinoPhysiciansRef = dinoDb.collection('physicians');
    const dinoSnapshot = await dinoPhysiciansRef.get();

    const existingPhysicians = new Map();
    dinoSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
      existingPhysicians.set(name.toLowerCase(), doc.id);
    });

    console.log(`📊 Found ${existingPhysicians.size} existing physicians in Tray Tracker Dino\n`);

    // Migrate physicians
    let added = 0;
    let skipped = 0;
    let errors = 0;

    console.log('🚀 Starting migration...\n');

    for (const doc of myRepDataSnapshot.docs) {
      const data = doc.data();
      const physicianName = data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim();

      try {
        // Check if physician already exists by name
        if (existingPhysicians.has(physicianName.toLowerCase())) {
          console.log(`⏭️  Skipping: ${physicianName} (already exists)`);
          skipped++;
          continue;
        }

        // Add physician to Tray Tracker Dino
        await dinoPhysiciansRef.add(data);
        console.log(`✅ Added: ${physicianName}`);
        added++;

      } catch (error) {
        console.error(`❌ Error adding ${physicianName}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total physicians in MyRepData: ${myRepDataSnapshot.size}`);
    console.log(`Existing physicians in Dino: ${existingPhysicians.size}`);
    console.log(`✅ Successfully added: ${added}`);
    console.log(`⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(80));

    // Verify final count
    const finalSnapshot = await dinoPhysiciansRef.get();
    console.log(`\n📊 Final physician count in Tray Tracker Dino: ${finalSnapshot.size}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    process.exit(0);
  }
}

migratePhysicians();
