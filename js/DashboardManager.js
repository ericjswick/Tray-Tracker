/**
 * Dashboard Manager - Handles dashboard functionality including upcoming cases
 */
import { CASE_STATUS, CASE_STATUS_OPTIONS, getCaseStatusClass, populateCaseStatusDropdown } from './constants/CaseStatus.js';
import { TRAY_STATUS, normalizeStatus, isInUseStatus, isAvailableStatus, isCheckedInStatus, getStatusDisplayText } from './constants/TrayStatus.js';

export class DashboardManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentCases = [];
        this.dateFilter = 'week';
        this.statusFilter = '';
        
        this.bindEvents();
    }

    bindEvents() {
        // Date filter change handler
        const dateFilterSelect = document.getElementById('dashboardCasesDateFilter');
        if (dateFilterSelect) {
            dateFilterSelect.addEventListener('change', (e) => {
                this.dateFilter = e.target.value;
                this.updateSectionTitle();
                this.loadUpcomingCases();
            });
        }

        // Status filter change handler
        const statusFilterSelect = document.getElementById('dashboardCasesStatusFilter');
        if (statusFilterSelect) {
            statusFilterSelect.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.loadUpcomingCases();
            });
        }
    }

    updateSectionTitle() {
        const titleElement = document.getElementById('dashboardCasesSectionTitle');
        if (!titleElement) return;

        const titleMap = {
            'today': 'Today\'s Cases',
            'tomorrow': 'Tomorrow\'s Cases', 
            'week': 'Upcoming Cases',
            'month': 'This Month\'s Cases',
            'recent': 'Recent Cases',
            'past': 'Past Cases'
        };

        const newTitle = titleMap[this.dateFilter] || 'Upcoming Cases';
        titleElement.innerHTML = `<i class="fas fa-calendar-alt"></i> ${newTitle}`;
    }

    async loadUpcomingCases() {
        try {
            const allCases = await this.dataManager.getAllCases();
            let filteredCases = this.filterCasesByDate(allCases, this.dateFilter);
            
            // Apply status filter if selected
            if (this.statusFilter) {
                filteredCases = filteredCases.filter(caseItem => caseItem.status === this.statusFilter);
            }
            
            // Store the filtered cases for use by other methods like checkInTraysForCase
            this.currentCases = filteredCases;
            
            await this.renderDashboardCases(filteredCases);
        } catch (error) {
            console.error('Error loading dashboard cases:', error);
            this.showErrorState();
        }
    }

    filterCasesByDate(cases, filterType) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const filtered = cases.filter(caseItem => {
            const caseDate = new Date(caseItem.scheduledDate);
            const caseDateOnly = new Date(caseDate.getFullYear(), caseDate.getMonth(), caseDate.getDate());
            
            switch (filterType) {
                case 'today':
                    return caseDateOnly.getTime() === today.getTime();
                
                case 'tomorrow':
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return caseDateOnly.getTime() === tomorrow.getTime();
                
                case 'week':
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    return caseDateOnly >= today && caseDateOnly <= weekEnd;
                
                case 'month':
                    const monthEnd = new Date(today);
                    monthEnd.setMonth(monthEnd.getMonth() + 1);
                    return caseDateOnly >= today && caseDateOnly <= monthEnd;
                
                case 'recent':
                    // Last 7 days (past cases)
                    const sevenDaysAgo = new Date(today);
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return caseDateOnly >= sevenDaysAgo && caseDateOnly < today;
                
                case 'past':
                    // All past cases
                    return caseDateOnly < today;
                
                default:
                    return true;
            }
        });

        // Sort logic depends on filter type
        return filtered.sort((a, b) => {
            const dateA = new Date(a.scheduledDate + 'T' + (a.scheduledTime || '08:00'));
            const dateB = new Date(b.scheduledDate + 'T' + (b.scheduledTime || '08:00'));
            
            // For past cases, sort newest first (descending)
            if (filterType === 'recent' || filterType === 'past') {
                return dateB - dateA;
            } else {
                // For upcoming cases, sort oldest first (ascending)
                return dateA - dateB;
            }
        });
    }

    async renderDashboardCases(cases) {
        const container = document.getElementById('dashboardCasesContent');
        if (!container) return;

        if (cases.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }

        // Render cards with loading state for tray status
        const limitedCases = cases.slice(0, 6);
        const cardsHTML = await Promise.all(
            limitedCases.map(caseItem => this.renderCaseCard(caseItem))
        );
        container.innerHTML = cardsHTML.join('');
    }

    async renderCaseCard(caseItem) {
        const surgeons = this.dataManager.getSurgeons();
        const facilities = this.dataManager.getFacilities();
        const caseTypes = this.dataManager.getCaseTypes();
        
        const surgeon = surgeons.find(s => s.id === caseItem.physician_id);
        const facility = facilities.find(f => f.id === caseItem.facility_id);
        const caseType = caseTypes.find(ct => ct.id === caseItem.caseTypeId);
        
        const scheduledDateTime = new Date(caseItem.scheduledDate + 'T' + (caseItem.scheduledTime || '08:00'));
        const dateStr = scheduledDateTime.toLocaleDateString();
        const timeStr = scheduledDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Determine appropriate date label based on filter type and case date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const caseDate = new Date(caseItem.scheduledDate);
        caseDate.setHours(0, 0, 0, 0);
        const diffTime = caseDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let dateLabel = '';
        
        if (this.dateFilter === 'recent' || this.dateFilter === 'past') {
            // For past cases, show how many days ago or the date
            if (diffDays === 0) {
                dateLabel = 'Today';
            } else if (diffDays === -1) {
                dateLabel = 'Yesterday';
            } else if (diffDays > -7 && diffDays < 0) {
                dateLabel = `${Math.abs(diffDays)} days ago`;
            } else {
                dateLabel = dateStr;
            }
        } else {
            // For future cases, show upcoming labels
            if (diffDays === 0) {
                dateLabel = 'Today';
            } else if (diffDays === 1) {
                dateLabel = 'Tomorrow';
            } else if (diffDays > 1 && diffDays <= 7) {
                dateLabel = `In ${diffDays} days`;
            } else {
                dateLabel = dateStr;
            }
        }

        return `
            <div class="tray-card h-100">
                <div class="tray-card-header">
                    <div class="tray-card-title">
                        <div class="tray-type-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        ${caseItem.patientName || 'N/A'}
                    </div>
                    <span class="tray-status-badge ${this.getStatusClass(caseItem.status)}">
                        ${this.capitalizeFirst(caseItem.status)}
                    </span>
                </div>
                <div class="tray-card-content">
                    <div class="tray-detail">
                        <i class="fas fa-user-md"></i>
                        <span class="tray-detail-value">${surgeon ? surgeon.full_name : (surgeons.length === 0 ? 'Loading...' : 'Unknown Physician')}</span>
                    </div>
                    <div class="tray-detail">
                        <i class="fas fa-hospital"></i>
                        <span class="tray-detail-value">${facility ? facility.account_name : (facilities.length === 0 ? 'Loading...' : 'Unknown Facility')}</span>
                    </div>
                    <div class="tray-detail">
                        <i class="fas fa-clock"></i>
                        <span class="tray-detail-value">${dateLabel} at ${timeStr}</span>
                    </div>
                    <div class="tray-detail">
                        <i class="fas fa-stethoscope"></i>
                        <span class="tray-detail-value">${caseType ? caseType.name : (caseTypes.length === 0 ? 'Loading...' : 'Unknown Type')}</span>
                    </div>
                    <div class="tray-detail">
                        <i class="fas fa-cube"></i>
                        <span class="tray-detail-value">${await this.renderTrayRequirementsStatus(caseItem)}</span>
                    </div>
                    ${caseItem.notes ? `
                        <div class="tray-detail">
                            <i class="fas fa-sticky-note"></i>
                            <span class="tray-detail-value">${caseItem.notes}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="tray-card-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="window.app.casesManager.editCase('${caseItem.id}')" title="Edit Case">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="window.app.casesManager.viewCaseDetails('${caseItem.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${caseItem.status === CASE_STATUS.SCHEDULED ? `
                        <button class="btn btn-sm btn-outline-warning" onclick="window.app.dashboardManager.checkInTraysForCase('${caseItem.id}')" title="Check-in Available Trays">
                            <i class="fas fa-check-circle"></i> Check-in
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-success" onclick="window.app.navigation.navigate('cases')" title="Go to Cases">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getTrayRequirements(caseData) {
        try {
            // Step 1: Check if case exists
            if (window.is_enable_api_logging && window.frontendLogger && (caseData?.id?.includes('aa') || caseData?.patientName?.includes('aa'))) {
                window.frontendLogger.error(`🔍 STEP 1: getTrayRequirements called for case ${caseData?.id || 'NO_ID'}`);
            }
            
            if (!caseData) {
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.error(`🔍 STEP 1 ERROR: No caseData provided to getTrayRequirements`);
                }
                return [];
            }
            
            // Step 2: Log all tray requirement sources
            if (window.is_enable_api_logging && window.frontendLogger && (caseData.id?.includes('aa') || caseData.patientName?.includes('aa'))) {
                window.frontendLogger.error(`🔍 STEP 2: Checking all possible tray requirement sources`, {
                    caseId: caseData.id,
                    hasTrayCRequirements: !!caseData.tray_requirements,
                    trayRequirementsLength: Array.isArray(caseData.tray_requirements) ? caseData.tray_requirements.length : 'NOT_ARRAY',
                    trayRequirementsValue: caseData.tray_requirements,
                    hasTrayRequirements: !!caseData.trayRequirements,
                    trayRequirementsType: typeof caseData.trayRequirements,
                    trayRequirementsValueAlt: caseData.trayRequirements,
                    allKeys: Object.keys(caseData || {})
                });
            }
            
            // Step 3: Check if we have string-based requirements that need conversion
            const stringRequirements = caseData.trayRequirements;
            const objectRequirements = caseData.tray_requirements;
            
            if (window.is_enable_api_logging && window.frontendLogger && (caseData.id?.includes('aa') || caseData.patientName?.includes('aa'))) {
                window.frontendLogger.error(`🔍 STEP 3: Source analysis`, {
                    caseId: caseData.id,
                    hasStringRequirements: !!stringRequirements,
                    stringRequirements: stringRequirements,
                    stringIsArray: Array.isArray(stringRequirements),
                    hasObjectRequirements: !!objectRequirements,
                    objectRequirements: objectRequirements,
                    objectIsArray: Array.isArray(objectRequirements)
                });
            }
            
            // Step 4: ONLY use tray_requirements field, ignore trayRequirements string array
            let requirements = objectRequirements || [];
            
            // Step 5: REMOVED - No longer process string requirements
            
            // Step 6: Validate array type
            if (!Array.isArray(requirements)) {
                if (window.is_enable_api_logging && window.frontendLogger && (caseData.id?.includes('aa') || caseData.patientName?.includes('aa'))) {
                    window.frontendLogger.error(`🔍 STEP 6 ERROR: Requirements is not array`, {
                        caseId: caseData.id,
                        requirementsType: typeof requirements,
                        requirementsValue: requirements
                    });
                }
                return [];
            }
            
            // Step 7: Log RAW tray_requirements data for debugging
            if (window.is_enable_api_logging && window.frontendLogger && (caseData.id?.includes('aa') || caseData.patientName?.includes('aa'))) {
                window.frontendLogger.error(`🔍 STEP 7: RAW tray_requirements data analysis`, {
                    caseId: caseData.id,
                    rawRequirementsCount: requirements.length,
                    rawRequirements: requirements,
                    requirementTypes: requirements.map(r => r.requirement_type),
                    uniqueTrayNames: [...new Set(requirements.map(r => r.tray_name))],
                    uniqueTrayIds: [...new Set(requirements.map(r => r.tray_id))]
                });
            }
            
            // Step 8: NO FILTERING - show ALL tray requirements regardless of type
            const filteredRequirements = requirements; // Show everything
            
            // Step 9: Log unfiltered result (showing all trays)
            if (window.is_enable_api_logging && window.frontendLogger && (caseData.id?.includes('aa') || caseData.patientName?.includes('aa'))) {
                const typeBreakdown = {};
                requirements.forEach(r => {
                    const type = r.requirement_type || 'undefined';
                    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
                });
                
                window.frontendLogger.error(`🔍 STEP 9: ALL tray requirements (no filtering)`, {
                    caseId: caseData.id,
                    totalCount: requirements.length,
                    allRequirements: requirements,
                    typeBreakdown: typeBreakdown,
                    uniqueTrayNames: [...new Set(requirements.map(r => r.tray_name))],
                    uniqueTrayIds: [...new Set(requirements.map(r => r.tray_id))]
                });
            }
            
            return filteredRequirements;
            
        } catch (error) {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error(`🔍 STEP ERROR: Exception in getTrayRequirements`, {
                    error: error.message,
                    stack: error.stack,
                    caseId: caseData?.id || 'NO_ID'
                });
            }
            return [];
        }
    }

    // Central function to analyze tray availability for a case
    async analyzeTrayAvailabilityForCase(caseItem) {
        // ANALYSIS STEP 1: Log entry and call getTrayRequirements
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 ANALYSIS STEP 1: analyzeTrayAvailabilityForCase entry`, {
                caseId: caseItem.id,
                patientName: caseItem.patientName,
                functionName: 'analyzeTrayAvailabilityForCase',
                caseDataKeys: Object.keys(caseItem || {}),
                hasTrayRequirements: !!caseItem.tray_requirements,
                hasTrayRequirementsAlt: !!caseItem.trayRequirements
            });
        }

        const trayRequirements = this.getTrayRequirements(caseItem);
        const requirementCount = trayRequirements.length;
        
        // ANALYSIS STEP 2: Log getTrayRequirements result
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 ANALYSIS STEP 2: getTrayRequirements completed`, {
                caseId: caseItem.id,
                requirementCount: requirementCount,
                trayRequirements: trayRequirements,
                trayRequirementsIsArray: Array.isArray(trayRequirements)
            });
        }
        
        // Debug logging to API - Focus on case 'aa'
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.info(`🔍 DEBUG: Case ${caseItem.id} has ${requirementCount} tray requirements`, trayRequirements);
        }
        
        if (requirementCount === 0) {
            return {
                requirementCount: 0,
                availableCount: 0,
                inUseCount: 0,
                assignedToThisCase: 0,
                effectivelyCheckedIn: 0,
                issues: [],
                conflictWarnings: [],
                checkedInTrays: [],
                allTraysAvailable: true,
                hasConflicts: false
            };
        }

        // Get all trays and cases for detailed information
        let allTrays, allCases;
        try {
            [allTrays, allCases] = await Promise.all([
                this.dataManager.getAllTrays(),
                this.dataManager.getAllCases()
            ]);
        } catch (error) {
            console.error('Error getting data for availability analysis:', error);
            return {
                requirementCount,
                availableCount: 0,
                inUseCount: 0,
                assignedToThisCase: 0,
                effectivelyCheckedIn: 0,
                issues: [`Error loading data: ${error.message}`],
                conflictWarnings: [],
                checkedInTrays: [],
                allTraysAvailable: false,
                hasConflicts: false,
                error: error.message
            };
        }
        
        if (!Array.isArray(allTrays) || allTrays.length === 0) {
            return {
                requirementCount,
                availableCount: 0,
                inUseCount: 0,
                assignedToThisCase: 0,
                effectivelyCheckedIn: 0,
                issues: ['No tray data available'],
                conflictWarnings: [],
                checkedInTrays: [],
                allTraysAvailable: false,
                hasConflicts: false
            };
        }

        // Debug logging for case "aa" after allTrays is initialized - COMPREHENSIVE ANALYSIS
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            // Extract tray_ids from case requirements
            const requiredTrayIds = trayRequirements.map(r => r.tray_id).filter(Boolean);
            
            // Extract tray_ids from tray_tracking collection
            const availableTrayIds = allTrays.map(t => t.tray_id || t.id).filter(Boolean);
            const trayIdToNameMap = {};
            allTrays.forEach(t => {
                if (t.tray_id || t.id) {
                    trayIdToNameMap[t.tray_id || t.id] = t.name;
                }
            });
            
            // Find matches and mismatches
            const matchingIds = requiredTrayIds.filter(reqId => availableTrayIds.includes(reqId));
            const missingIds = requiredTrayIds.filter(reqId => !availableTrayIds.includes(reqId));
            
            // CHECK FOR CASE TYPE FILTERING
            const caseType = caseItem.caseTypeId;
            const traysWithCaseTypeCompat = allTrays.filter(t => t.case_type_compatibility);
            const traysCompatibleWithThisCase = allTrays.filter(t => 
                !t.case_type_compatibility || 
                !Array.isArray(t.case_type_compatibility) || 
                t.case_type_compatibility.length === 0 ||
                t.case_type_compatibility.includes(caseType)
            );
            
            window.frontendLogger.error(`🎯 CASE AA DEBUG: COMPREHENSIVE TRAY ANALYSIS`, {
                caseId: caseItem.id,
                patientName: caseItem.patientName,
                caseTypeId: caseItem.caseTypeId,
                totalRequiredTrays: requirementCount,
                totalTraysInDatabase: allTrays.length,
                traysWithCaseTypeCompat: traysWithCaseTypeCompat.length,
                traysCompatibleWithCase: traysCompatibleWithThisCase.length,
                isAllTraysFiltered: traysCompatibleWithThisCase.length !== allTrays.length,
                requiredTrayIds: requiredTrayIds,
                availableTrayIds: availableTrayIds.slice(0, 10), // First 10 for brevity
                matchingTrayIds: matchingIds,
                missingTrayIds: missingIds,
                trayIdMatches: matchingIds.length,
                trayIdMisses: missingIds.length,
                matchSuccess: missingIds.length === 0,
                trayNamesForMatches: matchingIds.map(id => ({ id, name: trayIdToNameMap[id] })),
                trayRequirementsRaw: trayRequirements,
                sampleTraysWithCompat: traysWithCaseTypeCompat.slice(0, 3).map(t => ({
                    id: t.id,
                    name: t.name,
                    case_type_compatibility: t.case_type_compatibility
                })),
                sampleIncompatibleTrays: allTrays.filter(t => 
                    t.case_type_compatibility && 
                    Array.isArray(t.case_type_compatibility) && 
                    t.case_type_compatibility.length > 0 &&
                    !t.case_type_compatibility.includes(caseType)
                ).slice(0, 3).map(t => ({
                    id: t.id,
                    name: t.name,
                    case_type_compatibility: t.case_type_compatibility
                }))
            });
        }

        let availableCount = 0;
        let inUseCount = 0;
        let assignedToThisCase = 0;
        let effectivelyCheckedIn = 0; // Trays that are in-use but match facility/surgeon
        let issues = [];
        let conflictWarnings = [];
        let checkedInTrays = []; // Track trays that are effectively checked in

        // Get case facility and surgeon for conflict detection
        const caseFacility = caseItem.facility_id || caseItem.facility;
        const caseSurgeon = caseItem.physician_id || caseItem.surgeon;

        // Check each tray requirement
        // LOG REQUIREMENTS PROCESSING START - TRAY AVAILABILITY LOGIC
        if (window.is_enable_tray_availability_logic_api_logging) {
            fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'error',
                    message: 'TRAY ANALYSIS STARTED',
                    context: 'tray-analysis-start',
                    data: {
                        caseId: caseItem.id,
                        patientName: caseItem.patientName,
                        requirementCount: trayRequirements.length,
                        caseFacility: caseFacility,
                        caseSurgeon: caseSurgeon,
                        caseStatus: caseItem.status
                    }
                })
            }).catch(e => console.error('Failed to log analysis start:', e));
        }
        if (window.is_enable_api_logging && window.frontendLogger) {
            const logData = {
                caseId: caseItem.id,
                patientName: caseItem.patientName,
                totalRequirements: trayRequirements.length,
                allRequirements: trayRequirements.map((req, index) => ({
                    index: index,
                    tray_id: req.tray_id,
                    tray_name: req.tray_name,
                    requirement_type: req.requirement_type,
                    notes: req.notes
                }))
            };
        }

        for (const requirement of trayRequirements) {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info(`🔍 DEBUG: Processing requirement for tray: ${requirement.tray_name || requirement.tray_id || 'UNKNOWN'}`);
                
                // Simplified debug for test44
                if (requirement.tray_name && requirement.tray_name.includes('test44')) {
                    window.frontendLogger.error(`🎯 TEST44 DEBUG: Found test44 requirement with ID: ${requirement.tray_id}`);
                }
            }
            if (requirement.tray_id) {
                // ENHANCED TRAY LOOKUP - Handle TRAY_XXX to Firebase ID mismatch
                let tray = null;
                
                // Strategy 1: Exact match on tray_id or Firebase id
                tray = allTrays.find(t => t.id === requirement.tray_id || t.tray_id === requirement.tray_id);
                
                // Strategy 2: If requirement uses TRAY_XXX format, try mapping to actual trays
                if (!tray && requirement.tray_id.startsWith('TRAY_')) {
                    // Extract number from TRAY_001, TRAY_002, etc.
                    const trayNumber = requirement.tray_id.replace('TRAY_', '');
                    
                    // Try to find tray by name patterns or sequential matching
                    tray = allTrays.find(t => 
                        t.name && (
                            t.name.toLowerCase().includes(`tray ${trayNumber}`) ||
                            t.name.toLowerCase().includes(`tray${trayNumber}`) ||
                            t.name.toLowerCase().includes(`${trayNumber}`) ||
                            // Check if tray has a displayId or serial that matches
                            t.displayId === requirement.tray_id ||
                            t.serialNumber === requirement.tray_id
                        )
                    );
                    
                    // Strategy 3: Use index-based matching as fallback (TRAY_001 = first tray, etc.)
                    if (!tray && !isNaN(parseInt(trayNumber))) {
                        const index = parseInt(trayNumber) - 1; // TRAY_001 = index 0
                        if (index >= 0 && index < allTrays.length) {
                            tray = allTrays[index];
                            if (window.is_enable_api_logging && window.frontendLogger) {
                                window.frontendLogger.warn(`🔧 FALLBACK: Using index-based matching for ${requirement.tray_id} -> ${tray.name}`);
                            }
                        }
                    }
                }
                
                // Strategy 4: If still not found, try by name
                if (!tray && requirement.tray_name) {
                    tray = allTrays.find(t => t.name === requirement.tray_name);
                }
                
                // COMPREHENSIVE API LOGGING for each tray lookup attempt
                if (window.is_enable_api_logging && window.frontendLogger) {
                    // Log every single matching attempt in detail
                    const detailedLookup = {
                        requirementBeingProcessed: {
                            tray_id: requirement.tray_id,
                            tray_name: requirement.tray_name,
                            requirement_type: requirement.requirement_type
                        },
                        searchingForId: requirement.tray_id,
                        searchingForName: requirement.tray_name,
                        found: !!tray,
                        totalTraysAvailable: allTrays.length,
                        exactMatchAttempts: {
                            strategy1_exact_id: allTrays.find(t => t.id === requirement.tray_id || t.tray_id === requirement.tray_id) ? 'FOUND' : 'NOT_FOUND',
                            matchingTrays_by_id: allTrays.filter(t => t.id === requirement.tray_id).map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name })),
                            matchingTrays_by_tray_id: allTrays.filter(t => t.tray_id === requirement.tray_id).map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name }))
                        },
                        successfulStrategy: null
                    };
                    
                    if (tray) {
                        // Determine exact strategy that worked
                        if (tray.id === requirement.tray_id) {
                            detailedLookup.successfulStrategy = 'matched_by_firebase_id';
                        } else if (tray.tray_id === requirement.tray_id) {
                            detailedLookup.successfulStrategy = 'matched_by_tray_id_field';
                        } else if (requirement.tray_id.startsWith('TRAY_') && tray.name) {
                            detailedLookup.successfulStrategy = 'tray_xxx_name_pattern_match';
                        } else if (requirement.tray_id.startsWith('TRAY_')) {
                            detailedLookup.successfulStrategy = 'tray_xxx_index_fallback';
                        } else if (requirement.tray_name && tray.name === requirement.tray_name) {
                            detailedLookup.successfulStrategy = 'matched_by_name';
                        }
                        
                        detailedLookup.foundTray = {
                            id: tray.id,
                            tray_id: tray.tray_id,
                            name: tray.name,
                            status: tray.status,
                            matchedBy: detailedLookup.successfulStrategy
                        };
                    } else {
                        // DETAILED FAILURE ANALYSIS - why didn't we find it?
                        detailedLookup.failureAnalysis = {
                            totalTraysChecked: allTrays.length,
                            requirementTrayId: requirement.tray_id,
                            exactIdMatches: allTrays.filter(t => t.id === requirement.tray_id),
                            exactTrayIdMatches: allTrays.filter(t => t.tray_id === requirement.tray_id),
                            sampleTraysInDb: allTrays.slice(0, 5).map(t => ({ 
                                id: t.id, 
                                tray_id: t.tray_id, 
                                name: t.name,
                                id_matches: t.id === requirement.tray_id,
                                tray_id_matches: t.tray_id === requirement.tray_id 
                            })),
                            allTrayIds: allTrays.map(t => t.id),
                            allTrayIdFields: allTrays.map(t => t.tray_id).filter(Boolean)
                        };
                    }
                    
                }
                
                if (tray) {
                    const trayName = requirement.tray_name || tray.name || `Tray ${requirement.tray_id.slice(-4)}`;
                    const trayFacility = tray.facility_id || tray.facility;
                    const traySurgeon = tray.physician_id || tray.surgeon;
                    const facilityMatches = trayFacility && caseFacility && trayFacility === caseFacility;
                    const surgeonMatches = traySurgeon && caseSurgeon && traySurgeon === caseSurgeon;
                    
                    const statusEvaluation = {
                        trayName,
                        status: tray.status,
                        isAvailable: isAvailableStatus(tray.status),
                        isInUse: isInUseStatus(tray.status),
                        isCheckedIn: isCheckedInStatus(tray.status),
                        assignedToThisCase: tray.assignedCaseId === caseItem.id,
                        trayFacility,
                        traySurgeon,
                        caseFacility,
                        caseSurgeon,
                        facilityMatches,
                        surgeonMatches,
                        assignedCaseId: tray.assignedCaseId,
                        caseId: caseItem.id
                    };
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info(`🔍 DEBUG: Tray ${trayName} status evaluation:`, statusEvaluation);
                    }
                    // Send tray status evaluation to API for logging
                    if (window.is_enable_tray_availability_logic_api_logging) {
                        fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                level: 'info',
                                message: `TRAY STATUS EVALUATION: ${trayName}`,
                                context: 'tray-status-eval',
                                data: statusEvaluation
                            })
                        }).catch(e => console.error('Failed to log tray status:', e));
                    }
                    
                    // Flag to track if tray has been displayed
                    let trayDisplayed = false;
                    
                    // For available trays, just show a simple "needs check-in" message
                    if (tray.status === TRAY_STATUS.AVAILABLE && caseItem.status === CASE_STATUS.SCHEDULED) {
                        conflictWarnings.push(`${trayName}: Available - needs to be checked in`);
                    }
                    
                    if (isAvailableStatus(tray.status)) {
                        availableCount++;
                        trayDisplayed = true; // Available trays are counted as ready
                        if (window.is_enable_tray_availability_logic_api_logging) {
                            fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    level: 'info',
                                    message: `TRAY COUNTED AS AVAILABLE: ${trayName}`,
                                    context: 'tray-counting',
                                    data: { trayName, availableCount, status: tray.status }
                                })
                            }).catch(e => console.error('Failed to log available count:', e));
                        }
                    } else if (isInUseStatus(tray.status)) {
                        inUseCount++;
                        // Check if tray is ready for this case based on facility/physician matching ONLY
                        const trayFacility = tray.facility_id || tray.facility;
                        const traySurgeon = tray.physician_id || tray.surgeon;
                        const facilityMatches = trayFacility && caseFacility && trayFacility === caseFacility;
                        const surgeonMatches = traySurgeon && caseSurgeon && traySurgeon === caseSurgeon;
                        
                        if (facilityMatches && surgeonMatches) {
                            // This IN_USE tray matches the case facility/physician - treat as checked-in!
                            effectivelyCheckedIn++;
                            if (window.is_enable_tray_availability_logic_api_logging) {
                                fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        level: 'info',
                                        message: `TRAY COUNTED AS CHECKED_IN_FOR_THIS_CASE: ${trayName}`,
                                        context: 'tray-counting',
                                        data: { trayName, effectivelyCheckedIn, facilityMatches, surgeonMatches, status: tray.status, reason: "IN_USE with matching facility/physician" }
                                    })
                                }).catch(e => console.error('Failed to log in-use as checked-in:', e));
                            }
                            
                            // Use checked-in logic - same as lines 936-968
                            let statusDetails = `${trayName}: CHECKED IN`;
                            
                            // Always show facility and surgeon info for checked-in trays
                            let details = [];
                            const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                            if (trayFacilityName) {
                                details.push(`Facility: ${trayFacilityName}`);
                            }
                            const traySurgeonName = this.getSurgeonName(tray.physician_id || tray.surgeon);
                            if (traySurgeonName) {
                                details.push(`Physician: ${traySurgeonName}`);
                            }
                            
                            if (details.length > 0) {
                                statusDetails += ` - ${details.join(', ')}`;
                            }
                            
                            checkedInTrays.push(statusDetails);
                            trayDisplayed = true;
                        } else {
                            // Check if tray has matching facility and surgeon (effectively checked in)
                            // Variables already declared above - trayFacility, traySurgeon, facilityMatches, surgeonMatches
                            
                            // Always show the tray status - either as ready or unavailable
                            if (facilityMatches && surgeonMatches && caseItem.status === CASE_STATUS.SCHEDULED) {
                                // This tray is effectively checked in for this case
                                effectivelyCheckedIn++;
                                if (window.is_enable_tray_availability_logic_api_logging) {
                                    fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            level: 'info',
                                            message: `TRAY COUNTED AS EFFECTIVELY_CHECKED_IN: ${trayName}`,
                                            context: 'tray-counting',
                                            data: { trayName, effectivelyCheckedIn, facilityMatches, surgeonMatches, status: tray.status }
                                        })
                                    }).catch(e => console.error('Failed to log effectively checked in:', e));
                                }
                                let statusDetails = `${trayName}: READY (matching assignment)`;
                                
                                // Build explicit details for ready trays too
                                let details = [];
                                
                                if (tray.assignedCaseId) {
                                    // First check if this tray is assigned to the current case
                                    if (tray.assignedCaseId === caseItem.id) {
                                        // Use the current case information
                                        const caseName = caseItem.patientName || caseItem.patient_name || 
                                                       caseItem.caseName || caseItem.case_name || 
                                                       caseItem.name || caseItem.title ||
                                                       caseItem.caseType || caseItem.case_type ||
                                                       caseItem.procedureType || caseItem.procedure_type;
                                        if (caseName) {
                                            details.push(`Case: ${caseName}`);
                                        } else {
                                            details.push(`Case: This Case`);
                                        }
                                    } else {
                                        // Look up other case information
                                        const assignedCase = allCases?.find(c => c.id === tray.assignedCaseId);
                                        if (assignedCase) {
                                            const caseName = assignedCase.patientName || assignedCase.patient_name || 
                                                           assignedCase.caseName || assignedCase.case_name || 
                                                           assignedCase.name || assignedCase.title ||
                                                           assignedCase.caseType || assignedCase.case_type ||
                                                           assignedCase.procedureType || assignedCase.procedure_type;
                                            if (caseName) {
                                                details.push(`Case: ${caseName}`);
                                            } else {
                                                details.push(`Case: ${tray.assignedCaseId.slice(-4)}`);
                                            }
                                        } else {
                                            details.push(`Case: ${tray.assignedCaseId.slice(-4)} (not found)`);
                                        }
                                    }
                                }
                                
                                const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                                if (trayFacilityName) {
                                    details.push(`Facility: ${trayFacilityName}`);
                                }
                                
                                const traySurgeonName = this.getSurgeonName(tray.physician_id || tray.surgeon);
                                if (traySurgeonName) {
                                    details.push(`Physician: ${traySurgeonName}`);
                                }
                                
                                if (details.length > 0) {
                                    statusDetails += ` - ${details.join(', ')}`;
                                }
                                
                                checkedInTrays.push(statusDetails);
                                trayDisplayed = true;
                            } else if (caseItem.status === CASE_STATUS.SCHEDULED) {
                                // Show detailed info about where it's in use
                                let inUseDetails = `${trayName}: IN USE ELSEWHERE`;
                                
                                // Build explicit details
                                let details = [];
                                
                                if (tray.assignedCaseId) {
                                    // First check if this tray is assigned to the current case
                                    if (tray.assignedCaseId === caseItem.id) {
                                        // Use the current case information
                                        const caseName = caseItem.patientName || caseItem.patient_name || 
                                                       caseItem.caseName || caseItem.case_name || 
                                                       caseItem.name || caseItem.title ||
                                                       caseItem.caseType || caseItem.case_type ||
                                                       caseItem.procedureType || caseItem.procedure_type;
                                        if (caseName) {
                                            details.push(`Case: ${caseName}`);
                                        } else {
                                            details.push(`Case: This Case`);
                                        }
                                    } else {
                                        // Look up other case information
                                        const assignedCase = allCases?.find(c => c.id === tray.assignedCaseId);
                                        if (assignedCase) {
                                            const caseName = assignedCase.patientName || assignedCase.patient_name || 
                                                           assignedCase.caseName || assignedCase.case_name || 
                                                           assignedCase.name || assignedCase.title ||
                                                           assignedCase.caseType || assignedCase.case_type ||
                                                           assignedCase.procedureType || assignedCase.procedure_type;
                                            if (caseName) {
                                                details.push(`Case: ${caseName}`);
                                            } else {
                                                details.push(`Case: ${tray.assignedCaseId.slice(-4)}`);
                                            }
                                        } else {
                                            details.push(`Case: ${tray.assignedCaseId.slice(-4)} (not found)`);
                                        }
                                    }
                                }
                                
                                const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                                if (trayFacilityName) {
                                    details.push(`Facility: ${trayFacilityName}`);
                                }
                                
                                const traySurgeonName = this.getSurgeonName(tray.physician_id || tray.surgeon);
                                if (traySurgeonName) {
                                    details.push(`Physician: ${traySurgeonName}`);
                                }
                                
                                if (details.length > 0) {
                                    inUseDetails += ` - ${details.join(', ')}`;
                                }
                                
                                issues.push(inUseDetails);
                                trayDisplayed = true;
                            }
                        }
                    } else if (isCheckedInStatus(tray.status)) {
                        // For checked-in/picked-up trays, check if they belong to this case or another case
                        if (tray.assignedCaseId === caseItem.id) {
                            // This tray is checked in for THIS case - it's ready!
                            effectivelyCheckedIn++;
                            if (window.is_enable_tray_availability_logic_api_logging) {
                                fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        level: 'info',
                                        message: `TRAY COUNTED AS CHECKED_IN_FOR_THIS_CASE: ${trayName}`,
                                        context: 'tray-counting',
                                        data: { trayName, effectivelyCheckedIn, assignedCaseId: tray.assignedCaseId, currentCaseId: caseItem.id, status: tray.status }
                                    })
                                }).catch(e => console.error('Failed to log checked in for this case:', e));
                            }
                            let statusDetails = `${trayName}: ${getStatusDisplayText(tray.status).toUpperCase()}`;
                            
                            // Always show facility and surgeon info
                            let details = [];
                            const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                            if (trayFacilityName) {
                                details.push(`Facility: ${trayFacilityName}`);
                            }
                            const traySurgeonName = this.getSurgeonName(tray.physician_id || tray.surgeon);
                            if (traySurgeonName) {
                                details.push(`Physician: ${traySurgeonName}`);
                            }
                            
                            if (details.length > 0) {
                                statusDetails += ` - ${details.join(', ')}`;
                            }
                            
                            checkedInTrays.push(statusDetails);
                            trayDisplayed = true;
                        } else {
                            // This tray is checked in for ANOTHER case - it's unavailable!
                            let unavailableDetails = `${trayName}: ${getStatusDisplayText(tray.status).toUpperCase()} FOR OTHER CASE`;
                            
                            // Show where it's currently checked in
                            let whereDetails = [];
                            
                            if (tray.assignedCaseId) {
                                const assignedCase = allCases?.find(c => c.id === tray.assignedCaseId);
                                if (assignedCase) {
                                    const caseName = assignedCase.patientName || assignedCase.patient_name || 
                                                   assignedCase.caseName || assignedCase.case_name || 
                                                   assignedCase.name || assignedCase.title ||
                                                   assignedCase.caseType || assignedCase.case_type ||
                                                   assignedCase.procedureType || assignedCase.procedure_type;
                                    whereDetails.push(`Currently checked in for Case: ${caseName || tray.assignedCaseId.slice(-4)}`);
                                } else {
                                    whereDetails.push(`Currently checked in for Case: ${tray.assignedCaseId.slice(-4)}`);
                                }
                            }
                            
                            const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                            if (trayFacilityName) {
                                whereDetails.push(`at Facility: ${trayFacilityName}`);
                            }
                            
                            const traySurgeonName = this.getSurgeonName(tray.physician_id || tray.surgeon);
                            if (traySurgeonName) {
                                whereDetails.push(`with Physician: ${traySurgeonName}`);
                            }
                            
                            if (whereDetails.length > 0) {
                                unavailableDetails += ` - ${whereDetails.join(', ')}`;
                            }
                            
                            issues.push(unavailableDetails);
                            trayDisplayed = true;
                        }
                    }
                    
                    // FALLBACK: Ensure every tray gets displayed - if not already handled above
                    if (!trayDisplayed) {
                        let fallbackDetails = `${trayName}: ${getStatusDisplayText(tray.status).toUpperCase()}`;
                        
                        // Add assignment info
                        if (tray.assignedCaseId) {
                            if (tray.assignedCaseId === caseItem.id) {
                                fallbackDetails += ` - ASSIGNED TO THIS CASE`;
                            } else {
                                fallbackDetails += ` - ASSIGNED TO OTHER CASE`;
                            }
                        }
                        
                        // Add facility and surgeon details if available
                        let details = [];
                        const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                        if (trayFacilityName) {
                            details.push(`Facility: ${trayFacilityName}`);
                        }
                        const traySurgeonName = this.getSurgeonName(tray.physician_id || tray.surgeon);
                        if (traySurgeonName) {
                            details.push(`Physician: ${traySurgeonName}`);
                        }
                        
                        if (details.length > 0) {
                            fallbackDetails += ` - ${details.join(', ')}`;
                        }
                        
                        issues.push(fallbackDetails);
                    }
                } else {
                    // Tray not found - provide comprehensive diagnostic information
                    const missingTrayName = requirement.tray_name || `Tray ${requirement.tray_id?.slice(-4) || 'Unknown'}`;
                    
                    // Build detailed missing tray information with mismatch context
                    let missingDetails = `${missingTrayName}: NOT FOUND`;
                    
                    // Add specific context for TRAY_XXX format mismatches
                    if (requirement.tray_id && requirement.tray_id.startsWith('TRAY_')) {
                        missingDetails += ` (TRAY_ID MISMATCH DETECTED)`;
                        missingDetails += ` - Case requires "${requirement.tray_id}" but trays use Firebase document IDs`;
                    } else {
                        missingDetails += ` IN SYSTEM`;
                    }
                    
                    // Add requirement type info if available
                    if (requirement.requirement_type) {
                        missingDetails += ` (${requirement.requirement_type.toUpperCase()} tray)`;
                    }
                    
                    // Add diagnostic info
                    const diagnosticInfo = [];
                    if (requirement.tray_id) {
                        diagnosticInfo.push(`Req.ID: ${requirement.tray_id}`);
                    }
                    if (requirement.tray_name) {
                        diagnosticInfo.push(`Req.Name: ${requirement.tray_name}`);
                    }
                    
                    if (diagnosticInfo.length > 0) {
                        missingDetails += ` - ${diagnosticInfo.join(', ')}`;
                    }
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.warn(`🔍 DEBUG: Tray NOT FOUND - ${missingTrayName}`, {
                            tray_id: requirement.tray_id,
                            tray_name: requirement.tray_name,
                            requirement_type: requirement.requirement_type,
                            requirement: requirement,
                            totalTraysInDatabase: allTrays.length,
                            sampleTrayIds: allTrays.slice(0, 3).map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name }))
                        });
                    }
                    
                    issues.push(missingDetails);
                }
            } else if (requirement.tray_name) {
                // Handle case where we have tray_name but no tray_id
                const trayByName = allTrays.find(t => t.name === requirement.tray_name);
                
                if (trayByName) {
                    // Found by name, but process it similar to ID-based lookup
                    const trayName = requirement.tray_name;
                    
                    if (trayByName.status === TRAY_STATUS.AVAILABLE) {
                        availableCount++;
                        // For available trays, just show a simple "needs check-in" message  
                        if (caseItem.status === CASE_STATUS.SCHEDULED) {
                            conflictWarnings.push(`${trayName}: Available - needs to be checked in`);
                        }
                    } else if (isInUseStatus(trayByName.status)) {
                        inUseCount++;
                        if (trayByName.assignedCaseId === caseItem.id) {
                            assignedToThisCase++;
                        } else {
                            issues.push(`${trayName}: IN USE ELSEWHERE - assigned to case ${trayByName.assignedCaseId?.slice(-4) || 'unknown'}`);
                        }
                    } else {
                        issues.push(`${trayName}: ${getStatusDisplayText(trayByName.status).toUpperCase()}`);
                    }
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info(`🔍 DEBUG: Found tray by name only: ${trayName}`, {
                            tray_name: requirement.tray_name,
                            found_id: trayByName.id,
                            status: trayByName.status
                        });
                    }
                } else {
                    // Tray name not found either
                    issues.push(`${requirement.tray_name}: NOT FOUND IN SYSTEM (searched by name only - no ID provided)`);
                }
            } else {
                // No tray_id and no tray_name
                issues.push(`Invalid tray requirement: missing both tray ID and name - ${JSON.stringify(requirement)}`);
            }
        }

        // Send final counts to API for logging
        if (window.is_enable_tray_availability_logic_api_logging) {
            fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'error',
                    message: 'FINAL TRAY COUNTS',
                    context: 'tray-analysis-final',
                    data: {
                        caseId: caseItem.id,
                        patientName: caseItem.patientName,
                        requirementCount,
                        availableCount,
                        effectivelyCheckedIn,
                        totalReady: availableCount + effectivelyCheckedIn,
                        issuesCount: issues.length,
                        conflictWarningsCount: conflictWarnings.length,
                        allRequirements: trayRequirements.map(req => ({
                            tray_id: req.tray_id,
                            tray_name: req.tray_name
                        })),
                        uniqueRequirements: [...new Set(trayRequirements.map(req => req.tray_id))].length,
                        duplicateCheck: trayRequirements.length !== [...new Set(trayRequirements.map(req => req.tray_id))].length
                    }
                })
            }).catch(e => console.error('Failed to log to API:', e));
        }
        
        const result = {
            requirementCount,
            availableCount,
            inUseCount,
            assignedToThisCase,
            effectivelyCheckedIn,
            issues,
            conflictWarnings,
            checkedInTrays,
            allTraysAvailable: (availableCount + effectivelyCheckedIn) === requirementCount,
            hasConflicts: conflictWarnings.length > 0
        };

        // Debug logging for case "aa" - log the final result
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 CASE AA DEBUG: Analysis result`, {
                caseId: caseItem.id,
                result: result,
                detailedBreakdown: {
                    totalRequired: requirementCount,
                    readyTrays: availableCount + effectivelyCheckedIn,
                    issuesFound: issues.length,
                    conflictsFound: conflictWarnings.length,
                    checkedInTraysFound: checkedInTrays.length,
                    issuesList: issues,
                    conflictsList: conflictWarnings,
                    checkedInList: checkedInTrays
                }
            });
        }

        return result;
    }

    // Central function to get conflict warnings for a tray
    getConflictWarnings(tray, caseFacility, caseSurgeon) {
        const warnings = [];
        const trayFacility = tray.facility_id || tray.facility;
        const traySurgeon = tray.physician_id || tray.surgeon;
        
        if (trayFacility && caseFacility && trayFacility !== caseFacility) {
            const trayFacilityName = this.getFacilityName(trayFacility);
            const caseFacilityName = this.getFacilityName(caseFacility);
            warnings.push(`needs facility change: ${trayFacilityName} → ${caseFacilityName}`);
        }
        if (traySurgeon && caseSurgeon && traySurgeon !== caseSurgeon) {
            const traySurgeonName = this.getSurgeonName(traySurgeon);
            const caseSurgeonName = this.getSurgeonName(caseSurgeon);
            warnings.push(`needs physician change: ${traySurgeonName} → ${caseSurgeonName}`);
        }
        // Handle cases where tray has no assignment but case does
        if (!trayFacility && caseFacility) {
            const caseFacilityName = this.getFacilityName(caseFacility);
            warnings.push(`needs facility assignment: → ${caseFacilityName}`);
        }
        if (!traySurgeon && caseSurgeon) {
            const caseSurgeonName = this.getSurgeonName(caseSurgeon);
            warnings.push(`needs physician assignment: → ${caseSurgeonName}`);
        }
        return warnings;
    }

    // Helper function to get facility name from ID
    getFacilityName(facilityId) {
        if (!facilityId) return null;
        
        // If it's already a name (not an ID), return it
        if (facilityId.length > 20 && !facilityId.match(/^[a-zA-Z0-9]{20}$/)) {
            return facilityId;
        }
        
        // Try to find facility by ID
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            return facility ? facility.account_name : facilityId; // Fallback to ID if not found
        }
        
        return facilityId; // Fallback to original value
    }

    /**
     * Get facility coordinates for check-in location tracking
     * @param {string} facilityId - The facility ID to look up
     * @returns {object|null} - Object with latitude and longitude, or null if not found
     */
    getFacilityCoordinates(facilityId) {
        if (!facilityId) {
            return null;
        }

        // Try facilityManager first
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            if (facility && facility.latitude && facility.longitude) {
                return {
                    latitude: facility.latitude,
                    longitude: facility.longitude,
                    source: 'facility_coordinates'
                };
            }
        }

        console.warn(`📍 No coordinates found for facility: ${facilityId}`);
        return null;
    }

    // Helper function to get surgeon name from ID
    getSurgeonName(surgeonId) {
        if (!surgeonId) return null;
        
        // If it's already a name (not an ID), return it
        if (surgeonId.length > 20 && !surgeonId.match(/^[a-zA-Z0-9]{20}$/)) {
            return surgeonId;
        }
        
        // Try to find surgeon by ID
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);
            return surgeon ? `${surgeon.title || 'Dr.'} ${surgeon.full_name}` : surgeonId; // Fallback to ID if not found
        }
        
        return surgeonId; // Fallback to original value
    }

    async renderTrayRequirementsStatus(caseItem) {
        // STEP 1: Log entry to renderTrayRequirementsStatus
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 RENDER STEP 1: renderTrayRequirementsStatus called`, {
                caseId: caseItem.id,
                patientName: caseItem.patientName,
                functionName: 'renderTrayRequirementsStatus'
            });
        }

        // Use centralized analysis function
        const analysis = await this.analyzeTrayAvailabilityForCase(caseItem);
        
        // STEP 2: Log analysis result
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 RENDER STEP 2: analyzeTrayAvailabilityForCase completed`, {
                caseId: caseItem.id,
                analysis: analysis,
                requirementCount: analysis.requirementCount,
                availableCount: analysis.availableCount,
                issues: analysis.issues,
                checkedInTrays: analysis.checkedInTrays
            });
        }
        
        if (analysis.requirementCount === 0) {
            return 'No Trays Required';
        }

        // Handle errors
        if (analysis.error) {
            return `${analysis.requirementCount} Tray${analysis.requirementCount > 1 ? 's' : ''} Required`;
        }

        // Build status display based on case status and tray availability
        let statusHtml = `${analysis.requirementCount} Tray${analysis.requirementCount > 1 ? 's' : ''} Required`;
        let statusDetails = '';
        
        if (caseItem.status === CASE_STATUS.SCHEDULED) {
            // For scheduled cases, show availability status with conflict consideration
            // Available trays (including those with conflicts) + effectively checked in trays = total ready
            const availableTrays = analysis.availableCount; // Already includes trays with conflicts
            const checkedInTrays = analysis.effectivelyCheckedIn;
            const totalReady = availableTrays + checkedInTrays;
            
            if (totalReady === analysis.requirementCount) {
                // Use issues array for conflict count (unavailable trays)
                if (analysis.issues.length > 0) {
                    statusHtml += ` <span class="text-warning"><i class="fas fa-exclamation-triangle"></i></span>`;
                    statusDetails = `All trays ready (${analysis.issues.length} conflict${analysis.issues.length > 1 ? 's' : ''})`;
                } else {
                    statusHtml += ` <span class="text-success"><i class="fas fa-check-circle"></i></span>`;
                    statusDetails = 'All trays ready';
                }
            } else if (totalReady > 0) {
                statusHtml += ` <span class="text-warning"><i class="fas fa-exclamation-triangle"></i></span>`;
                let readyDetails = `${totalReady}/${analysis.requirementCount} ready`;
                
                // Build detailed breakdown
                let breakdown = [];
                if (availableTrays > 0) breakdown.push(`${availableTrays} available`);
                if (checkedInTrays > 0) breakdown.push(`${checkedInTrays} checked in`);
                // Show conflicts based on issues array (unavailable trays)
                if (analysis.issues.length > 0) breakdown.push(`${analysis.issues.length} conflict${analysis.issues.length > 1 ? 's' : ''}`);
                
                if (breakdown.length > 0) {
                    readyDetails += ` (${breakdown.join(', ')})`;
                }
                statusDetails = readyDetails;
            } else {
                statusHtml += ` <span class="text-danger"><i class="fas fa-times-circle"></i></span>`;
                statusDetails = 'No trays ready';
            }
        }

        // Combine all warnings and issues
        let allDetails = [];
        if (analysis.issues.length > 0) {
            allDetails = allDetails.concat(analysis.issues);
        }
        if (analysis.conflictWarnings.length > 0) {
            allDetails = allDetails.concat(analysis.conflictWarnings);
        }

        // Debug logging for case "aa" - check what should be displayed
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 CASE AA DEBUG: Display decision`, {
                caseId: caseItem.id,
                shouldShowDetails: allDetails.length > 0 || analysis.checkedInTrays.length > 0,
                allDetailsCount: allDetails.length,
                checkedInTraysCount: analysis.checkedInTrays.length,
                allDetailsList: allDetails,
                checkedInTraysList: analysis.checkedInTrays,
                analysisIssues: analysis.issues,
                analysisConflicts: analysis.conflictWarnings
            });
        }

        // Debug logging for case "aa" - check why details might not be showing
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 CASE AA DEBUG: Final display check before render`, {
                caseId: caseItem.id,
                shouldShowDetails: allDetails.length > 0 || analysis.checkedInTrays.length > 0,
                allDetailsLength: allDetails.length,
                checkedInTraysLength: analysis.checkedInTrays.length,
                issuesLength: analysis.issues.length,
                conflictWarningsLength: analysis.conflictWarnings.length,
                statusHtml: statusHtml,
                statusDetails: statusDetails,
                requirementCount: analysis.requirementCount,
                availableCount: analysis.availableCount,
                effectivelyCheckedIn: analysis.effectivelyCheckedIn
            });
        }

        // Add detailed information if there are issues, conflicts, checked-in trays, OR if not all trays are available
        const showDetails = allDetails.length > 0 || 
                           analysis.checkedInTrays.length > 0 || 
                           (analysis.requirementCount > 0 && !analysis.allTraysAvailable);
        
        if (showDetails) {
            const hasConflicts = analysis.hasConflicts;
            const hasIssues = analysis.issues.length > 0;
            
            // Separate issues and conflicts for better formatting
            let detailsHtml = '';
            
            // Show checked-in trays first (positive information)
            if (analysis.checkedInTrays.length > 0) {
                detailsHtml += `
                    <div class="tray-status-checked-in" style="font-size: 0.8em; color: #28a745; margin-top: 3px; padding: 4px; background-color: #f8fff9; border-left: 3px solid #28a745; border-radius: 2px;">
                        <div style="font-weight: 500; margin-bottom: 2px;">
                            <i class="fas fa-check-circle"></i> Ready Trays:
                        </div>
                        <div style="line-height: 1.4;">
                            ${analysis.checkedInTrays.map((tray, index, array) => `<div style="margin-bottom: 4px; padding-bottom: 3px; ${index < array.length - 1 ? 'border-bottom: 1px solid #d4edda;' : ''}">${tray}</div>`).join('')}
                        </div>
                    </div>
                `;
            }
            
            // Log issues array for debugging
            if (window.is_enable_tray_availability_logic_api_logging) {
                fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        level: 'info',
                        message: 'ISSUES ARRAY FOR DISPLAY',
                        context: 'display-issues',
                        data: {
                            caseId: caseItem.id,
                            patientName: caseItem.patientName,
                            issuesCount: analysis.issues.length,
                            issues: analysis.issues,
                            allIssues: analysis.issues
                        }
                    })
                }).catch(e => console.error('Failed to log issues array:', e));
            }

            if (analysis.issues.length > 0) {
                detailsHtml += `
                    <div class="tray-status-issues" style="font-size: 0.8em; color: #dc3545; margin-top: 3px; padding: 4px; background-color: #fff5f5; border-left: 3px solid #dc3545; border-radius: 2px;">
                        <div style="font-weight: 500; margin-bottom: 2px;">
                            <i class="fas fa-exclamation-circle"></i> Unavailable Trays:
                        </div>
                        <div style="line-height: 1.4;">
                            ${analysis.issues.map((issue, index, array) => `<div style="margin-bottom: 4px; padding-bottom: 3px; ${index < array.length - 1 ? 'border-bottom: 1px solid #ffdddd;' : ''}">${issue}</div>`).join('')}
                        </div>
                    </div>
                `;
            }
            
            // Show comprehensive unavailability info if not all trays are ready but no specific issues were captured
            if (!analysis.allTraysAvailable && analysis.issues.length === 0 && analysis.conflictWarnings.length === 0) {
                const missingCount = analysis.requirementCount - (analysis.availableCount + analysis.effectivelyCheckedIn);
                const readyCount = analysis.availableCount + analysis.effectivelyCheckedIn;
                
                // Build detailed fallback message
                let fallbackMessage = '';
                if (missingCount > 0) {
                    fallbackMessage += `${missingCount} tray${missingCount > 1 ? 's' : ''} not accounted for`;
                    
                    // Add breakdown if some trays are ready
                    if (readyCount > 0) {
                        fallbackMessage += ` (${readyCount}/${analysis.requirementCount} ready)`;
                    }
                    
                    // Add possible reasons
                    fallbackMessage += ` - Possible reasons: trays not in system, data sync issues, or unusual tray statuses`;
                } else {
                    fallbackMessage += `Tray availability calculation error - ${analysis.requirementCount} required, ${readyCount} appear ready, but system reports not all available`;
                }
                
                detailsHtml += `
                    <div class="tray-status-issues" style="font-size: 0.8em; color: #dc3545; margin-top: 3px; padding: 4px; background-color: #fff5f5; border-left: 3px solid #dc3545; border-radius: 2px;">
                        <div style="font-weight: 500; margin-bottom: 2px;">
                            <i class="fas fa-exclamation-circle"></i> Diagnostic Information:
                        </div>
                        <div style="line-height: 1.3;">
                            ${fallbackMessage}
                        </div>
                        <div style="line-height: 1.3; margin-top: 4px; font-size: 0.9em; color: #666;">
                            Debug: Required=${analysis.requirementCount}, Available=${analysis.availableCount}, CheckedIn=${analysis.effectivelyCheckedIn}, InUse=${analysis.inUseCount}
                        </div>
                    </div>
                `;
            }
            
            if (analysis.conflictWarnings.length > 0) {
                detailsHtml += `
                    <div class="tray-status-conflicts" style="font-size: 0.8em; color: #f57c00; margin-top: 3px; padding: 4px; background-color: #fffbf0; border-left: 3px solid #f57c00; border-radius: 2px;">
                        <div style="font-weight: 500; margin-bottom: 2px;">
                            <i class="fas fa-exclamation-triangle"></i> Action Required:
                        </div>
                        <div style="line-height: 1.4; font-size: 0.95em;">
                            ${analysis.conflictWarnings.map((warning, index, array) => `<div style="margin-bottom: 4px; padding-bottom: 3px; ${index < array.length - 1 ? 'border-bottom: 1px solid #ffe4b3;' : ''}">${warning}</div>`).join('')}
                        </div>
                    </div>
                `;
            }
            
            const finalHtml = `
                <div>
                    <div>${statusHtml}</div>
                    <div class="tray-status-details" style="font-size: 0.85em; color: ${hasIssues ? '#dc3545' : '#f57c00'}; margin-top: 2px;">
                        <i class="fas fa-info-circle"></i> ${statusDetails}
                    </div>
                    ${detailsHtml}
                </div>
            `;
            
            // RENDER STEP 3: Log final HTML output
            if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
                window.frontendLogger.error(`🎯 RENDER STEP 3: Final HTML with details (Case ${caseItem.id})`, {
                    caseId: caseItem.id,
                    statusHtml: statusHtml,
                    statusDetails: statusDetails,
                    detailsHtml: detailsHtml,
                    finalHtml: finalHtml,
                    htmlLength: finalHtml.length
                });
            }
            
            return finalHtml;
        } else if (statusDetails) {
            const simpleHtml = `
                <div>
                    <div>${statusHtml}</div>
                    <div class="tray-status-details" style="font-size: 0.85em; color: #6c757d; margin-top: 2px;">
                        <i class="fas fa-info-circle"></i> ${statusDetails}
                    </div>
                </div>
            `;
            
            // RENDER STEP 3: Log simple HTML output
            if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
                window.frontendLogger.error(`🎯 RENDER STEP 3: Simple HTML (Case ${caseItem.id})`, {
                    caseId: caseItem.id,
                    statusHtml: statusHtml,
                    statusDetails: statusDetails,
                    simpleHtml: simpleHtml,
                    htmlLength: simpleHtml.length
                });
            }
            
            return simpleHtml;
        }

        // RENDER STEP 3: Log minimal HTML output
        if (window.is_enable_api_logging && window.frontendLogger && (caseItem.id.includes('aa') || (caseItem.patientName && caseItem.patientName.includes('aa')))) {
            window.frontendLogger.error(`🎯 RENDER STEP 3: Minimal HTML (Case ${caseItem.id})`, {
                caseId: caseItem.id,
                statusHtml: statusHtml,
                htmlLength: statusHtml.length
            });
        }

        return statusHtml;
    }

    getStatusClass(status) {
        // Use the single source of truth for case status classes
        return getCaseStatusClass(status);
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Populate dashboard status filter with valid case statuses
    populateStatusFilter() {
        const select = document.getElementById('dashboardCasesStatusFilter');
        if (!select) return;

        // Clear existing options except "All Status"
        select.innerHTML = '<option value="">All Status</option>';

        // Add status options from constants
        CASE_STATUS_OPTIONS.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });
    }

    // Check in all available trays for a specific case
    async checkInTraysForCase(caseId) {
        try {
            // Find the case in filtered cases first, then in all cases if not found
            let caseData = this.currentCases.find(c => c.id === caseId);
            if (!caseData) {
                // Case might not be in current filter, get it directly from all cases
                const allCases = await this.dataManager.getAllCases();
                caseData = allCases.find(c => c.id === caseId);
            }
            
            if (!caseData) {
                this.showErrorNotification('Case not found');
                return;
            }

            // Use centralized analysis to get tray availability
            const analysis = await this.analyzeTrayAvailabilityForCase(caseData);
            
            if (analysis.requirementCount === 0) {
                this.showInfoNotification('No tray requirements found for this case');
                return;
            }

            if (analysis.error) {
                this.showErrorNotification('Error loading tray data: ' + analysis.error);
                return;
            }

            // Get all trays for processing
            const allTrays = await this.dataManager.getAllTrays();
            const caseFacility = caseData.facility_id || caseData.facility;
            const caseSurgeon = caseData.physician_id || caseData.surgeon;
            
            const checkedInTrays = [];
            const unavailableTrays = [];
            const conflictWarnings = [];
            
            // Get tray requirements
            const requirements = this.getTrayRequirements(caseData);
            
            // Get facility coordinates for mass check-in (shared for all trays)
            const facilityCoordinates = this.getFacilityCoordinates(caseFacility);
            if (facilityCoordinates) {
                console.log('📍 Using facility coordinates for mass check-in:', facilityCoordinates);
            }
            
            // Process each required tray
            for (const requirement of requirements) {
                // Find trays that match this requirement
                const matchingTrays = allTrays.filter(tray => 
                    (tray.tray_id === requirement.tray_id || tray.id === requirement.tray_id) &&
                    tray.status === TRAY_STATUS.AVAILABLE
                );
                
                if (matchingTrays.length > 0) {
                    // Check in the first available matching tray
                    const tray = matchingTrays[0];
                    const trayName = tray.name || `Tray ${tray.id.slice(-4)}`;
                    
                    // Check for facility/surgeon conflicts using centralized function
                    const warnings = this.getConflictWarnings(tray, caseFacility, caseSurgeon);
                    
                    if (warnings.length > 0) {
                        conflictWarnings.push(`${trayName}: ${warnings.join(', ')}`);
                    }
                    
                    // Update tray with case details
                    await this.dataManager.updateTray(tray.id, {
                        status: TRAY_STATUS.IN_USE,
                        assignedCaseId: caseId,
                        facility: caseFacility,
                        surgeon: caseSurgeon,
                        caseDate: caseData.scheduledDate,
                        checkedInAt: new Date().toISOString(),
                        checkedInBy: window.app.authManager.getCurrentUser()?.uid || 'unknown',
                        // Add facility coordinates if available
                        ...(facilityCoordinates && {
                            latitude: facilityCoordinates.latitude,
                            longitude: facilityCoordinates.longitude,
                            locationSource: facilityCoordinates.source,
                            locationTimestamp: new Date().toISOString()
                        })
                    });
                    
                    // Add activity history entry for mass check-in
                    const facilityName = this.getFacilityName(caseFacility) || caseFacility || 'Unknown Facility';
                    const physicianName = this.getSurgeonName(caseSurgeon) || caseSurgeon || 'Unknown Physician';
                    await this.dataManager.addHistoryEntry(
                        tray.id,
                        'checkin',
                        `Mass checked in to ${facilityName} for case on ${caseData.scheduledDate} with ${physicianName}`,
                        null
                    );
                    
                    checkedInTrays.push({
                        name: trayName,
                        id: tray.id
                    });
                } else {
                    // Find the tray to get its name and status (even if not available)
                    const tray = allTrays.find(t => t.tray_id === requirement.tray_id || t.id === requirement.tray_id);
                    const trayName = tray?.name || requirement.tray_name || `Tray ${requirement.tray_id?.slice(-4) || 'Unknown'}`;
                    
                    let reason = 'Tray not found';
                    if (tray) {
                        if (isCheckedInStatus(tray.status)) {
                            // Show additional info for checked-in trays
                            const assignedTo = tray.assignedCaseId ? 
                                ` (assigned to case ${tray.assignedCaseId.slice(-4)})` : '';
                            const trayFacilityName = this.getFacilityName(tray.facility_id || tray.facility);
                            const facilityInfo = trayFacilityName ? ` at ${trayFacilityName}` : '';
                            reason = `Already checked-in${assignedTo}${facilityInfo}`;
                        } else {
                            reason = `Status: ${tray.status}`;
                        }
                    }
                    
                    unavailableTrays.push({
                        name: trayName,
                        reason: reason
                    });
                }
            }

            // Build comprehensive notification message
            let message = '';
            
            // Success section
            if (checkedInTrays.length > 0) {
                const trayNames = checkedInTrays.map(t => t.name).join(', ');
                message += `<div class="mb-2">
                    <strong class="text-success">✅ Successfully checked in ${checkedInTrays.length} tray${checkedInTrays.length > 1 ? 's' : ''}:</strong><br>
                    <span class="fw-bold">${trayNames}</span>
                </div>`;
                if (caseFacility || caseSurgeon) {
                    message += `<div class="text-muted small">
                        → Assigned to: <strong>${caseSurgeon || 'Unknown Surgeon'}</strong> at <strong>${caseFacility || 'Unknown Facility'}</strong>
                    </div>`;
                }
            }
            
            // Conflict warnings
            if (conflictWarnings.length > 0) {
                if (message) message += '<div class="mt-3"></div>';
                message += `<div class="alert alert-warning small mb-0">
                    <strong>⚠️ Assignment conflicts resolved:</strong><br>
                    ${conflictWarnings.map(warning => `<div class="ms-2">• ${warning}</div>`).join('')}
                </div>`;
            }
            
            // Unavailable trays
            if (unavailableTrays.length > 0) {
                if (message) message += '<div class="mt-3"></div>';
                message += `<div class="alert alert-danger small mb-0">
                    <strong>❌ Could not check in ${unavailableTrays.length} tray${unavailableTrays.length > 1 ? 's' : ''}:</strong><br>
                    ${unavailableTrays.map(t => `<div class="ms-2">• <strong>${t.name}</strong> - ${t.reason}</div>`).join('')}
                </div>`;
            }

            if (checkedInTrays.length === 0 && unavailableTrays.length === 0) {
                message = 'No trays found to check in';
            }

            // Show appropriate notification based on results
            if (checkedInTrays.length > 0 && unavailableTrays.length === 0 && conflictWarnings.length === 0) {
                this.showSuccessNotification(message);
            } else if (checkedInTrays.length > 0) {
                this.showWarningNotification(message);
            } else {
                this.showErrorNotification(message);
            }

            // Update case timestamp for real-time sync (harmless timestamp update)
            if (checkedInTrays.length > 0) {
                try {
                    await this.dataManager.updateCase(caseId, {
                        lastTrayUpdate: new Date().toISOString()
                    });
                } catch (error) {
                    // Silent fail for non-critical timestamp update
                }
            }

            // Refresh the dashboard to show updated status
            await this.loadUpcomingCases();

        } catch (error) {
            console.error('Error checking in trays:', error);
            this.showErrorNotification('Error checking in trays: ' + error.message);
        }
    }

    getEmptyState() {
        const filterLabels = {
            'today': 'today',
            'tomorrow': 'tomorrow', 
            'week': 'this week',
            'month': 'this month',
            'recent': 'the last 7 days',
            'past': 'the past'
        };

        const isPastFilter = this.dateFilter === 'recent' || this.dateFilter === 'past';
        const emptyTitle = isPastFilter ? 'No Cases Found' : 'No Cases Scheduled';
        const emptyMessage = isPastFilter ? 
            `No cases found for ${filterLabels[this.dateFilter] || 'the selected period'}` :
            `No cases scheduled for ${filterLabels[this.dateFilter] || 'the selected period'}`;
        
        return `
            <div class="empty-state">
                <i class="fas fa-calendar-${isPastFilter ? 'times' : 'plus'} fa-3x text-muted mb-3"></i>
                <h4>${emptyTitle}</h4>
                <p class="text-muted">${emptyMessage}</p>
                ${!isPastFilter ? `
                    <button class="btn btn-primary btn-sm mt-2" onclick="window.app.modalManager.showAddCaseModal()">
                        <i class="fas fa-plus"></i> Schedule Case
                    </button>
                ` : ''}
            </div>
        `;
    }

    showErrorState() {
        const container = document.getElementById('dashboardCasesContent');
        if (!container) return;

        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h4>Error Loading Cases</h4>
                <p class="text-muted">Unable to load upcoming cases</p>
                <button class="btn btn-secondary btn-sm mt-2" onclick="window.app.dashboardManager.loadUpcomingCases()">
                    <i class="fas fa-refresh"></i> Retry
                </button>
            </div>
        `;
    }

    // Initialize dashboard when data is ready
    async initialize() {
        // Wait for essential data to load
        const maxWait = 50; // 5 seconds max
        let attempts = 0;
        
        while (attempts < maxWait) {
            const surgeons = this.dataManager.getSurgeons();
            const facilities = this.dataManager.getFacilities();
            const caseTypes = this.dataManager.getCaseTypes();
            
            if (surgeons !== null && facilities !== null && caseTypes !== null) {
                console.log('✅ Dashboard: Essential data loaded, loading upcoming cases');
                
                // Initialize case status dropdown
                this.initializeCaseStatusDropdown();
                
                this.updateSectionTitle();
                this.loadUpcomingCases();
                this.setupDataListeners();
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.warn('⚠️ Dashboard: Timeout waiting for essential data, loading cases anyway');
        this.updateSectionTitle();
        this.loadUpcomingCases();
        this.setupDataListeners();
    }

    // Method to refresh dashboard when case data changes
    async refresh() {
        if (document.getElementById('dashboardCasesContent')) {
            this.updateSectionTitle();
            await this.loadUpcomingCases();
        }
    }

    // Setup listeners for data updates to refresh dashboard
    setupDataListeners() {
        // Listen for case updates from the cases manager
        if (window.app && window.app.casesManager) {
            const originalHandleCasesUpdate = window.app.casesManager.handleCasesUpdate;
            window.app.casesManager.handleCasesUpdate = (cases) => {
                originalHandleCasesUpdate.call(window.app.casesManager, cases);
                // Refresh dashboard with updated data
                this.refresh();
            };
        }
    }

    // Notification methods
    showSuccessNotification(message) {
        if (window.app?.notificationManager) {
            window.app.notificationManager.show(message, 'success');
        } else {
            alert(`Success: ${message}`);
        }
    }

    showErrorNotification(message) {
        if (window.app?.notificationManager) {
            window.app.notificationManager.show(message, 'error');
        } else {
            alert(`Error: ${message}`);
        }
    }

    showWarningNotification(message) {
        if (window.app?.notificationManager) {
            window.app.notificationManager.show(message, 'warning');
        } else {
            alert(`Warning: ${message}`);
        }
    }

    showInfoNotification(message) {
        if (window.app?.notificationManager) {
            window.app.notificationManager.show(message, 'info');
        } else {
            alert(`Info: ${message}`);
        }
    }

    handleCasesUpdate(cases) {
        console.log('🔄 DashboardManager.handleCasesUpdate() called with', cases.length, 'cases');
        
        // Store the updated cases data
        this.cases = cases;
        
        // Refresh dashboard if currently viewing dashboard
        if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
            console.log('✅ Refreshing dashboard cases section with updated data');
            // Add small delay to ensure DOM is ready
            setTimeout(() => {
                this.refresh();
            }, 100);
        }
    }
    
    initializeCaseStatusDropdown() {
        const statusFilter = document.getElementById('dashboardCasesStatusFilter');
        if (statusFilter) {
            populateCaseStatusDropdown(statusFilter, {
                includeAllOption: true,
                allOptionText: 'All Status'
            });
            console.log('✅ Dashboard: Case status dropdown initialized');
        } else {
            console.warn('⚠️ Dashboard: Case status dropdown element not found');
        }
    }
}