// js/utils/FacilityDataCleaner.js - Utility to clean up stale facility references

export class FacilityDataCleaner {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Find and report stale facility references
     */
    async auditStaleReferences() {
        console.log('🔍 Starting facility reference audit...');
        
        try {
            // Get current valid facilities
            const facilities = this.dataManager.getFacilities();
            const validFacilityIds = facilities.map(f => f.id);
            
            console.log('✅ Valid facility IDs:', validFacilityIds);
            
            // Check trays for invalid facility references
            const trays = this.dataManager.getTrays();
            const staleTrays = [];
            
            trays.forEach(tray => {
                const facilityId = tray.facility_id || tray.facility;
                if (facilityId && !validFacilityIds.includes(facilityId)) {
                    staleTrays.push({
                        trayId: tray.id,
                        trayName: tray.tray_name || tray.name,
                        staleFacilityId: facilityId,
                        status: tray.status
                    });
                }
            });
            
            // Check cases for invalid facility references
            const cases = this.dataManager.getCases();
            const staleCases = [];
            
            cases.forEach(caseItem => {
                const facilityId = caseItem.facility_id || caseItem.facility;
                if (facilityId && !validFacilityIds.includes(facilityId)) {
                    staleCases.push({
                        caseId: caseItem.id,
                        caseName: caseItem.case_name || caseItem.id,
                        staleFacilityId: facilityId,
                        scheduledDate: caseItem.scheduledDate
                    });
                }
            });
            
            const report = {
                validFacilities: validFacilityIds.length,
                staleTrays: staleTrays.length,
                staleCases: staleCases.length,
                staleTraysDetails: staleTrays,
                staleCasesDetails: staleCases
            };
            
            console.log('📊 Facility Audit Report:', report);
            return report;
            
        } catch (error) {
            console.error('❌ Error during facility audit:', error);
            throw error;
        }
    }

    /**
     * Fix stale facility references by mapping to closest valid facility
     */
    async fixStaleReferences(staleFacilityId, newFacilityId) {
        console.log(`🔧 Fixing stale facility ${staleFacilityId} -> ${newFacilityId}`);
        
        try {
            const facilities = this.dataManager.getFacilities();
            const newFacility = facilities.find(f => f.id === newFacilityId);
            
            if (!newFacility) {
                throw new Error(`New facility ID ${newFacilityId} not found`);
            }
            
            let updatedTrays = 0;
            let updatedCases = 0;
            
            // Fix trays
            const trays = this.dataManager.getTrays();
            for (const tray of trays) {
                const facilityId = tray.facility_id || tray.facility;
                if (facilityId === staleFacilityId) {
                    const updates = {
                        facility_id: newFacilityId,
                        facility: newFacilityId, // Keep legacy field for backward compatibility
                        lastModified: new Date().toISOString(),
                        modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
                    };
                    
                    await this.dataManager.updateTray(tray.id, updates);
                    await this.dataManager.addHistoryEntry(
                        tray.id,
                        'facility-updated',
                        `Facility reference updated from stale ID to ${newFacility.account_name || newFacility.name}`,
                        null
                    );
                    updatedTrays++;
                }
            }
            
            // Fix cases
            const cases = this.dataManager.getCases();
            for (const caseItem of cases) {
                const facilityId = caseItem.facility_id || caseItem.facility;
                if (facilityId === staleFacilityId) {
                    const updates = {
                        facility_id: newFacilityId,
                        facility: newFacilityId, // Keep legacy field
                        lastModified: new Date().toISOString(),
                        modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
                    };
                    
                    await this.dataManager.updateCase(caseItem.id, updates);
                    updatedCases++;
                }
            }
            
            const result = {
                staleFacilityId,
                newFacilityId,
                newFacilityName: newFacility.account_name || newFacility.name,
                updatedTrays,
                updatedCases
            };
            
            console.log('✅ Fixed facility references:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Error fixing facility references:', error);
            throw error;
        }
    }

    /**
     * Remove orphaned facility references (set to null/empty)
     */
    async removeOrphanedReferences(staleFacilityId) {
        console.log(`🗑️ Removing orphaned facility references: ${staleFacilityId}`);
        
        try {
            let updatedTrays = 0;
            let updatedCases = 0;
            
            // Clean trays
            const trays = this.dataManager.getTrays();
            for (const tray of trays) {
                const facilityId = tray.facility_id || tray.facility;
                if (facilityId === staleFacilityId) {
                    const updates = {
                        facility_id: '',
                        facility: '',
                        lastModified: new Date().toISOString(),
                        modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
                    };
                    
                    await this.dataManager.updateTray(tray.id, updates);
                    await this.dataManager.addHistoryEntry(
                        tray.id,
                        'facility-removed',
                        `Removed orphaned facility reference (${staleFacilityId.substring(0, 8)}...)`,
                        null
                    );
                    updatedTrays++;
                }
            }
            
            // Clean cases  
            const cases = this.dataManager.getCases();
            for (const caseItem of cases) {
                const facilityId = caseItem.facility_id || caseItem.facility;
                if (facilityId === staleFacilityId) {
                    const updates = {
                        facility_id: '',
                        facility: '',
                        lastModified: new Date().toISOString(),
                        modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
                    };
                    
                    await this.dataManager.updateCase(caseItem.id, updates);
                    updatedCases++;
                }
            }
            
            const result = {
                staleFacilityId,
                updatedTrays,
                updatedCases
            };
            
            console.log('✅ Removed orphaned references:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Error removing orphaned references:', error);
            throw error;
        }
    }
}