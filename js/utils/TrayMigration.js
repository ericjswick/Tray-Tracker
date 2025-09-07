// TrayMigration.js - Frontend migration utility for MyRepData compatibility

export class TrayMigration {
  constructor(db) {
    this.db = db;
    
    // Only migrate fields that MyRepData actually needs
    this.FIELD_MAPPING = {
      'createdAt': 'created_at',
      'lastModified': 'updated_at',
      'surgeon': 'physician_id', 
      'caseDate': 'scheduled_date',
      'facility': 'facility_id'
    };
    
    // Update status values to match MyRepData
    this.STATUS_MAPPING = {
      'available': 'available',
      'in-use': 'in_use',      // Change hyphen to underscore
      'corporate': 'cleaning',  // Map corporate to cleaning
      'trunk': 'maintenance'    // Map trunk to maintenance
    };
  }
  
  /**
   * Transform a single tray document
   */
  transformTrayDocument(trayData, documentId) {
    const transformed = { ...trayData }; // Start with all existing data
    
    // Add tray_id field (using document ID)
    transformed.tray_id = documentId;
    
    // Add MyRepData compatible fields (keep originals for backward compatibility)
    Object.entries(this.FIELD_MAPPING).forEach(([oldField, newField]) => {
      if (trayData[oldField] !== undefined) {
        transformed[newField] = trayData[oldField];
      }
    });
    
    // Update status if needed
    if (trayData.status && this.STATUS_MAPPING[trayData.status]) {
      transformed.status = this.STATUS_MAPPING[trayData.status];
    }
    
    return transformed;
  }
  
  /**
   * Preview changes without applying them
   */
  async dryRun() {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🔍 Starting dry run of tray migration...\n');
      
      const traysCollection = collection(this.db, 'trays');
      const snapshot = await getDocs(traysCollection);
      
      if (snapshot.empty) {
        console.log('No tray documents found.');
        return;
      }
      
      console.log(`Found ${snapshot.size} tray documents.\n`);
      
      // Show first 3 documents as examples
      const examples = [];
      let count = 0;
      
      snapshot.forEach((doc) => {
        if (count < 3) {
          const originalData = doc.data();
          const transformedData = this.transformTrayDocument(originalData, doc.id);
          
          examples.push({
            id: doc.id,
            name: originalData.name || 'Unnamed',
            original: originalData,
            transformed: transformedData,
            changes: this.getChanges(originalData, transformedData)
          });
          count++;
        }
      });
      
      // Display examples
      examples.forEach((example, index) => {
        console.log(`--- Example ${index + 1}: ${example.id} (${example.name}) ---`);
        console.log('📋 Changes that will be made:');
        
        if (example.changes.length === 0) {
          console.log('  ℹ️ No changes needed - already compatible');
        } else {
          example.changes.forEach(change => {
            console.log(`  ✨ ${change}`);
          });
        }
        console.log('');
      });
      
      console.log(`🔍 Dry run completed. ${snapshot.size} documents would be processed.`);
      console.log('💡 Run migration.migrate() to apply changes.');
      
    } catch (error) {
      console.error('💥 Dry run failed:', error);
    }
  }
  
  /**
   * Get list of changes between original and transformed data
   */
  getChanges(original, transformed) {
    const changes = [];
    
    // Check for new tray_id field
    if (!original.tray_id && transformed.tray_id) {
      changes.push(`Add tray_id: "${transformed.tray_id}"`);
    }
    
    // Check field mappings
    Object.entries(this.FIELD_MAPPING).forEach(([oldField, newField]) => {
      if (original[oldField] !== undefined && !original[newField]) {
        changes.push(`Add ${newField}: "${original[oldField]}" (copy of ${oldField})`);
      }
    });
    
    // Check status changes
    if (original.status && this.STATUS_MAPPING[original.status] && 
        original.status !== this.STATUS_MAPPING[original.status]) {
      changes.push(`Update status: "${original.status}" → "${this.STATUS_MAPPING[original.status]}"`);
    }
    
    return changes;
  }
  
  /**
   * Apply migration to all tray documents
   */
  async migrate() {
    try {
      const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
      
      console.log('🚀 Starting tray collection migration to MyRepData format...\n');
      
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
        const originalData = docSnapshot.data();
        
        try {
          console.log(`Processing: ${documentId} (${originalData.name || 'Unnamed'})`);
          
          // Transform the document
          const transformedData = this.transformTrayDocument(originalData, documentId);
          
          // Update the document (merge to keep existing fields)
          const docRef = doc(this.db, 'trays', documentId);
          await setDoc(docRef, transformedData, { merge: true });
          
          console.log(`✅ Successfully migrated: ${documentId}`);
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
      console.log('🔄 Your tray-tracker is now compatible with MyRepData!');
      
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
      
      console.log('🔍 Checking MyRepData compatibility...\n');
      
      const traysCollection = collection(this.db, 'trays');
      const snapshot = await getDocs(traysCollection);
      
      if (snapshot.empty) {
        console.log('No tray documents found.');
        return;
      }
      
      let compatible = 0;
      let needsMigration = 0;
      const issues = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const documentId = docSnapshot.id;
        const docIssues = [];
        
        // Check required MyRepData fields
        if (!data.tray_id) docIssues.push('Missing tray_id field');
        if (!data.created_at && !data.createdAt) docIssues.push('Missing created_at field');
        if (!data.updated_at && !data.lastModified) docIssues.push('Missing updated_at field');
        if (!data.physician_id && !data.surgeon) docIssues.push('Missing physician_id field');
        if (!data.scheduled_date && !data.caseDate) docIssues.push('Missing scheduled_date field');
        if (!data.facility_id && !data.facility) docIssues.push('Missing facility_id field');
        
        // Check status format
        if (data.status && data.status === 'in-use') {
          docIssues.push('Status uses hyphen (in-use) instead of underscore (in_use)');
        }
        
        if (docIssues.length === 0) {
          compatible++;
        } else {
          needsMigration++;
          issues.push({
            id: documentId,
            name: data.name || 'Unnamed',
            issues: docIssues
          });
        }
      });
      
      console.log(`📊 Compatibility Report:`);
      console.log(`Total documents: ${snapshot.size}`);
      console.log(`✅ Already compatible: ${compatible}`);
      console.log(`⚠️ Need migration: ${needsMigration}\n`);
      
      if (issues.length > 0) {
        console.log('🔧 Documents needing migration:');
        issues.slice(0, 5).forEach(issue => { // Show first 5
          console.log(`  📄 ${issue.id} (${issue.name}):`);
          issue.issues.forEach(i => console.log(`    - ${i}`));
        });
        
        if (issues.length > 5) {
          console.log(`  ... and ${issues.length - 5} more documents`);
        }
        
        console.log('\n💡 Run migration.migrate() to fix compatibility issues.');
      }
      
    } catch (error) {
      console.error('💥 Compatibility check failed:', error);
    }
  }
}

// The migration tool is now loaded automatically with the app
// Available functions will be set up in main.js