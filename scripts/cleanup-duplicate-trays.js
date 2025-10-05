const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../server/config/dev-service-account.json'));
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function cleanupDuplicateTrays() {
  try {
    const db = app.firestore();

    console.log('🔍 Fetching all tray_tracking records...\n');

    const traysSnapshot = await db.collection('tray_tracking').get();

    console.log(`Found ${traysSnapshot.size} total tray tracking records\n`);

    // Group trays by tray_id
    const trayGroups = new Map();

    traysSnapshot.forEach(doc => {
      const data = doc.data();
      const trayId = data.tray_id || doc.id;

      if (!trayGroups.has(trayId)) {
        trayGroups.set(trayId, []);
      }

      trayGroups.get(trayId).push({
        documentId: doc.id,
        trayId: trayId,
        name: data.tray_name,
        created_at: data.created_at,
        isDemoTray: data.isDemoTray,
        data: data
      });
    });

    // Find duplicates
    const duplicates = [];
    for (const [trayId, trays] of trayGroups.entries()) {
      if (trays.length > 1) {
        duplicates.push({ trayId, trays });
      }
    }

    console.log(`Found ${duplicates.length} duplicate tray_id values:\n`);

    if (duplicates.length === 0) {
      console.log('No duplicates to clean up!');
      await app.delete();
      return;
    }

    // Show duplicates
    duplicates.forEach(dup => {
      console.log(`\n📦 tray_id: ${dup.trayId} (${dup.trays.length} copies)`);
      dup.trays.forEach((tray, index) => {
        console.log(`  ${index + 1}. Document ID: ${tray.documentId}`);
        console.log(`     Name: ${tray.name}`);
        console.log(`     Created: ${tray.created_at ? new Date(tray.created_at.seconds * 1000).toISOString() : 'N/A'}`);
        console.log(`     Demo: ${tray.isDemoTray || false}`);
      });
    });

    console.log('\n\n🗑️  Cleanup Strategy:');
    console.log('For each duplicate set, we will KEEP the record where:');
    console.log('  1. document.id === tray_id (original MyRepData ID)');
    console.log('  2. If none match, keep the oldest record (earliest created_at)');
    console.log('  3. DELETE all other duplicates\n');

    // Determine which to keep and which to delete
    const toDelete = [];
    const toKeep = [];

    duplicates.forEach(dup => {
      // First priority: keep the one where document ID matches tray_id
      let keepRecord = dup.trays.find(t => t.documentId === t.trayId);

      if (!keepRecord) {
        // Second priority: keep the oldest one
        keepRecord = dup.trays.reduce((oldest, current) => {
          if (!oldest.created_at) return current;
          if (!current.created_at) return oldest;
          return current.created_at.seconds < oldest.created_at.seconds ? current : oldest;
        });
      }

      toKeep.push(keepRecord);

      // Mark all others for deletion
      dup.trays.forEach(tray => {
        if (tray.documentId !== keepRecord.documentId) {
          toDelete.push(tray);
        }
      });
    });

    console.log(`\n📊 Summary:`);
    console.log(`  Keep: ${toKeep.length} records`);
    console.log(`  Delete: ${toDelete.length} records\n`);

    console.log('Records to DELETE:');
    toDelete.forEach(tray => {
      console.log(`  ❌ ${tray.documentId} - ${tray.name} (tray_id: ${tray.trayId})`);
    });

    console.log('\nRecords to KEEP:');
    toKeep.forEach(tray => {
      console.log(`  ✅ ${tray.documentId} - ${tray.name} (tray_id: ${tray.trayId})`);
    });

    // Perform deletion
    console.log('\n🗑️  Deleting duplicate records...\n');

    const batch = db.batch();
    toDelete.forEach(tray => {
      const docRef = db.collection('tray_tracking').doc(tray.documentId);
      batch.delete(docRef);
      console.log(`  Deleting: ${tray.documentId}`);
    });

    await batch.commit();

    console.log(`\n✅ Successfully deleted ${toDelete.length} duplicate records!`);

    // Verify
    const afterSnapshot = await db.collection('tray_tracking').get();
    console.log(`\n✅ Verification: tray_tracking now has ${afterSnapshot.size} records (was ${traysSnapshot.size})`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await app.delete();
  }
}

cleanupDuplicateTrays();
