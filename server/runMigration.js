#!/usr/bin/env node

const { migrateAllTrays, rollbackMigration, dryRunMigration } = require('./migrations/migrateTrayFields');

console.log('🔧 Tray Collection Migration Tool\n');
console.log('This will add MyRepData compatible fields to your tray collection:');
console.log('- Add tray_id field');  
console.log('- Add created_at, updated_at, physician_id, scheduled_date, facility_id fields');
console.log('- Update status values: "in-use" → "in_use", "corporate" → "cleaning", "trunk" → "maintenance"');
console.log('- Keep all existing tray-tracker fields unchanged\n');

const command = process.argv[2];

switch (command) {
  case 'migrate':
    console.log('🚀 Starting migration...\n');
    migrateAllTrays();
    break;
    
  case 'rollback':
    console.log('🔄 Starting rollback...\n');
    rollbackMigration();
    break;
    
  case 'dry-run':
  default:
    console.log('🔍 Starting dry run (preview changes)...\n');
    dryRunMigration();
    console.log('\n📋 Available commands:');
    console.log('  node runMigration.js dry-run  - Preview changes');
    console.log('  node runMigration.js migrate  - Apply migration');
    console.log('  node runMigration.js rollback - Undo migration');
    break;
}