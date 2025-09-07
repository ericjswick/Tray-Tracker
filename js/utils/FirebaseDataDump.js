/**
 * Firebase Data Dump Utility
 * Run in browser console after logging in to dump all Firebase collections to JSON files
 */

export class FirebaseDataDump {
    constructor() {
        this.collections = [
            'surgical_cases',
            'tray_tracking', 
            'case_types',
            'surgeons',
            'facilities',
            'users'
        ];
    }

    async dumpAllData() {
        console.log('🚀 Starting Firebase data dump...');
        
        if (!window.app || !window.app.dataManager) {
            console.error('❌ App not loaded. Please log in first and ensure window.app.dataManager is available.');
            return;
        }

        const allData = {
            timestamp: new Date().toISOString(),
            dump_info: {
                user: window.app.authManager?.getCurrentUser()?.email || 'unknown',
                collections_dumped: this.collections.length,
                dump_reason: 'Debug tray_id mismatch analysis'
            },
            collections: {}
        };

        // Dump each collection
        for (const collectionName of this.collections) {
            try {
                console.log(`📥 Dumping collection: ${collectionName}`);
                const data = await this.dumpCollection(collectionName);
                allData.collections[collectionName] = {
                    count: Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0),
                    data: data
                };
                console.log(`✅ ${collectionName}: ${allData.collections[collectionName].count} items`);
            } catch (error) {
                console.error(`❌ Failed to dump ${collectionName}:`, error);
                allData.collections[collectionName] = {
                    error: error.message,
                    count: 0,
                    data: []
                };
            }
        }

        // Send full data dump to debug log API
        try {
            console.log('📤 Sending data dump to debug API...');
            
            // Log the complete data dump to debug API
            await fetch('/api/debug/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    level: 'info',
                    message: '🗂️ FIREBASE DATA DUMP COMPLETE',
                    data: allData, // Send the complete dump
                    context: 'firebase-data-dump'
                })
            });

            console.log('🎉 Data dump complete! Check debug logs for full Firebase data.');
            return allData;

        } catch (error) {
            console.error('❌ Failed to send data dump to API:', error);
            return allData;
        }
    }

    async dumpCollection(collectionName) {
        const dm = window.app.dataManager;

        switch (collectionName) {
            case 'surgical_cases':
                return await dm.getAllCases();
            
            case 'tray_tracking':
                return await dm.getAllTrays();
            
            case 'case_types':
                return dm.getCaseTypes(); // Usually cached
            
            case 'surgeons':
                return dm.getSurgeons(); // Usually cached
            
            case 'facilities':
                return dm.getFacilities(); // Usually cached
            
            case 'users':
                // Users collection might need special handling
                try {
                    return await dm.getAllUsers?.() || [];
                } catch (error) {
                    console.warn(`⚠️ Could not dump users collection: ${error.message}`);
                    return [];
                }
            
            default:
                console.warn(`⚠️ Unknown collection: ${collectionName}`);
                return [];
        }
    }

    // Analyze tray_id mismatches specifically
    analyzeTrayIdMismatches(dumpData) {
        if (!dumpData?.collections) {
            console.error('❌ Invalid dump data provided');
            return;
        }

        console.log('🔍 ANALYZING TRAY_ID MISMATCHES...\n');

        const cases = dumpData.collections.surgical_cases?.data || [];
        const trays = dumpData.collections.tray_tracking?.data || [];

        // Extract all required tray_ids from cases
        const requiredTrayIds = new Set();
        const casesWithTrayReqs = [];

        cases.forEach(caseItem => {
            if (caseItem.tray_requirements && Array.isArray(caseItem.tray_requirements)) {
                casesWithTrayReqs.push(caseItem);
                caseItem.tray_requirements.forEach(req => {
                    if (req.tray_id) {
                        requiredTrayIds.add(req.tray_id);
                    }
                });
            }
        });

        // Extract all available tray_ids from trays
        const availableTrayIds = new Set();
        const trayIdToInfo = {};

        trays.forEach(tray => {
            if (tray.tray_id) {
                availableTrayIds.add(tray.tray_id);
                trayIdToInfo[tray.tray_id] = { name: tray.name, id: tray.id };
            }
            if (tray.id) {
                availableTrayIds.add(tray.id);
                trayIdToInfo[tray.id] = { name: tray.name, tray_id: tray.tray_id };
            }
        });

        // Find matches and mismatches
        const matchingIds = [...requiredTrayIds].filter(id => availableTrayIds.has(id));
        const missingIds = [...requiredTrayIds].filter(id => !availableTrayIds.has(id));

        console.log('📊 MISMATCH ANALYSIS RESULTS:');
        console.log(`Total Cases: ${cases.length}`);
        console.log(`Cases with Tray Requirements: ${casesWithTrayReqs.length}`);
        console.log(`Total Trays: ${trays.length}`);
        console.log(`Unique Required Tray IDs: ${requiredTrayIds.size}`);
        console.log(`Unique Available Tray IDs: ${availableTrayIds.size}`);
        console.log(`Matching Tray IDs: ${matchingIds.length}`);
        console.log(`Missing Tray IDs: ${missingIds.length}`);
        console.log(`Match Success Rate: ${requiredTrayIds.size > 0 ? ((matchingIds.length / requiredTrayIds.size) * 100).toFixed(1) + '%' : '0%'}\n`);

        if (missingIds.length > 0) {
            console.log('❌ MISSING TRAY IDs:');
            missingIds.forEach(id => console.log(`  - ${id}`));
            console.log('');
        }

        if (matchingIds.length > 0) {
            console.log('✅ MATCHING TRAY IDs:');
            matchingIds.slice(0, 10).forEach(id => {
                const info = trayIdToInfo[id];
                console.log(`  - ${id}: ${info?.name || 'Unknown'}`);
            });
            if (matchingIds.length > 10) {
                console.log(`  ... and ${matchingIds.length - 10} more`);
            }
        }

        return {
            summary: {
                totalCases: cases.length,
                casesWithTrayReqs: casesWithTrayReqs.length,
                totalTrays: trays.length,
                requiredTrayIds: requiredTrayIds.size,
                availableTrayIds: availableTrayIds.size,
                matches: matchingIds.length,
                mismatches: missingIds.length,
                successRate: requiredTrayIds.size > 0 ? ((matchingIds.length / requiredTrayIds.size) * 100).toFixed(1) + '%' : '0%'
            },
            missingIds,
            matchingIds,
            casesAffected: casesWithTrayReqs.filter(c => 
                c.tray_requirements.some(req => missingIds.includes(req.tray_id))
            )
        };
    }
}

// Make functions available globally for console use
window.dumpFirebaseData = async () => {
    const dumper = new FirebaseDataDump();
    const result = await dumper.dumpAllData();
    
    // Auto-analyze after dump
    if (result && result.collections) {
        console.log('\n' + '='.repeat(50));
        dumper.analyzeTrayIdMismatches(result);
    }
    
    return result;
};

window.analyzeTrayIdMismatches = (dumpData) => {
    const dumper = new FirebaseDataDump();
    return dumper.analyzeTrayIdMismatches(dumpData);
};

console.log('🔧 Firebase Data Dump utility loaded!');
console.log('📝 Usage:');
console.log('  window.dumpFirebaseData() - Dump all data to JSON file');
console.log('  window.analyzeTrayIdMismatches(data) - Analyze specific dump data');