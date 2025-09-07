// SurgeonToPhysicianMigration.js - Frontend migration utility for MyRepData compatibility
export class SurgeonToPhysicianMigration {
  constructor(db) {
    this.db = db;
  }
  
  /**
   * Preview changes without applying them
   */
  async dryRun() {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔍 Starting dry run of surgeons → physicians migration...\n');
      
      const surgeonsCollection = collection(this.db, 'surgeons');
      const snapshot = await getDocs(surgeonsCollection);
      
      if (snapshot.empty) {
        console.log('No surgeon documents found.');
        return;
      }
      
      console.log(`Found ${snapshot.size} surgeon documents to migrate.\n`);
      
      // Show first 3 documents as examples
      const examples = [];
      let count = 0;
      
      snapshot.forEach((doc) => {
        if (count < 3) {
          const data = doc.data();
          examples.push({
            id: doc.id,
            name: data.name || 'Unnamed',
            data: data
          });
          count++;
        }
      });
      
      // Display examples
      examples.forEach((example, index) => {
        console.log(`--- Example ${index + 1}: ${example.id} (${example.name}) ---`);
        console.log('📋 Will be copied to physicians collection with same data structure');
        console.log('🔧 Fields:', Object.keys(example.data).join(', '));
        console.log('');
      });
      
      console.log(`🔍 Dry run completed. ${snapshot.size} documents would be migrated.`);
      console.log('💡 Run surgeonToPhysicianMigration.migrate() to apply changes.');
      console.log('⚠️ Remember to update code references from "surgeons" to "physicians" after migration.');
      
    } catch (error) {
      console.error('💥 Dry run failed:', error);
    }
  }
  
  /**
   * Apply migration: copy all surgeons to physicians collection
   */
  async migrate() {
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🚀 Starting surgeons → physicians collection migration...\n');
      
      const surgeonsCollection = collection(this.db, 'surgeons');
      const snapshot = await getDocs(surgeonsCollection);
      
      if (snapshot.empty) {
        console.log('No surgeon documents found to migrate.');
        return;
      }
      
      console.log(`Found ${snapshot.size} surgeon documents to migrate.\n`);
      
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
        const surgeonData = docSnapshot.data();
        
        try {
          console.log(`Processing: ${documentId} (${surgeonData.name || 'Unnamed'})`);
          
          // Copy to physicians collection with same ID and data
          const physicianDocRef = doc(this.db, 'physicians', documentId);
          await setDoc(physicianDocRef, surgeonData);
          
          console.log(`✅ Successfully copied to physicians: ${documentId}`);
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
      console.log('  1. Update all code references from "surgeons" to "physicians"');
      console.log('  2. Test the application with the new physicians collection');
      console.log('  3. Once verified, you can delete the old surgeons collection');
      console.log('🔄 Your surgeons are now physicians - compatible with MyRepData!');
      
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
      
      console.log('🔍 Checking surgeons/physicians compatibility...\n');
      
      const surgeonsCollection = collection(this.db, 'surgeons');
      const physiciansCollection = collection(this.db, 'physicians');
      
      const [surgeonsSnapshot, physiciansSnapshot] = await Promise.all([
        getDocs(surgeonsCollection),
        getDocs(physiciansCollection)
      ]);
      
      console.log(`📊 Collection Status:`);
      console.log(`Surgeons collection: ${surgeonsSnapshot.size} documents`);
      console.log(`Physicians collection: ${physiciansSnapshot.size} documents\n`);
      
      if (surgeonsSnapshot.size > 0 && physiciansSnapshot.size === 0) {
        console.log('⚠️ Migration needed: Surgeons exist but no physicians collection');
        console.log('💡 Run surgeonToPhysicianMigration.migrate() to create physicians collection');
      } else if (surgeonsSnapshot.size > 0 && physiciansSnapshot.size > 0) {
        console.log('✅ Both collections exist - migration may have been run');
        console.log('🔧 Verify data consistency and update code references');
      } else if (surgeonsSnapshot.size === 0 && physiciansSnapshot.size > 0) {
        console.log('✅ Fully migrated - only physicians collection exists');
        console.log('🎉 MyRepData compatible!');
      } else {
        console.log('📝 No surgeon or physician data found');
      }
      
    } catch (error) {
      console.error('💥 Compatibility check failed:', error);
    }
  }
  
  /**
   * Rollback migration by copying physicians back to surgeons
   */
  async rollback() {
    if (!confirm('⚠️ This will copy all physicians back to surgeons collection. Continue?')) {
      return;
    }
    
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔄 Starting rollback: physicians → surgeons...\n');
      
      const physiciansCollection = collection(this.db, 'physicians');
      const snapshot = await getDocs(physiciansCollection);
      
      if (snapshot.empty) {
        console.log('No physician documents found to rollback.');
        return;
      }
      
      console.log(`Found ${snapshot.size} physician documents to rollback.\n`);
      
      let successful = 0;
      let failed = 0;
      
      // Process each document
      for (const docSnapshot of snapshot.docs) {
        const documentId = docSnapshot.id;
        const physicianData = docSnapshot.data();
        
        try {
          console.log(`Rolling back: ${documentId} (${physicianData.name || 'Unnamed'})`);
          
          // Copy back to surgeons collection
          const surgeonDocRef = doc(this.db, 'surgeons', documentId);
          await setDoc(surgeonDocRef, physicianData);
          
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