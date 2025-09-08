const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../config/firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Migration script to update tray collection fields to match MyRepData naming conventions
 * This will rename fields from camelCase to snake_case and update status values
 */

// Field mapping - ONLY change fields that MyRepData actually uses
const FIELD_MAPPING = {
  // Only rename fields that MyRepData needs for compatibility
  'createdAt': 'created_at',
  'lastModified': 'updated_at', 
  'surgeon': 'physician_id',
  'caseDate': 'scheduled_date',
  'facility': 'facility_id'
  
  // Keep all other fields as-is (name, type, location, notes, assignedTo, photo URLs, etc.)
  // They don't conflict with MyRepData so no need to change them
};

// Status mapping from tray-tracker to MyRepData format
const STATUS_MAPPING = {
  'available': 'available',
  'in-use': 'in_use',  // Change hyphen to underscore
  'corporate': 'cleaning', // Map corporate to cleaning
  'trunk': 'maintenance'   // Map trunk to maintenance
};

/**
 * Transform a single tray document from tray-tracker format to MyRepData format
 */
function transformTrayDocument(trayData, documentId) {
  const transformed = {};
  
  // Add tray_id field (using document ID)
  transformed.tray_id = documentId;
  
  // Transform all fields according to mapping
  Object.entries(trayData).forEach(([oldField, value]) => {
    const newField = FIELD_MAPPING[oldField];
    
    if (newField) {
      // Special handling for status field
      if (oldField === 'status' && value && STATUS_MAPPING[value]) {
        transformed.status = STATUS_MAPPING[value];
      }
      // Handle timestamp fields
      else if ((oldField === 'createdAt' || oldField === 'lastModified') && value) {
        // Keep Firebase timestamps as-is, just rename field
        transformed[newField] = value;
      }
      // Handle all other fields
      else {
        transformed[newField] = value;
      }
    } else {
      // Keep unmapped fields as-is (for backward compatibility)
      transformed[oldField] = value;
    }
  });
  
  return transformed;
}

/**
 * Migrate a single tray document
 */
async function migrateTrayDocument(doc) {
  const documentId = doc.id;
  const trayData = doc.data();
  
  console.log(`Migrating tray: ${documentId} (${trayData.name || 'Unnamed'})`);
  
  // Transform the document
  const transformedData = transformTrayDocument(trayData, documentId);
  
  // Update the document with transformed data
  try {
    await db.collection('trays').doc(documentId).set(transformedData, { merge: true });
    console.log(`✅ Successfully migrated tray: ${documentId}`);
    return { success: true, id: documentId };
  } catch (error) {
    console.error(`❌ Failed to migrate tray ${documentId}:`, error);
    return { success: false, id: documentId, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrateAllTrays() {
  console.log('🚀 Starting tray collection migration to MyRepData format...\n');
  
  try {
    // Get all tray documents
    const traysSnapshot = await db.collection('trays').get();
    
    if (traysSnapshot.empty) {
      console.log('No tray documents found to migrate.');
      return;
    }
    
    console.log(`Found ${traysSnapshot.size} tray documents to migrate.\n`);
    
    // Track migration results
    const results = {
      total: traysSnapshot.size,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    // Migrate each document
    for (const doc of traysSnapshot.docs) {
      const result = await migrateTrayDocument(doc);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          id: result.id,
          error: result.error
        });
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Print migration summary
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
    
  } catch (error) {
    console.error('💥 Migration failed with error:', error);
  }
}

/**
 * Rollback function to restore original field names (if needed)
 */
async function rollbackMigration() {
  console.log('🔄 Starting rollback of tray collection migration...\n');
  
  // Reverse field mapping
  const REVERSE_MAPPING = {};
  Object.entries(FIELD_MAPPING).forEach(([oldField, newField]) => {
    REVERSE_MAPPING[newField] = oldField;
  });
  
  // Reverse status mapping
  const REVERSE_STATUS_MAPPING = {};
  Object.entries(STATUS_MAPPING).forEach(([oldStatus, newStatus]) => {
    REVERSE_STATUS_MAPPING[newStatus] = oldStatus;
  });
  
  try {
    const traysSnapshot = await db.collection('trays').get();
    
    for (const doc of traysSnapshot.docs) {
      const documentId = doc.id;
      const trayData = doc.data();
      
      console.log(`Rolling back tray: ${documentId}`);
      
      const rolledBackData = {};
      
      Object.entries(trayData).forEach(([currentField, value]) => {
        const originalField = REVERSE_MAPPING[currentField];
        
        if (originalField) {
          if (currentField === 'status' && REVERSE_STATUS_MAPPING[value]) {
            rolledBackData[originalField] = REVERSE_STATUS_MAPPING[value];
          } else {
            rolledBackData[originalField] = value;
          }
        } else if (currentField !== 'tray_id') { // Don't include tray_id in rollback
          rolledBackData[currentField] = value;
        }
      });
      
      await db.collection('trays').doc(documentId).set(rolledBackData, { merge: true });
      console.log(`✅ Rolled back tray: ${documentId}`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n✅ Rollback completed!');
    
  } catch (error) {
    console.error('💥 Rollback failed with error:', error);
  }
}

/**
 * Dry run function to preview changes without applying them
 */
async function dryRunMigration() {
  console.log('🔍 Starting dry run of tray collection migration...\n');
  
  try {
    const traysSnapshot = await db.collection('trays').get();
    
    if (traysSnapshot.empty) {
      console.log('No tray documents found.');
      return;
    }
    
    console.log(`Found ${traysSnapshot.size} tray documents.\n`);
    
    // Show first 3 documents as examples
    const exampleDocs = traysSnapshot.docs.slice(0, 3);
    
    exampleDocs.forEach((doc, index) => {
      const documentId = doc.id;
      const originalData = doc.data();
      const transformedData = transformTrayDocument(originalData, documentId);
      
      console.log(`--- Example ${index + 1}: ${documentId} ---`);
      console.log('BEFORE:');
      console.log(JSON.stringify(originalData, null, 2));
      console.log('\nAFTER:');
      console.log(JSON.stringify(transformedData, null, 2));
      console.log('\n');
    });
    
    console.log('🔍 Dry run completed. Review the changes above.');
    console.log('Run migrateAllTrays() to apply the migration.');
    
  } catch (error) {
    console.error('💥 Dry run failed with error:', error);
  }
}

// Export functions for use
module.exports = {
  migrateAllTrays,
  rollbackMigration,
  dryRunMigration,
  transformTrayDocument
};

// If run directly, execute based on command line argument
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      migrateAllTrays();
      break;
    case 'rollback':
      rollbackMigration();
      break;
    case 'dry-run':
    default:
      dryRunMigration();
      break;
  }
}