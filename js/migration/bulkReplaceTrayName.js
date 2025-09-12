// js/migration/bulkReplaceTrayName.js - Script to replace tray.name with tray.tray_name
// This is a one-time migration script to update all frontend references

console.log('🔄 Starting bulk replacement of tray.name → tray.tray_name');

// Files that need tray.name → tray.tray_name replacements
const filesToUpdate = [
    'js/ModalManager.js',
    'js/MapManager.js', 
    'js/DashboardManager.js',
    'js/ViewManager.js',
    'js/DataManager.js',
    'js/SurgeonManager.js',
    'js/CasesManager.js',
    'js/CaseTypeManager.js',
    'js/DemoManager.js',
    'js/utils/DiagnoseTrayIdMismatch.js',
    'js/utils/FirebaseDataDump.js'
];

// Patterns to replace (be careful with order and specificity)
const replacements = [
    // Direct property access
    { from: /tray\.name/g, to: 'tray.tray_name' },
    
    // In template strings and console logs
    { from: /\$\{tray\.name\}/g, to: '${tray.tray_name}' },
    
    // In comparisons
    { from: /tray\.name ===/g, to: 'tray.tray_name ===' },
    { from: /tray\.name ==/g, to: 'tray.tray_name ==' },
    { from: /tray\.name !==/g, to: 'tray.tray_name !==' },
    { from: /tray\.name !=/g, to: 'tray.tray_name !=' },
    
    // In object assignments
    { from: /name: tray\.name/g, to: 'name: tray.tray_name' },
    { from: /trayName: tray\.name/g, to: 'trayName: tray.tray_name' },
    
    // In fallback patterns
    { from: /tray\.name \|\|/g, to: 'tray.tray_name ||' },
    { from: /\|\| tray\.name/g, to: '|| tray.tray_name' },
    
    // In method calls  
    { from: /\.includes\(tray\.name/g, to: '.includes(tray.tray_name' },
    { from: /tray\.name\?\.toLowerCase/g, to: 'tray.tray_name?.toLowerCase' }
];

console.log('📋 Files to update:', filesToUpdate.length);
console.log('🔄 Replacement patterns:', replacements.length);

// This would be the actual replacement logic if running in Node.js
// For now, this serves as documentation of what needs to be replaced

const manualReplacements = {
    'js/ModalManager.js': [
        'Line 335: <h6><i class="fas fa-box"></i> ${tray.name}</h6>',
        'Line 1369: data-tray-name="${tray.name}"',  
        'Line 1370: ${tray.name} (${this.getTrayTypeDisplayName(tray)})'
    ],
    
    'js/MapManager.js': [
        'Line 51: !tray.name?.toLowerCase().includes(searchTerm)',
        'Line 100: <h6>${tray.name}</h6>',
        'Line 326: !tray.name?.toLowerCase().includes(searchTerm)',
        'Multiple console.log statements with tray.name',
        'Line 446: <h6 class="popup-title">${tray.name}</h6>',
        'Line 461: console.warn with tray.name'
    ],
    
    'js/DataManager.js': [
        'Line 297-298: tray.name usage in nameCounts',
        'Line 431: trayName: tray.name',
        'Line 443: trayName: tray.name',
        'Line 545: console.log with tray.name'
    ]
    
    // ... and so on for other files
};

console.log('📝 Manual replacements needed by file:', Object.keys(manualReplacements).length);
console.log('Run this in browser console after loading the app to check which files still have tray.name references');

export { filesToUpdate, replacements, manualReplacements };