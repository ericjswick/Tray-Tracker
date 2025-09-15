// js/utils/FacilityDiagnostics.js - Comprehensive facility debugging utility

export class FacilityDiagnostics {
    constructor() {
        // Make this globally accessible for console use
        window.diagnoseFacilities = this.runDiagnostics.bind(this);
        window.fixFacilityDisplay = this.fixFacilityDisplay.bind(this);
    }

    async runDiagnostics() {
        console.log('🏥 === FACILITY DIAGNOSTICS REPORT ===');
        
        const report = {
            timestamp: new Date().toISOString(),
            dataManagers: this.checkDataManagers(),
            facilityData: this.checkFacilityData(),
            caseData: this.checkCaseData(),
            modalState: this.checkModalState(),
            recommendations: []
        };

        // Check data consistency
        this.checkDataConsistency(report);
        
        // Generate recommendations
        this.generateRecommendations(report);
        
        console.log('📊 Full Diagnostics Report:', report);
        return report;
    }

    checkDataManagers() {
        return {
            hasApp: !!window.app,
            hasDataManager: !!window.app?.dataManager,
            hasFacilityManager: !!window.app?.facilityManager,
            hasModalManager: !!window.app?.modalManager,
            hasCasesManager: !!window.app?.casesManager
        };
    }

    checkFacilityData() {
        const facilityData = {
            fromDataManager: null,
            fromFacilityManager: null,
            dataManagerCount: 0,
            facilityManagerCount: 0,
            dataManagerFacilities: [],
            facilityManagerFacilities: []
        };

        // Check DataManager facilities
        try {
            if (window.app?.dataManager?.getFacilities) {
                const dmFacilities = window.app.dataManager.getFacilities();
                facilityData.fromDataManager = !!dmFacilities;
                facilityData.dataManagerCount = dmFacilities?.length || 0;
                facilityData.dataManagerFacilities = dmFacilities?.map(f => ({
                    id: f.id,
                    name: f.account_name || f.name || 'NO_NAME',
                    hasAccountName: !!f.account_name,
                    hasName: !!f.name
                })) || [];
            }
        } catch (error) {
            facilityData.dataManagerError = error.message;
        }

        // Check FacilityManager facilities
        try {
            if (window.app?.facilityManager?.currentFacilities) {
                const fmFacilities = window.app.facilityManager.currentFacilities;
                facilityData.fromFacilityManager = !!fmFacilities;
                facilityData.facilityManagerCount = fmFacilities?.length || 0;
                facilityData.facilityManagerFacilities = fmFacilities?.map(f => ({
                    id: f.id,
                    name: f.account_name || f.name || 'NO_NAME',
                    hasAccountName: !!f.account_name,
                    hasName: !!f.name
                })) || [];
            }
        } catch (error) {
            facilityData.facilityManagerError = error.message;
        }

        return facilityData;
    }

    checkCaseData() {
        const caseData = {
            hasCases: false,
            caseCount: 0,
            casesWithFacilities: [],
            uniqueFacilityIds: []
        };

        try {
            let cases = [];
            
            // Try to get cases from multiple sources
            if (window.app?.casesManager?.currentCases) {
                cases = window.app.casesManager.currentCases;
            } else if (window.app?.dataManager?.getAllCases) {
                cases = window.app.dataManager.getAllCases() || [];
            }

            caseData.hasCases = cases.length > 0;
            caseData.caseCount = cases.length;
            
            const facilityIds = new Set();
            
            cases.forEach(caseItem => {
                if (caseItem.facility_id) {
                    facilityIds.add(caseItem.facility_id);
                    caseData.casesWithFacilities.push({
                        caseId: caseItem.id,
                        patientName: caseItem.patientName,
                        facilityId: caseItem.facility_id,
                        facilityField: caseItem.facility
                    });
                }
            });
            
            caseData.uniqueFacilityIds = Array.from(facilityIds);
            
        } catch (error) {
            caseData.error = error.message;
        }

        return caseData;
    }

    checkModalState() {
        const modalState = {
            checkinModalExists: !!document.getElementById('checkinModal'),
            checkinCaseSelectExists: !!document.getElementById('checkinCaseSelect'),
            modalManagerMethods: []
        };

        if (window.app?.modalManager) {
            modalState.modalManagerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(window.app.modalManager))
                .filter(method => typeof window.app.modalManager[method] === 'function');
        }

