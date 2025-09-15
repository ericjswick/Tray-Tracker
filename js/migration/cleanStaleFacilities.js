// js/migration/cleanStaleFacilities.js - Clean up stale facility references
import { FacilityDataCleaner } from '../utils/FacilityDataCleaner.js';

export class StaleFacilityCleaner {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.cleaner = new FacilityDataCleaner(dataManager);
    }

    async runCleanup() {
        console.log('🧹 Starting stale facility cleanup...');
        
        try {
            // Step 1: Audit current state
            const auditReport = await this.cleaner.auditStaleReferences();
            
            if (auditReport.staleTrays === 0 && auditReport.staleCases === 0) {
                console.log('✅ No stale facility references found!');
                return {
                    success: true,
                    message: 'No cleanup needed',
                    report: auditReport
                };
            }
            
            console.log(`⚠️ Found ${auditReport.staleTrays} trays and ${auditReport.staleCases} cases with stale facility references`);
            
            // Step 2: Get available facilities for mapping
            const facilities = this.dataManager.getFacilities();
            console.log('📋 Available facilities:');
            facilities.forEach((facility, index) => {
                console.log(`  ${index + 1}. ${facility.account_name || facility.name} (ID: ${facility.id})`);
            });
            
            // Step 3: Auto-cleanup strategy
            const results = [];
            
            // Group stale references by facility ID
            const staleIds = [...new Set([
                ...auditReport.staleTraysDetails.map(t => t.staleFacilityId),
                ...auditReport.staleCasesDetails.map(c => c.staleFacilityId)
            ])];
            
            for (const staleId of staleIds) {
                console.log(`🔧 Processing stale facility ID: ${staleId}`);
                
                if (facilities.length > 0) {
                    // Map to first available facility as default
                    const defaultFacility = facilities[0];
                    const result = await this.cleaner.fixStaleReferences(staleId, defaultFacility.id);
                    results.push(result);
                } else {
                    // No facilities available, remove references
                    const result = await this.cleaner.removeOrphanedReferences(staleId);
                    results.push(result);
                }
            }
            
            // Step 4: Final audit
            const finalAudit = await this.cleaner.auditStaleReferences();
            
            const summary = {
                success: true,
                message: 'Stale facility cleanup completed',
                initialReport: auditReport,
                cleanupResults: results,
                finalReport: finalAudit,
                totalFixed: results.reduce((sum, r) => sum + (r.updatedTrays || 0) + (r.updatedCases || 0), 0)
            };
            
            console.log('✅ Cleanup Summary:', summary);
            return summary;
            
        } catch (error) {
            console.error('❌ Error during stale facility cleanup:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Method to run cleanup for a specific stale facility ID
    async cleanupSpecificFacility(staleFacilityId, action = 'fix', targetFacilityId = null) {
        console.log(`🎯 Cleaning up specific facility: ${staleFacilityId}`);
        
        try {
            let result;
            
            if (action === 'fix' && targetFacilityId) {
                result = await this.cleaner.fixStaleReferences(staleFacilityId, targetFacilityId);
            } else if (action === 'remove') {
                result = await this.cleaner.removeOrphanedReferences(staleFacilityId);
            } else {
                throw new Error('Invalid action or missing targetFacilityId for fix action');
            }
            
            return {
                success: true,
                result
            };
            
        } catch (error) {
            console.error('❌ Error cleaning specific facility:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Global utility function for easy access from console
window.cleanStaleFacilities = async function() {
    if (!window.app || !window.app.dataManager) {
        console.error('❌ DataManager not available');
        return;
    }
    
    const cleaner = new StaleFacilityCleaner(window.app.dataManager);
    return await cleaner.runCleanup();
};

// Quick fix for the specific stale facility ID we found
window.fixStaleFacility = async function(staleFacilityId = 'SPJmXEr39rr6iVO9cFhi', targetFacilityId = 'tkMrsfXHy1IxxIewms6L') {
    if (!window.app || !window.app.dataManager) {
        console.error('❌ DataManager not available');
        return;
    }
    
    const cleaner = new StaleFacilityCleaner(window.app.dataManager);
    return await cleaner.cleanupSpecificFacility(staleFacilityId, 'fix', targetFacilityId);
};