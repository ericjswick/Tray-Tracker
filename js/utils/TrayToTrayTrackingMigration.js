// TrayToTrayTrackingMigration.js - Frontend migration utility for MyRepData compatibility
export class TrayToTrayTrackingMigration {
  constructor(db) {
    this.db = db;
  }
  
  /**
   * Preview changes without applying them
   */
  async dryRun() {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔍 Starting dry run of trays → tray_tracking migration...\n');
      
      const traysCollection = collection(this.db, 'trays');
      const snapshot = await getDocs(traysCollection);
      
      if (snapshot.empty) {
        console.log('No tray documents found.');
        return;
      }
      
      console.log(`Found ${snapshot.size} tray documents to migrate.\n`);
      
      // Show first 3 documents as examples
      const examples = [];
      let count = 0;
      
      snapshot.forEach((doc) => {
        if (count < 3) {
          const data = doc.data();
          examples.push({
            id: doc.id,
            name: data.name || 'Unnamed',
            status: data.status || 'unknown',
            data: data
          });
          count++;
        }
      });
      
      // Display examples
      examples.forEach((example, index) => {
        console.log(`--- Example ${index + 1}: ${example.id} (${example.name}) ---`);
        console.log(`📋 Status: ${example.status}`);
        console.log('🔧 Will be copied to tray_tracking collection');
        console.log('💡 Compatible fields:', Object.keys(example.data).filter(key => 
          ['tray_id', 'name', 'status', 'location', 'scheduled_date', 'physician_id', 'facility_id', 'created_at', 'updated_at'].includes(key)
        ).join(', '));
        console.log('');
      });
      
      console.log(`🔍 Dry run completed. ${snapshot.size} documents would be migrated.`);
      console.log('💡 Run trayToTrayTrackingMigration.migrate() to apply changes.');
      console.log('⚠️ Remember to update code references from "trays" to "tray_tracking" after migration.');
      
    } catch (error) {
      console.error('💥 Dry run failed:', error);
    }
  }
  
  /**
   * Apply migration: copy all trays to tray_tracking collection
   */
  async migrate() {
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🚀 Starting trays → tray_tracking collection migration...\n');
      
      const traysCollection = collection(this.db, 'trays');
      const snapshot = await getDocs(traysCollection);
      
      if (snapshot.empty) {
        console.log('No tray documents found to migrate.');
        return;
      }
      
      console.log(`Found ${snapshot.size} tray documents to migrate.\n`);
      
      // Track results
      const results = {
        total: snapshot.size,
        successful: 0,
        failed: 0,
        errors: []
      };
      
      // Process each document
      for (const docSnapshot of snapshot.docs) {
        const documentId = docSnapshot.id;
        const trayData = docSnapshot.data();
        
        try {
          console.log(`Processing: ${documentId} (${trayData.name || 'Unnamed'})`);
          
          // Ensure MyRepData compatible fields are present
          const trackingData = {
            ...trayData,
            // Ensure tray_id is set (should already be there from field migration)
            tray_id: trayData.tray_id || documentId,
            // Ensure other MyRepData compatible fields exist
            created_at: trayData.created_at || trayData.createdAt || new Date(),
            updated_at: trayData.updated_at || trayData.lastModified || new Date(),
            physician_id: trayData.physician_id || trayData.surgeon || '',
            scheduled_date: trayData.scheduled_date || trayData.caseDate || '',
            facility_id: trayData.facility_id || trayData.facility || ''
          };
          
          // Copy to tray_tracking collection with same ID and enhanced data
          const trackingDocRef = doc(this.db, 'tray_tracking', documentId);
          await setDoc(trackingDocRef, trackingData);
          
          console.log(`✅ Successfully copied to tray_tracking: ${documentId}`);
          results.successful++;
          
        } catch (error) {
          console.error(`❌ Failed to migrate ${documentId}:`, error);
          results.failed++;
          results.errors.push({
            id: documentId,
            error: error.message
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Print summary
      console.log('\n📊 Migration Summary:');
      console.log(`Total documents: ${results.total}`);
      console.log(`Successful: ${results.successful}`);
      console.log(`Failed: ${results.failed}`);
      
      if (results.errors.length > 0) {
        console.log('\n❌ Failed migrations:');
        results.errors.forEach(error => {
          console.log(`  - ${error.id}: ${error.error}`);
        });
      }
      
      console.log('\n✅ Migration completed!');
      console.log('📝 Next steps:');
      console.log('  1. Update all code references from "trays" to "tray_tracking"');
      console.log('  2. Update TrayManager and DataManager to use tray_tracking collection');
      console.log('  3. Test the application with the new tray_tracking collection');
      console.log('  4. Once verified, you can delete the old trays collection');
      console.log('🔄 Your trays are now in tray_tracking - compatible with MyRepData!');
      
    } catch (error) {
      console.error('💥 Migration failed:', error);
    }
  }
  
  /**
   * Check current compatibility status
   */
  async checkCompatibility() {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔍 Checking trays/tray_tracking compatibility...\n');
      
      const traysCollection = collection(this.db, 'trays');
      const trackingCollection = collection(this.db, 'tray_tracking');
      
      const [traysSnapshot, trackingSnapshot] = await Promise.all([
        getDocs(traysCollection),
        getDocs(trackingCollection)
      ]);
      
      console.log(`📊 Collection Status:`);
      console.log(`Trays collection: ${traysSnapshot.size} documents`);
      console.log(`Tray_tracking collection: ${trackingSnapshot.size} documents\n`);
      
      if (traysSnapshot.size > 0 && trackingSnapshot.size === 0) {
        console.log('⚠️ Migration needed: Trays exist but no tray_tracking collection');
        console.log('💡 Run trayToTrayTrackingMigration.migrate() to create tray_tracking collection');
      } else if (traysSnapshot.size > 0 && trackingSnapshot.size > 0) {
        console.log('✅ Both collections exist - migration may have been run');
        console.log('🔧 Verify data consistency and update code references');
      } else if (traysSnapshot.size === 0 && trackingSnapshot.size > 0) {
        console.log('✅ Fully migrated - only tray_tracking collection exists');
        console.log('🎉 MyRepData compatible!');
      } else {
        console.log('📝 No tray or tray_tracking data found');
      }
      
    } catch (error) {
      console.error('💥 Compatibility check failed:', error);
    }
  }
  
  /**
   * Rollback migration by copying tray_tracking back to trays
   */
  async rollback() {
    if (!confirm('⚠️ This will copy all tray_tracking back to trays collection. Continue?')) {
      return;
    }
    
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔄 Starting rollback: tray_tracking → trays...\n');
      
      const trackingCollection = collection(this.db, 'tray_tracking');
      const snapshot = await getDocs(trackingCollection);
      
      if (snapshot.empty) {
        console.log('No tray_tracking documents found to rollback.');
        return;
      }
      
      console.log(`Found ${snapshot.size} tray_tracking documents to rollback.\n`);
      
      let successful = 0;
      let failed = 0;
      
      // Process each document
      for (const docSnapshot of snapshot.docs) {
        const documentId = docSnapshot.id;
        const trackingData = docSnapshot.data();
        
        try {
          console.log(`Rolling back: ${documentId} (${trackingData.name || 'Unnamed'})`);
          
          // Copy back to trays collection
          const trayDocRef = doc(this.db, 'trays', documentId);
          await setDoc(trayDocRef, trackingData);
          
          console.log(`✅ Successfully rolled back: ${documentId}`);
          successful++;
          
        } catch (error) {
          console.error(`❌ Failed to rollback ${documentId}:`, error);
          failed++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('\n📊 Rollback Summary:');
      console.log(`Successful: ${successful}`);
      console.log(`Failed: ${failed}`);
      console.log('\n✅ Rollback completed!');
      
    } catch (error) {
      console.error('💥 Rollback failed:', error);
    }
  }
}