        return modalState;
    }

    checkDataConsistency(report) {
        const { facilityData, caseData } = report;
        
        // Check if facility IDs in cases match available facilities
        const dmFacilityIds = facilityData.dataManagerFacilities.map(f => f.id);
        const fmFacilityIds = facilityData.facilityManagerFacilities.map(f => f.id);
        const caseFacilityIds = caseData.uniqueFacilityIds;
        
        const missingInDM = caseFacilityIds.filter(id => !dmFacilityIds.includes(id));
        const missingInFM = caseFacilityIds.filter(id => !fmFacilityIds.includes(id));
        
        report.dataConsistency = {
            dmFacilityIds,
            fmFacilityIds,
            caseFacilityIds,
            missingInDataManager: missingInDM,
            missingInFacilityManager: missingInFM,
            dataManagerHasAll: missingInDM.length === 0,
            facilityManagerHasAll: missingInFM.length === 0
        };
    }

    generateRecommendations(report) {
        const { dataManagers, facilityData, dataConsistency, caseData } = report;
        const recommendations = [];

        if (!dataManagers.hasApp) {
            recommendations.push("❌ App not loaded - refresh the page");
        }

        if (!dataManagers.hasFacilityManager) {
            recommendations.push("⚠️ FacilityManager not available");
        }

        if (facilityData.dataManagerCount === 0 && facilityData.facilityManagerCount === 0) {
            recommendations.push("🚨 No facilities found in either data source - add facilities first");
        }

        if (facilityData.dataManagerCount !== facilityData.facilityManagerCount) {
            recommendations.push(`⚠️ Data inconsistency: DataManager has ${facilityData.dataManagerCount} facilities, FacilityManager has ${facilityData.facilityManagerCount}`);
        }

        if (dataConsistency?.missingInDataManager?.length > 0) {
            recommendations.push(`❌ Cases reference ${dataConsistency.missingInDataManager.length} facility IDs not found in DataManager: ${dataConsistency.missingInDataManager.join(', ')}`);
        }

        if (dataConsistency?.missingInFacilityManager?.length > 0) {
            recommendations.push(`❌ Cases reference ${dataConsistency.missingInFacilityManager.length} facility IDs not found in FacilityManager: ${dataConsistency.missingInFacilityManager.join(', ')}`);
        }

        if (caseData.caseCount === 0) {
            recommendations.push("ℹ️ No cases found - create some cases to test facility display");
        }

        report.recommendations = recommendations;
    }

    async fixFacilityDisplay() {
        console.log('🔧 Attempting to fix facility display issues...');
        
        const report = await this.runDiagnostics();
        
        if (report.recommendations.length === 0) {
            console.log('✅ No issues detected, facility display should be working');
            return;
        }

        // Try to sync facility data
        if (window.app?.facilityManager?.loadFacilities) {
            console.log('🔄 Reloading facilities from FacilityManager...');
            try {
                await window.app.facilityManager.loadFacilities();
                console.log('✅ FacilityManager facilities reloaded');
            } catch (error) {
                console.error('❌ Failed to reload FacilityManager facilities:', error);
            }
        }

        // Try to refresh modal dropdown if open
        if (document.getElementById('checkinModal')?.classList.contains('show')) {
            console.log('🔄 Refreshing check-in modal...');
            if (window.app?.modalManager?.openCheckinModal) {
                // Re-open modal to refresh dropdown
                const trayId = document.getElementById('checkinTrayId')?.value;
                if (trayId) {
                    window.app.modalManager.openCheckinModal(trayId);
                }
            }
        }

        // Try to refresh case cards
        if (window.app?.casesManager?.renderCases) {
            console.log('🔄 Refreshing case cards...');
            try {
                const cases = window.app.casesManager.currentCases || [];
                window.app.casesManager.renderCases(cases);
                console.log('✅ Case cards refreshed');
            } catch (error) {
                console.error('❌ Failed to refresh case cards:', error);
            }
        }

        console.log('🔧 Fix attempt completed. Check if facility names now display correctly.');
    }
}

// Initialize diagnostics
new FacilityDiagnostics();