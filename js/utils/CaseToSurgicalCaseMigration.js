// CaseToSurgicalCaseMigration.js - Frontend migration utility for MyRepData compatibility
export class CaseToSurgicalCaseMigration {
  constructor(db) {
    this.db = db;
  }
  
  /**
   * Preview changes without applying them
   */
  async dryRun() {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔍 Starting dry run of cases → surgical_cases migration...\n');
      
      const casesCollection = collection(this.db, 'cases');
      const snapshot = await getDocs(casesCollection);
      
      if (snapshot.empty) {
        console.log('No case documents found.');
        return;
      }
      
      console.log(`Found ${snapshot.size} case documents to migrate.\n`);
      
      // Show first 3 documents as examples
      const examples = [];
      let count = 0;
      
      snapshot.forEach((doc) => {
        if (count < 3) {
          const data = doc.data();
          examples.push({
            id: doc.id,
            trayName: data.trayName || 'Unknown Tray',
            surgeon: data.surgeon || 'Unknown Surgeon',
            caseDate: data.caseDate || 'No Date',
            data: data
          });
          count++;
        }
      });
      
      // Display examples
      examples.forEach((example, index) => {
        console.log(`--- Example ${index + 1}: ${example.id} ---`);
        console.log(`📋 Tray: ${example.trayName}`);
        console.log(`👨‍⚕️ Surgeon: ${example.surgeon}`);
        console.log(`📅 Date: ${example.caseDate}`);
        console.log('🔧 Will be copied to surgical_cases collection');
        console.log('💡 Compatible fields:', Object.keys(example.data).filter(key => 
          ['case_id', 'tray_id', 'physician_id', 'facility_id', 'scheduled_date', 'status', 'created_at', 'updated_at'].includes(key) ||
          ['trayName', 'surgeon', 'caseDate', 'facility', 'status'].includes(key)
        ).join(', '));
        console.log('');
      });
      
      console.log(`🔍 Dry run completed. ${snapshot.size} documents would be migrated.`);
      console.log('💡 Run caseToSurgicalCaseMigration.migrate() to apply changes.');
      console.log('⚠️ Remember to update code references from "cases" to "surgical_cases" after migration.');
      
    } catch (error) {
      console.error('💥 Dry run failed:', error);
    }
  }
  
  /**
   * Apply migration: copy all cases to surgical_cases collection
   */
  async migrate() {
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🚀 Starting cases → surgical_cases collection migration...\n');
      
      const casesCollection = collection(this.db, 'cases');
      const snapshot = await getDocs(casesCollection);
      
      if (snapshot.empty) {
        console.log('No case documents found to migrate.');
        return;
      }
      
      console.log(`Found ${snapshot.size} case documents to migrate.\n`);
      
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
        const caseData = docSnapshot.data();
        
        try {
          console.log(`Processing: ${documentId} (${caseData.trayName || 'Unknown Tray'})`);
          
          // Transform to MyRepData compatible format
          const surgicalCaseData = {
            ...caseData,
            // Ensure case_id is set
            case_id: caseData.case_id || documentId,
            // Map tray-tracker fields to MyRepData fields
            physician_id: caseData.physician_id || caseData.surgeon || '',
            facility_id: caseData.facility_id || caseData.facility || '',
            scheduled_date: caseData.scheduled_date || caseData.caseDate || '',
            tray_id: caseData.tray_id || caseData.trayId || '',
            // Ensure timestamps exist
            created_at: caseData.created_at || caseData.createdAt || new Date(),
            updated_at: caseData.updated_at || caseData.lastModified || new Date(),
            // Keep original fields for backward compatibility
            trayName: caseData.trayName || '',
            surgeon: caseData.surgeon || '',
            caseDate: caseData.caseDate || '',
            facility: caseData.facility || '',
            status: caseData.status || 'scheduled'
          };
          
          // Copy to surgical_cases collection with same ID and enhanced data
          const surgicalCaseDocRef = doc(this.db, 'surgical_cases', documentId);
          await setDoc(surgicalCaseDocRef, surgicalCaseData);
          
          console.log(`✅ Successfully copied to surgical_cases: ${documentId}`);
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
      console.log('  1. Update all code references from "cases" to "surgical_cases"');
      console.log('  2. Update CasesManager and DataManager to use surgical_cases collection');
      console.log('  3. Test the application with the new surgical_cases collection');
      console.log('  4. Once verified, you can delete the old cases collection');
      console.log('🔄 Your cases are now surgical_cases - compatible with MyRepData!');
      
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
      
      console.log('🔍 Checking cases/surgical_cases compatibility...\n');
      
      const casesCollection = collection(this.db, 'cases');
      const surgicalCasesCollection = collection(this.db, 'surgical_cases');
      
      const [casesSnapshot, surgicalCasesSnapshot] = await Promise.all([
        getDocs(casesCollection),
        getDocs(surgicalCasesCollection)
      ]);
      
      console.log(`📊 Collection Status:`);
      console.log(`Cases collection: ${casesSnapshot.size} documents`);
      console.log(`Surgical_cases collection: ${surgicalCasesSnapshot.size} documents\n`);
      
      if (casesSnapshot.size > 0 && surgicalCasesSnapshot.size === 0) {
        console.log('⚠️ Migration needed: Cases exist but no surgical_cases collection');
        console.log('💡 Run caseToSurgicalCaseMigration.migrate() to create surgical_cases collection');
      } else if (casesSnapshot.size > 0 && surgicalCasesSnapshot.size > 0) {
        console.log('✅ Both collections exist - migration may have been run');
        console.log('🔧 Verify data consistency and update code references');
      } else if (casesSnapshot.size === 0 && surgicalCasesSnapshot.size > 0) {
        console.log('✅ Fully migrated - only surgical_cases collection exists');
        console.log('🎉 MyRepData compatible!');
      } else {
        console.log('📝 No case or surgical_case data found');
      }
      
    } catch (error) {
      console.error('💥 Compatibility check failed:', error);
    }
  }
  
  /**
   * Rollback migration by copying surgical_cases back to cases
   */
  async rollback() {
    if (!confirm('⚠️ This will copy all surgical_cases back to cases collection. Continue?')) {
      return;
    }
    
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔄 Starting rollback: surgical_cases → cases...\n');
      
      const surgicalCasesCollection = collection(this.db, 'surgical_cases');
      const snapshot = await getDocs(surgicalCasesCollection);
      
      if (snapshot.empty) {
        console.log('No surgical_cases documents found to rollback.');
        return;
      }
      
      console.log(`Found ${snapshot.size} surgical_cases documents to rollback.\n`);
      
      let successful = 0;
      let failed = 0;
      
      // Process each document
      for (const docSnapshot of snapshot.docs) {
        const documentId = docSnapshot.id;
        const surgicalCaseData = docSnapshot.data();
        
        try {
          console.log(`Rolling back: ${documentId} (${surgicalCaseData.trayName || 'Unknown Tray'})`);
          
          // Copy back to cases collection
          const caseDocRef = doc(this.db, 'cases', documentId);
          await setDoc(caseDocRef, surgicalCaseData);
          
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