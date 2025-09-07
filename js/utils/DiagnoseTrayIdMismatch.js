// Diagnostic utility to find tray_id mismatches between surgical_cases and tray_tracking
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class DiagnoseTrayIdMismatch {
    constructor(db) {
        this.db = db;
    }

    async runDiagnosis() {
        console.log('🔍 DIAGNOSIS: Starting tray_id mismatch analysis...');
        
        try {
            // Get all surgical cases
            const casesSnapshot = await getDocs(collection(this.db, 'surgical_cases'));
            const cases = [];
            casesSnapshot.forEach((doc) => {
                cases.push({ id: doc.id, ...doc.data() });
            });

            // Get all trays
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            const trays = [];
            traysSnapshot.forEach((doc) => {
                trays.push({ id: doc.id, ...doc.data() });
            });

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

            // Extract all available tray_ids from tray_tracking
            const availableTrayIds = new Set();
            const trayIdToName = {};
            
            trays.forEach(tray => {
                // Check both tray_id field and Firebase document id
                if (tray.tray_id) {
                    availableTrayIds.add(tray.tray_id);
                    trayIdToName[tray.tray_id] = tray.name;
                }
                if (tray.id) {
                    availableTrayIds.add(tray.id);
                    trayIdToName[tray.id] = tray.name;
                }
            });

            // Find matches and mismatches
            const matchingIds = [...requiredTrayIds].filter(id => availableTrayIds.has(id));
            const missingIds = [...requiredTrayIds].filter(id => !availableTrayIds.has(id));

            const diagnosisResult = {
                summary: {
                    totalCases: cases.length,
                    casesWithTrayRequirements: casesWithTrayReqs.length,
                    totalTrays: trays.length,
                    uniqueRequiredTrayIds: requiredTrayIds.size,
                    uniqueAvailableTrayIds: availableTrayIds.size,
                    matchingTrayIds: matchingIds.length,
                    missingTrayIds: missingIds.length,
                    matchSuccessRate: requiredTrayIds.size > 0 ? 
                        ((matchingIds.length / requiredTrayIds.size) * 100).toFixed(1) + '%' : '0%'
                },
                details: {
                    requiredTrayIds: [...requiredTrayIds],
                    availableTrayIds: [...availableTrayIds].slice(0, 20), // First 20
                    matchingIds,
                    missingIds,
                    matchedTrays: matchingIds.map(id => ({ id, name: trayIdToName[id] })),
                    casesAffected: casesWithTrayReqs.filter(c => 
                        c.tray_requirements.some(req => missingIds.includes(req.tray_id))
                    ).length
                },
                recommendations: []
            };

            // Generate recommendations
            if (missingIds.length > 0) {
                diagnosisResult.recommendations.push(
                    `${missingIds.length} tray_id mismatches found - required IDs not in tray_tracking collection`
                );
                
                if (missingIds.some(id => id.startsWith('TRAY_'))) {
                    diagnosisResult.recommendations.push(
                        'Pattern detected: Case requirements use TRAY_XXX format but trays use Firebase document IDs'
                    );
                }
            }

            if (trays.some(t => !t.tray_id)) {
                diagnosisResult.recommendations.push(
                    'Some trays missing tray_id field - run FixTrayIdMigration'
                );
            }

            console.log('🔍 DIAGNOSIS COMPLETE:', diagnosisResult);
            
            // Log to debug API
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('🔍 DIAGNOSIS: Tray ID Mismatch Analysis', diagnosisResult, 'tray-id-diagnosis');
            }

            return diagnosisResult;

        } catch (error) {
            console.error('❌ Diagnosis failed:', error);
            return { error };
        }
    }
}

// Function to run diagnosis manually from console
window.diagnoseTrayIdMismatch = async () => {
    if (!window.app || !window.app.dataManager) {
        console.error('❌ App not loaded yet');
        return;
    }
    
    const diagnosis = new DiagnoseTrayIdMismatch(window.app.dataManager.db);
    return await diagnosis.runDiagnosis();
};