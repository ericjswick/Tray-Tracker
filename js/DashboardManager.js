/**
 * Dashboard Manager - Handles dashboard functionality including upcoming cases
 */
import { CASE_STATUS, CASE_STATUS_OPTIONS, getCaseStatusClass, populateCaseStatusDropdown } from './constants/CaseStatus.js';
import { TRAY_STATUS, normalizeStatus, isInUseStatus, isAvailableStatus, isCheckedInStatus, getStatusDisplayText } from './constants/TrayStatus.js';

export class DashboardManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentCases = [];
        this.dateFilter = 'upcoming';
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
            'week': 'This Week\'s Cases',
            'upcoming': 'Upcoming Cases',
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

            // Limit dashboard to 20 cases for better performance
            const limitedCases = filteredCases.slice(0, 20);

            // Store the filtered cases for use by other methods like automatedBulkCheckInForCase
            this.currentCases = limitedCases;

            await this.renderDashboardCases(limitedCases);
        } catch (error) {
            console.error('Error loading dashboard cases:', error);
            this.showErrorState();
        }
    }

    filterCasesByDate(cases, filterType) {
        // Use string-based date comparison to avoid timezone issues
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        const filtered = cases.filter(caseItem => {
            const caseDate = caseItem.scheduledDate; // Already in YYYY-MM-DD format

            switch (filterType) {
                case 'today':
                    return caseDate === today;

                case 'tomorrow':
                    const tomorrowDate = new Date();
                    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                    const tomorrow = tomorrowDate.toISOString().split('T')[0];
                    return caseDate === tomorrow;

                case 'week':
                    const weekEndDate = new Date();
                    weekEndDate.setDate(weekEndDate.getDate() + 7);
                    const weekEnd = weekEndDate.toISOString().split('T')[0];
                    return caseDate >= today && caseDate <= weekEnd;

                case 'upcoming':
                    return caseDate >= today;
                
                case 'month':
                    const monthEndDate = new Date();
                    monthEndDate.setMonth(monthEndDate.getMonth() + 1);
                    const monthEnd = monthEndDate.toISOString().split('T')[0];
                    return caseDate >= today && caseDate <= monthEnd;

                case 'recent':
                    // Last 7 days (past cases)
                    const sevenDaysAgoDate = new Date();
                    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
                    const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];
                    return caseDate >= sevenDaysAgo && caseDate < today;

                case 'past':
                    // All past cases
                    return caseDate < today;
                
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
        if (!container) {
            console.warn('❌ dashboardCasesContent container not found');
            return;
        }


        if (cases.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }

        // Render all cases passed to this function (already limited to 20 in loadUpcomingCases)
        const cardsHTML = await Promise.all(
            cases.map(caseItem => this.renderCaseCard(caseItem))
        );
        container.innerHTML = cardsHTML.join('');
    }

    async renderCaseCard(caseItem) {
        const facilities = this.dataManager.getFacilities();
        const caseTypes = this.dataManager.getCaseTypes();

        // Use the same getSurgeonName method that works everywhere else
        const surgeonName = this.getSurgeonName(caseItem.physician_id);
        const facility = facilities.find(f => f && f.id === caseItem.facility_id);
        const caseType = caseTypes.find(ct => ct && ct.id === caseItem.caseTypeId);
        
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
                        <span class="tray-detail-value">${surgeonName || 'Unknown Physician'}</span>
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
                        <button class="btn btn-sm btn-outline-primary" onclick="window.app.dashboardManager.showManualCheckInModal('${caseItem.id}')" title="Select Trays to Check In">
                            <i class="fas fa-hand-pointer"></i> Check In
                        </button>
                    ` : ''}
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
            
            // Step 2: Log tray requirements field
            if (window.is_enable_api_logging && window.frontendLogger && (caseData.id?.includes('aa') || caseData.patientName?.includes('aa'))) {
                window.frontendLogger.error(`🔍 STEP 2: Checking tray_requirements field`, {
                    caseId: caseData.id,
                    hasTrayRequirements: !!caseData.tray_requirements,
                    trayRequirementsLength: Array.isArray(caseData.tray_requirements) ? caseData.tray_requirements.length : 'NOT_ARRAY',
                    trayRequirementsValue: caseData.tray_requirements
                });
            }
            
            // Use only tray_requirements field (underscore format)
            let requirements = caseData.tray_requirements || [];
            
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
                hasTrayRequirements: !!caseItem.tray_requirements
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
            }).catch(e => {});
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
                        }).catch(e => {});
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
                            }).catch(e => {});
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
                                }).catch(e => {});
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
                                    }).catch(e => {});
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
                                }).catch(e => {});
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
            }).catch(e => {});
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
            const facilities = window.app.facilityManager.currentFacilities;
            const facility = facilities.find(f => f.id === facilityId);
            
            if (facility) {
                return facility.account_name || facility.name || facilityId;
            } else {
                // Try to find by partial match or name
                const partialMatch = facilities.find(f => 
                    f.account_name?.includes(facilityId) || 
                    f.name?.includes(facilityId) ||
                    facilityId.includes(f.id)
                );
                
                if (partialMatch) {
                    return `${partialMatch.account_name || partialMatch.name} (matched)`;
                }
                
                return `Unknown Facility (${facilityId.substring(0, 8)}...)`; // Shortened ID for display
            }
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

    getCaseTypeName(caseTypeId) {
        if (!caseTypeId) return 'N/A';

        // Try to find case type by ID
        const caseTypes = this.dataManager.getCaseTypes();
        if (caseTypes) {
            const caseType = caseTypes.find(ct => ct.id === caseTypeId);
            return caseType ? caseType.name : caseTypeId;
        }

        return caseTypeId; // Fallback to original value
    }

    async renderTrayRequirementsStatus(caseItem) {
        try {
            // Get tray requirements for the case
            const requirements = this.getTrayRequirements(caseItem);

            if (requirements.length === 0) {
                return 'No Trays Required';
            }

            // Calculate days until case starts
            const caseDate = new Date(caseItem.scheduledDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison
            caseDate.setHours(0, 0, 0, 0);
            const daysUntilCase = Math.ceil((caseDate - today) / (1000 * 60 * 60 * 24));

            // Get all available trays to match with requirements
            const allTrays = await this.dataManager.getAllTrays();
            const trayDisplays = [];
            let hasUnavailableTrays = false;

            // Calculate warning colors based on days until case
            const isWithin2Days = daysUntilCase <= 2;
            const unavailableColor = isWithin2Days ? '#dc3545' : '#ffc107'; // Red if within 2 days, yellow otherwise

            // Process each requirement to show tray name and status
            for (const requirement of requirements) {
                let trayName = 'Unknown Tray';
                let status = 'Not Found';
                let statusColor = unavailableColor; // Use warning color for not found
                let statusIcon = 'fas fa-times-circle';
                let isUnavailable = true;

                // Debug: Show what requirements we're processing

                // Find the matching tray
                const matchingTray = allTrays.find(tray =>
                    (tray.tray_id === requirement.tray_id || tray.id === requirement.tray_id)
                );

                if (matchingTray) {
                    trayName = matchingTray.name || matchingTray.tray_name || `Tray ${matchingTray.id.slice(-4)}`;

                    // Determine status display based on tray status (normalize to handle both formats)
                    const normalizedStatus = normalizeStatus(matchingTray.status);
                    switch (normalizedStatus) {
                        case TRAY_STATUS.AVAILABLE:
                            status = getStatusDisplayText(normalizedStatus); // Use central function
                            statusColor = '#28a745'; // Green
                            statusIcon = 'fas fa-check-circle';
                            isUnavailable = false;
                            break;
                        case TRAY_STATUS.IN_USE:
                        case TRAY_STATUS.CHECKED_IN:
                            // Check if tray is assigned to this case OR has matching facility/physician
                            const trayFacility = matchingTray.facility_id || matchingTray.facility;
                            const traySurgeon = matchingTray.physician_id || matchingTray.surgeon;
                            const caseFacility = caseItem.facility_id || caseItem.facility;
                            const caseSurgeon = caseItem.physician_id || caseItem.surgeon;
                            const facilityMatches = trayFacility && caseFacility && trayFacility === caseFacility;
                            const surgeonMatches = traySurgeon && caseSurgeon && traySurgeon === caseSurgeon;


                            if (matchingTray.assignedCaseId === caseItem.id || (facilityMatches && surgeonMatches)) {
                                status = 'Checked In And Ready'; // Updated to show new status
                                statusColor = '#28a745'; // Green
                                statusIcon = 'fas fa-check-circle';
                                isUnavailable = false;
                            } else {
                                status = getStatusDisplayText(normalizedStatus); // Use central function for other cases
                                statusColor = unavailableColor; // Use warning color
                                statusIcon = 'fas fa-exclamation-triangle';
                                hasUnavailableTrays = true;
                            }
                            break;
                        case TRAY_STATUS.PICKED_UP:
                            // Check if tray is for this case
                            const trayFacilityPickup = matchingTray.facility_id || matchingTray.facility;
                            const traySurgeonPickup = matchingTray.physician_id || matchingTray.surgeon;
                            const caseFacilityPickup = caseItem.facility_id || caseItem.facility;
                            const caseSurgeonPickup = caseItem.physician_id || caseItem.surgeon;
                            const facilityMatchesPickup = trayFacilityPickup && caseFacilityPickup && trayFacilityPickup === caseFacilityPickup;
                            const surgeonMatchesPickup = traySurgeonPickup && caseSurgeonPickup && traySurgeonPickup === caseSurgeonPickup;

                            if (matchingTray.assignedCaseId === caseItem.id || (facilityMatchesPickup && surgeonMatchesPickup)) {
                                status = getStatusDisplayText(normalizedStatus); // Use central function to show "Picked Up"
                                statusColor = '#6c757d'; // Gray
                                statusIcon = 'fas fa-clock';
                                isUnavailable = false;
                            } else {
                                status = getStatusDisplayText(normalizedStatus); // Use central function
                                statusColor = unavailableColor; // Use warning color if not for this case
                                statusIcon = 'fas fa-exclamation-triangle';
                                hasUnavailableTrays = true;
                            }
                            break;
                        default:
                            status = getStatusDisplayText(normalizedStatus); // Use central function
                            statusColor = unavailableColor; // Use warning color
                            statusIcon = 'fas fa-times-circle';
                            hasUnavailableTrays = true;
                    }
                } else if (requirement.tray_name) {
                    // Use tray name from requirement if tray not found in system
                    trayName = requirement.tray_name;
                    hasUnavailableTrays = true;
                }

                // Add clickable info icon for unavailable trays with escaped data
                const trayId = (matchingTray ? matchingTray.id : requirement.tray_id || '').replace(/'/g, "\\'");
                const escapedTrayName = trayName.replace(/'/g, "\\'");
                const escapedStatus = status.replace(/'/g, "\\'");
                const assignedCaseId = (matchingTray && matchingTray.assignedCaseId ? matchingTray.assignedCaseId : '').replace(/'/g, "\\'");
                const infoIcon = isUnavailable ? `<i class="fas fa-info-circle" style="color: ${statusColor}; margin-left: 8px; font-size: 0.9em; cursor: pointer;" onclick="window.app.dashboardManager.showTrayInfoPopup('${trayId}', '${escapedTrayName}', '${escapedStatus}', '${assignedCaseId}')" title="Tray details"></i>` : '';

                // Use status color for tray name to match icon and status text
                const trayNameColor = statusColor;

                trayDisplays.push(`
                    <div style="font-size: 1.4em; font-weight: 500; margin-bottom: 8px; display: flex; align-items: center;">
                        <i class="${statusIcon}" style="color: ${statusColor}; margin-right: 10px; font-size: 1em;"></i>
                        <span style="color: ${trayNameColor};">${trayName}</span>
                        <span style="margin-left: 10px; font-size: 1em; color: ${statusColor}; font-weight: 400;">(${status})</span>
                        ${infoIcon}
                    </div>
                `);
            }

            // Get case details for the info popup - escape single quotes for JavaScript safety
            const facilityName = (this.getFacilityName(caseItem.facility_id) || 'Unknown Facility').replace(/'/g, "\\'");
            const physicianName = (this.getSurgeonName(caseItem.physician_id) || 'Unknown Physician').replace(/'/g, "\\'");
            const caseTypeName = (this.getCaseTypeName(caseItem.caseTypeId) || 'Unknown Case Type').replace(/'/g, "\\'");
            const caseDateFormatted = caseItem.scheduledDate ?
                `${new Date(caseItem.scheduledDate).toLocaleDateString()}${caseItem.scheduledTime ? ' ' + caseItem.scheduledTime : ''}` : 'Unknown Date';
            const patientName = (caseItem.patientName || 'Unknown Patient').replace(/'/g, "\\'");

            // Determine warning display for unavailable trays
            let warningDisplay = '';
            if (hasUnavailableTrays) {
                const isWithin2Days = daysUntilCase <= 2;
                const warningColor = isWithin2Days ? '#dc3545' : '#ffc107'; // Red if within 2 days, yellow otherwise
                const warningIcon = isWithin2Days ? 'fas fa-exclamation-circle' : 'fas fa-exclamation-triangle';
                const warningText = isWithin2Days ? 'URGENT: Trays Unavailable' : 'Trays Unavailable';

                warningDisplay = `
                    <div style="display: flex; align-items: center; margin-bottom: 8px; font-size: 1.2em; font-weight: 600;">
                        <i class="${warningIcon}" style="color: ${warningColor}; margin-right: 8px;"></i>
                        <span style="color: ${warningColor};">${warningText}</span>
                    </div>
                `;
            }

            return `
                <div style="position: relative;">
                    <div style="flex-grow: 1;">
                        ${warningDisplay}
                        ${trayDisplays.join('')}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error rendering tray requirements status:', error);
            return 'Error loading tray status';
        }
    }

    showCaseInfoPopup(caseId, patientName, caseDate, physicianName, facilityName, caseTypeName) {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="caseInfoModal" tabindex="-1" role="dialog" aria-labelledby="caseInfoModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-sm" role="document">
                    <div class="modal-content">
                        <div class="modal-header bg-light">
                            <h5 class="modal-title" id="caseInfoModalLabel">
                                <i class="fas fa-info-circle text-info"></i> Case Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="case-info-details">
                                <div class="detail-row">
                                    <strong>Case Name:</strong>
                                    <span>${patientName}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Date:</strong>
                                    <span>${caseDate}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Physician:</strong>
                                    <span>${physicianName}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Case Type:</strong>
                                    <span>${caseTypeName}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Facility:</strong>
                                    <span>${facilityName}</span>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .case-info-details .detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                .case-info-details .detail-row:last-child {
                    border-bottom: none;
                }
                .case-info-details .detail-row strong {
                    color: #495057;
                    font-weight: 600;
                    flex-shrink: 0;
                    margin-right: 15px;
                }
                .case-info-details .detail-row span {
                    text-align: right;
                    color: #333;
                    flex-grow: 1;
                    word-break: break-word;
                }
            </style>
        `;

        // Remove existing modal if it exists
        const existingModal = document.getElementById('caseInfoModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('caseInfoModal'));
        modal.show();

        // Clean up modal after it's hidden
        document.getElementById('caseInfoModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    async showTrayInfoPopup(trayId, trayName, status, assignedCaseId) {
        // Get case information if tray is assigned to another case
        let caseInfo = null;
        console.log('Tray popup debug:', { trayId, trayName, status, assignedCaseId });

        if (assignedCaseId) {
            try {
                const allCases = await this.dataManager.getAllCases();
                const assignedCase = allCases.find(c => c.id === assignedCaseId);
                console.log('Found assigned case:', assignedCase);

                if (assignedCase) {
                    caseInfo = {
                        patientName: assignedCase.patientName || 'Unknown Patient',
                        date: assignedCase.scheduledDate ?
                            `${new Date(assignedCase.scheduledDate).toLocaleDateString()}${assignedCase.scheduledTime ? ' ' + assignedCase.scheduledTime : ''}` : 'Unknown Date',
                        physician: this.getSurgeonName(assignedCase.physician_id) || 'Unknown Physician',
                        facility: this.getFacilityName(assignedCase.facility_id) || 'Unknown Facility',
                        caseType: this.getCaseTypeName(assignedCase.caseTypeId) || 'Unknown Case Type'
                    };
                    console.log('Created case info:', caseInfo);
                }
            } catch (error) {
                console.error('Error fetching case information:', error);
            }
        }

        // Create modal HTML for tray details
        const modalHtml = `
            <div class="modal fade" id="trayInfoModal" tabindex="-1" role="dialog" aria-labelledby="trayInfoModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-sm" role="document">
                    <div class="modal-content">
                        <div class="modal-header bg-light">
                            <h5 class="modal-title" id="trayInfoModalLabel">
                                <i class="fas fa-toolbox text-info"></i> Tray Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="tray-info-details">
                                ${caseInfo ? `
                                    <div class="detail-row">
                                        <strong>Case Name:</strong>
                                        <span>${caseInfo.patientName}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Date:</strong>
                                        <span>${caseInfo.date}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Location:</strong>
                                        <span>${caseInfo.facility}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Physician:</strong>
                                        <span>${caseInfo.physician}</span>
                                    </div>
                                ` : `
                                    <div class="detail-row">
                                        <strong>Tray Name:</strong>
                                        <span>${trayName}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Status:</strong>
                                        <span>${status}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Issue:</strong>
                                        <span>${status === 'Not Found' ? 'Tray not found in system inventory' :
                                               'Tray is currently unavailable'}</span>
                                    </div>
                                `}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .tray-info-details .detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                .tray-info-details .detail-row:last-child {
                    border-bottom: none;
                }
                .tray-info-details .detail-row strong {
                    color: #495057;
                    font-weight: 600;
                    flex-shrink: 0;
                    margin-right: 15px;
                }
                .tray-info-details .detail-row span {
                    text-align: right;
                    color: #333;
                    flex-grow: 1;
                    word-break: break-word;
                }
            </style>
        `;

        // Remove existing modal if it exists
        const existingModal = document.getElementById('trayInfoModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('trayInfoModal'));
        modal.show();

        // Clean up modal after it's hidden
        document.getElementById('trayInfoModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
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
    async automatedBulkCheckInForCase(caseId) {
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
                    
                    // Get current user for automatic assignment
                    const currentUser = window.app.authManager.getCurrentUser();
                    const currentUserId = currentUser?.uid || 'unknown';
                    
                    // Update tray with case details
                    await this.dataManager.updateTray(tray.id, {
                        status: TRAY_STATUS.CHECKED_IN,
                        assignedCaseId: caseId,
                        facility: caseFacility,
                        surgeon: caseSurgeon,
                        caseDate: caseData.scheduledDate,
                        checkedInAt: new Date().toISOString(),
                        checkedInBy: currentUserId,
                        // Automatically assign tray to current user on dashboard checkin
                        assignedTo: currentUserId,
                        // Add facility coordinates if available
                        ...(facilityCoordinates && {
                            latitude: facilityCoordinates.latitude,
                            longitude: facilityCoordinates.longitude,
                            locationSource: facilityCoordinates.source,
                            locationTimestamp: new Date().toISOString()
                        })
                    });
                    
                    // Add activity history entry for mass check-in with assignment info
                    const facilityName = this.getFacilityName(caseFacility) || caseFacility || 'Unknown Facility';
                    const physicianName = this.getSurgeonName(caseSurgeon) || caseSurgeon || 'Unknown Physician';
                    const userName = currentUser?.name || currentUser?.email || 'Unknown User';
                    const dashboardHistoryMessage = `Mass checked in to ${facilityName} for case on ${caseData.scheduledDate} with ${physicianName}. Automatically assigned to ${userName}.`;
                    
                    await this.dataManager.addHistoryEntry(
                        tray.id,
                        'checkin',
                        dashboardHistoryMessage,
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

    // Show manual check-in modal for selecting trays and taking photos
    async showManualCheckInModal(caseId) {
        try {
            // Find the case data
            let caseData = this.currentCases.find(c => c.id === caseId);
            if (!caseData) {
                const allCases = await this.dataManager.getAllCases();
                caseData = allCases.find(c => c.id === caseId);
            }

            if (!caseData) {
                this.showErrorNotification('Case not found');
                return;
            }

            // Get tray requirements for the case
            const requirements = this.getTrayRequirements(caseData);
            if (requirements.length === 0) {
                this.showInfoNotification('No tray requirements found for this case');
                return;
            }

            // Get all available trays
            const allTrays = await this.dataManager.getAllTrays();

            // Show the manual check-in modal
            this.displayManualCheckInModal(caseData, requirements, allTrays);

        } catch (error) {
            console.error('Error showing manual check-in modal:', error);
            this.showErrorNotification('Error loading manual check-in: ' + error.message);
        }
    }

    // Display the manual check-in modal with tray selection and photo options
    displayManualCheckInModal(caseData, requirements, allTrays) {
        const modalHtml = '<div class="modal fade" id="manualCheckInModal" tabindex="-1" role="dialog" aria-labelledby="manualCheckInModalLabel" aria-hidden="true">' +
            '<div class="modal-dialog modal-xl" role="document">' +
                '<div class="modal-content">' +
                    '<div class="modal-header">' +
                        '<h5 class="modal-title" id="manualCheckInModalLabel">' +
                            '<i class="fas fa-hand-pointer"></i> Check In - ' + (caseData.case_type || 'Case') +
                        '</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" onclick="window.app.dashboardManager.closeManualCheckInModal()"></button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        '<div class="case-info mb-4">' +
                            '<div class="row">' +
                                '<div class="col-md-4">' +
                                    '<h6><i class="fas fa-calendar"></i> Case Information</h6>' +
                                    '<p><strong>Date:</strong> ' + (caseData.scheduledDate || 'N/A') + '</p>' +
                                    '<p><strong>Time:</strong> ' + (caseData.scheduledTime || 'N/A') + '</p>' +
                                '</div>' +
                                '<div class="col-md-4">' +
                                    '<p><strong>Physician:</strong> ' + this.getSurgeonName(caseData.physician_id) + '</p>' +
                                    '<p><strong>Facility:</strong> ' + this.getFacilityName(caseData.facility_id) + '</p>' +
                                '</div>' +
                                '<div class="col-md-4">' +
                                    '<p><strong>Case name:</strong> ' + (caseData.patientName || 'N/A') + '</p>' +
                                    '<p><strong>Case Type:</strong> ' + this.getCaseTypeName(caseData.caseTypeId) + '</p>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<h6><i class="fas fa-box"></i> Tray Requirements (' + requirements.length + ' trays)</h6>' +
                        '<div id="manualTrayList" class="tray-requirements-list">' +
                            this.generateManualTrayRows(requirements, allTrays, caseData.caseTypeId || caseData.case_type_id) +
                        '</div>' +

                        '<div class="mt-4 border-top pt-4">' +
                            '<h6><i class="fas fa-plus"></i> Additional Trays</h6>' +
                            '<p class="text-muted mb-3">Select additional trays to check in and add to case requirements:</p>' +
                            '<div class="row">' +
                                '<div class="col-md-8">' +
                                    '<label for="additionalTraySelect" class="form-label">Select Additional Tray:</label>' +
                                    '<select class="form-control" id="additionalTraySelect">' +
                                        '<option value="">Choose an additional tray...</option>' +
                                        this.generateAdditionalTrayOptions(allTrays, caseData.caseTypeId || caseData.case_type_id) +
                                    '</select>' +
                                '</div>' +
                                '<div class="col-md-4 d-flex align-items-end">' +
                                    '<button type="button" class="btn btn-outline-primary" onclick="window.app.dashboardManager.addAdditionalTray()">' +
                                        '<i class="fas fa-plus"></i> Add Tray' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div id="additionalTraysList" class="mt-3">' +
                                '<!-- Additional selected trays will appear here -->' +
                            '</div>' +
                        '</div>' +

                        '<div class="mt-4 border-top pt-4">' +
                            '<h6><i class="fas fa-camera"></i> Photos for All Checked-In Trays</h6>' +
                            '<p class="text-muted mb-3">These photos will be added to the history of all checked-in trays:</p>' +

                            '<div class="mb-3">' +
                                '<button type="button" class="btn btn-outline-primary btn-sm" onclick="window.app.dashboardManager.addPhotoSlot()">' +
                                    '<i class="fas fa-plus"></i> Add Photo' +
                                '</button>' +
                            '</div>' +

                            '<div id="globalPhotoContainer">' +
                                // Initial photo slot will be added by JavaScript
                            '</div>' +
                        '</div>' +

                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal" onclick="window.app.dashboardManager.closeManualCheckInModal()">Cancel</button>' +
                        '<button type="button" class="btn btn-primary" onclick="window.app.dashboardManager.processManualCheckIn(\'' + caseData.id + '\')">' +
                            '<i class="fas fa-check"></i> Check In Selected Trays' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

        // Remove existing modal if present
        const existingModal = document.getElementById('manualCheckInModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal using Bootstrap's JavaScript API
        const modal = document.getElementById('manualCheckInModal');
        if (window.bootstrap && window.bootstrap.Modal) {
            // Bootstrap 5
            const bootstrapModal = new window.bootstrap.Modal(modal);
            bootstrapModal.show();
        } else if (window.Modal) {
            // Bootstrap 4/5 alternative
            const bootstrapModal = new window.Modal(modal);
            bootstrapModal.show();
        } else {
            // Fallback - add show class manually
            modal.classList.add('show');
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');

            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'manualCheckInBackdrop';
            document.body.appendChild(backdrop);
        }

        // Set up photo preview functionality
        this.setupManualCheckInPhotoPreview();
    }

    setupManualCheckInPhotoPreview() {
        // Initialize with one photo slot
        this.globalPhotoCounter = 0;
        this.addPhotoSlot();
    }

    addPhotoSlot() {
        this.globalPhotoCounter++;
        const photoId = `globalPhoto${this.globalPhotoCounter}`;

        const photoSlotHtml = `
            <div class="photo-slot mb-4 p-3 border rounded" id="${photoId}Container">
                <div class="row">
                    <div class="col-md-8">
                        <label class="form-label">Photo ${this.globalPhotoCounter}</label>
                        <div class="camera-container">
                            <video id="${photoId}Camera" class="d-none" autoplay></video>
                            <canvas id="${photoId}Canvas" class="d-none"></canvas>
                            <div class="photo-controls mb-2">
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="app.photoManager.startCamera('${photoId}')">
                                    <i class="fas fa-camera"></i> Take Photo
                                </button>
                                <input type="file" class="form-control mt-2" id="${photoId}File" accept="image/*" onchange="app.photoManager.handleFileSelect('${photoId}', this)">
                            </div>
                        </div>
                        <input type="text" class="form-control" id="${photoId}Note" placeholder="Add a note for this photo (optional)">
                    </div>
                    <div class="col-md-4 text-end">
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="window.app.dashboardManager.removePhotoSlot('${photoId}Container')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
                <div id="${photoId}Preview" class="photo-preview mt-3"></div>
            </div>
        `;

        const container = document.getElementById('globalPhotoContainer');
        if (container) {
            container.insertAdjacentHTML('beforeend', photoSlotHtml);

            // Set up event listener for file input (not the camera button, that's handled by PhotoManager)
            const fileInput = document.getElementById(`${photoId}File`);
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    this.handlePhotoPreview(e, document.getElementById(`${photoId}Preview`));
                });
            }
        }
    }

    removePhotoSlot(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.remove();
        }
    }

    // Direct photo upload method as fallback
    async uploadPhotoDirectly(file, folder = 'tray-checkin-photos') {
        try {
            // Get Firebase storage from the global app
            const storage = window.app?.storage;
            if (!storage) {
                console.error('Firebase storage not available');
                return null;
            }

            // Import Firebase storage functions dynamically
            const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js");

            const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const storageRef = ref(storage, fileName);

            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return downloadURL;
        } catch (error) {
            console.error('Direct photo upload error:', error);
            return null;
        }
    }

    handlePhotoPreview(event, previewContainer) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewContainer.innerHTML = `
                    <div class="position-relative d-inline-block">
                        <img src="${e.target.result}" class="img-thumbnail" style="max-height: 200px;">
                        <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0"
                                onclick="this.parentElement.parentElement.innerHTML = ''; this.parentElement.parentElement.previousElementSibling.value = '';"
                                title="Remove photo">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            previewContainer.innerHTML = '';
        }
    }

    // Generate tray rows for manual selection
    generateManualTrayRows(requirements, allTrays, caseTypeId = null) {
        return requirements.map((req, index) => {
            // Filter trays by case type compatibility if case type is available
            let filteredTrays = allTrays;
            if (caseTypeId && window.app?.dataManager?.filterForTrayCompatibilityType) {
                filteredTrays = window.app.dataManager.filterForTrayCompatibilityType(caseTypeId, allTrays);
                console.log(`🎯 Check-in: Filtered ${allTrays.length} trays to ${filteredTrays.length} compatible trays for case type: ${caseTypeId}`);
            }

            // Sort filtered trays alphabetically
            const sortedTrays = [...filteredTrays].sort((a, b) => {
                const nameA = (a.tray_name || a.name || a.tray_id || '').toLowerCase();
                const nameB = (b.tray_name || b.name || b.tray_id || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            const trayOptions = sortedTrays.map(tray => {
                const isCheckedIn = tray.status === TRAY_STATUS.IN_USE || tray.status === TRAY_STATUS.CHECKED_IN;
                const statusText = isCheckedIn ? ' (Already Checked In)' : ' (' + (tray.status || 'Available') + ')';
                const isRecommended = (tray.tray_id === req.tray_id || tray.id === req.tray_id);

                return '<option value="' + (tray.id || tray.tray_id) + '" data-tray-name="' + (tray.tray_name || tray.name || tray.tray_id) + '" ' +
                    (isCheckedIn ? 'disabled' : '') + (isRecommended ? ' selected' : '') + '>' +
                    (isRecommended ? '⭐ ' : '') + (tray.tray_name || tray.name || tray.tray_id) + ' - ' + (tray.location || 'Unknown Location') + statusText +
                '</option>';
            }).join('');

            const statusMessage = '<small class="text-info"><i class="fas fa-exchange-alt"></i> Select any tray to check in (⭐ = recommended for this case)</small>';

            return '<div class="tray-requirement-row mb-4 p-3 border rounded" data-requirement-index="' + index + '">' +
                '<div class="row">' +
                    '<div class="col-md-6">' +
                        '<h6 class="text-primary">' + (req.tray_name || req.tray_id) + '</h6>' +
                        '<p class="text-muted mb-1">Required: ' + (req.requirement_type || 'Standard') + '</p>' +
                        '<div class="custom-control custom-checkbox">' +
                            '<input type="checkbox" class="custom-control-input tray-select-checkbox" id="selectTray_' + index + '" checked>' +
                            '<label class="custom-control-label" for="selectTray_' + index + '">' +
                                'Check In This Tray' +
                            '</label>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-md-6">' +
                        '<label for="traySelect_' + index + '" class="form-label">Select Tray:</label>' +
                        '<select class="form-control tray-selector" id="traySelect_' + index + '" onchange="window.app.dashboardManager.updateTraySelection(' + index + ')">' +
                            '<option value="">Choose tray...</option>' +
                            trayOptions +
                        '</select>' +
                        statusMessage +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }


    // Process manual check-in with selected trays and photos
    async processManualCheckIn(caseId) {
        try {
            const selectedTrays = [];
            const trayRows = document.querySelectorAll('.tray-requirement-row');

            // Collect selected trays
            trayRows.forEach((row, index) => {
                const checkbox = row.querySelector('.tray-select-checkbox');
                const traySelector = row.querySelector('.tray-selector');

                if (checkbox.checked && traySelector.value) {
                    selectedTrays.push({
                        trayId: traySelector.value,
                        trayName: traySelector.options[traySelector.selectedIndex].dataset.trayName,
                        requirementIndex: index,
                        isAdditional: false
                    });
                }
            });

            // Collect additional trays
            const additionalTrayItems = document.querySelectorAll('.additional-tray-item');
            additionalTrayItems.forEach((item) => {
                const trayId = item.getAttribute('data-additional-tray-id');
                const trayName = item.querySelector('strong').textContent;

                selectedTrays.push({
                    trayId: trayId,
                    trayName: trayName,
                    requirementIndex: -1, // Mark as additional tray
                    isAdditional: true
                });
            });

            if (selectedTrays.length === 0) {
                this.showWarningNotification('Please select at least one tray to check in');
                return;
            }

            // Find the case data
            let caseData = this.currentCases.find(c => c.id === caseId);
            if (!caseData) {
                const allCases = await this.dataManager.getAllCases();
                caseData = allCases.find(c => c.id === caseId);
            }

            if (!caseData) {
                this.showErrorNotification('Case not found');
                return;
            }

            // Collect and upload all global photos with their notes
            const globalPhotos = [];
            const photoSlots = document.querySelectorAll('.photo-slot');
            console.log(`🔍 Found ${photoSlots.length} photo slots`);

            for (let i = 0; i < photoSlots.length; i++) {
                const slot = photoSlots[i];
                const photoInput = slot.querySelector('input[type="file"]');
                const noteInput = slot.querySelector('input[type="text"]');
                const note = noteInput ? noteInput.value.trim() : '';

                // Check if PhotoManager has a captured photo for this slot
                const photoId = slot.id.replace('Container', '');
                const hasPhotoManagerPhoto = window.app?.photoManager?.hasPhoto(photoId);

                let file = null;
                let photoSource = '';

                if (hasPhotoManagerPhoto) {
                    // Use PhotoManager captured photo
                    photoSource = 'camera';
                    console.log(`📷 Processing camera photo ${i + 1}, note: "${note}"`);
                } else if (photoInput && photoInput.files.length > 0) {
                    // Use file input photo
                    file = photoInput.files[0];
                    photoSource = 'file';
                    console.log(`📷 Processing file photo ${i + 1}: ${file.name}, size: ${file.size}, note: "${note}"`);
                }

                if (hasPhotoManagerPhoto || file) {
                    try {
                        let photoUrl = null;

                        if (hasPhotoManagerPhoto) {
                            // Upload PhotoManager photo
                            photoUrl = await window.app.photoManager.uploadPhoto(photoId, 'tray-checkin-photos');
                        } else if (file) {
                            // Upload file input photo
                            if (window.app?.photoManager) {
                                const tempPhotoContext = `globalPhoto_${Date.now()}_${i}`;
                                window.app.photoManager.capturedPhotos.set(tempPhotoContext, file);
                                photoUrl = await window.app.photoManager.uploadPhoto(tempPhotoContext, 'tray-checkin-photos');
                            } else {
                                photoUrl = await this.uploadPhotoDirectly(file, 'tray-checkin-photos');
                            }
                        }

                        if (photoUrl) {
                            globalPhotos.push({
                                url: photoUrl,
                                note: note
                            });
                            console.log(`📸 Global photo uploaded (${photoSource}): ${photoUrl} with note: "${note}"`);
                        }
                    } catch (photoError) {
                        console.error(`Failed to upload global photo:`, photoError);
                        // Continue with check-in even if photo upload fails
                    }
                }
            }

            console.log(`📊 Photo collection complete: ${globalPhotos.length} photos uploaded`);
            globalPhotos.forEach((photo, index) => {
                console.log(`  Photo ${index + 1}: ${photo.url}, note: "${photo.note}"`);
            });

            // Process check-in for each selected tray
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const tray of selectedTrays) {
                try {

                    // Get current user for assignment
                    const currentUser = window.app?.authManager?.getCurrentUser();
                    const currentUserId = currentUser?.uid || 'unknown';

                    // Update tray status and assignment (focus only on tray data)
                    await this.dataManager.updateTray(tray.trayId, {
                        status: TRAY_STATUS.CHECKED_IN,
                        assignedCaseId: caseId,
                        facility: caseData.facility_id,
                        surgeon: caseData.physician_id,
                        caseDate: caseData.scheduledDate,
                        assignedTo: currentUserId,
                        checkedInAt: new Date().toISOString(),
                        checkedInBy: currentUserId
                    });

                    // Create history message with case and user info
                    const facilityName = this.getFacilityName(caseData.facility_id) || caseData.facility_id || 'Unknown Facility';
                    const physicianName = this.getSurgeonName(caseData.physician_id) || caseData.physician_id || 'Unknown Physician';
                    const userName = currentUser?.name || currentUser?.email || 'Unknown User';
                    const historyMessage = `Check-in to ${facilityName} for case on ${caseData.scheduledDate} with ${physicianName}. Assigned to ${userName}.`;

                    // Add history entries with all global photos and notes
                    if (globalPhotos.length > 0) {
                        console.log(`🎯 Adding ${globalPhotos.length} photo history entries for tray: ${tray.trayName}`);
                        // Add one history entry per photo with its note
                        for (const photo of globalPhotos) {
                            const photoHistoryMessage = photo.note ?
                                `${historyMessage}\n\nNote: ${photo.note}` :
                                historyMessage;

                            console.log(`📝 Creating history entry with photo: ${photo.url}`);
                            await this.dataManager.addHistoryEntry(
                                tray.trayId,
                                'checkin',
                                photoHistoryMessage,
                                photo.url
                            );
                        }
                    } else {
                        console.log(`📝 Creating history entry without photos for tray: ${tray.trayName}`);
                        // Add history entry without photo
                        await this.dataManager.addHistoryEntry(
                            tray.trayId,
                            'checkin',
                            historyMessage,
                            null
                        );
                    }
                    console.log(`✅ Check-in successful for tray: ${tray.trayName}`);
                    successCount++;

                } catch (error) {
                    console.error(`❌ Error checking in tray ${tray.trayName}:`, error);
                    errors.push(`${tray.trayName}: ${error.message}`);
                    errorCount++;
                }
            }

            // Add additional trays to case requirements
            const additionalTrays = selectedTrays.filter(tray => tray.isAdditional);
            if (additionalTrays.length > 0) {
                try {
                    for (const additionalTray of additionalTrays) {
                        await window.app.trayManager.addTrayToCase(additionalTray.trayId, caseId);
                        console.log(`✅ Additional tray ${additionalTray.trayName} added to case ${caseId} requirements`);
                    }
                } catch (error) {
                    console.error('Error adding additional trays to case requirements:', error);
                    // Don't fail the entire process if this fails
                }
            }

            // Close modal properly
            const modal = document.getElementById('manualCheckInModal');
            if (modal) {
                // Try to use Bootstrap Modal API first
                if (window.bootstrap && window.bootstrap.Modal) {
                    const bootstrapModal = window.bootstrap.Modal.getInstance(modal);
                    if (bootstrapModal) {
                        bootstrapModal.hide();
                    } else {
                        // Create modal instance and hide it
                        const newModalInstance = new window.bootstrap.Modal(modal);
                        newModalInstance.hide();
                    }
                } else {
                    // Fallback - manually hide modal and backdrop
                    modal.classList.remove('show');
                    modal.style.display = 'none';
                    modal.setAttribute('aria-hidden', 'true');
                    document.body.classList.remove('modal-open');

                    // Remove all modal backdrops (not just specific ID)
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(backdrop => backdrop.remove());
                }

                // Clean up - remove modal from DOM after a short delay
                setTimeout(() => {
                    if (modal && modal.parentNode) {
                        modal.remove();
                    }
                }, 300);
            }

            // Show results
            if (successCount > 0 && errorCount === 0) {
                this.showSuccessNotification(`Successfully checked in ${successCount} trays`);
            } else if (successCount > 0 && errorCount > 0) {
                this.showWarningNotification(`Checked in ${successCount} trays, ${errorCount} failed. Errors: ${errors.join(', ')}`);
            } else {
                this.showErrorNotification(`Failed to check in trays. Errors: ${errors.join(', ')}`);
            }

            // Refresh the dashboard
            await this.loadUpcomingCases();

        } catch (error) {
            console.error('Error processing manual check-in:', error);
            this.showErrorNotification('Error processing manual check-in: ' + error.message);
        }
    }

    closeManualCheckInModal() {
        const modal = document.getElementById('manualCheckInModal');
        if (modal) {
            // Try to use Bootstrap Modal API first
            if (window.bootstrap && window.bootstrap.Modal) {
                const bootstrapModal = window.bootstrap.Modal.getInstance(modal);
                if (bootstrapModal) {
                    bootstrapModal.hide();
                } else {
                    // Create modal instance and hide it
                    const newModalInstance = new window.bootstrap.Modal(modal);
                    newModalInstance.hide();
                }
            } else {
                // Fallback - manually hide modal and backdrop
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');

                // Remove all modal backdrops
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => backdrop.remove());
            }

            // Clean up - remove modal from DOM after a short delay
            setTimeout(() => {
                if (modal && modal.parentNode) {
                    modal.remove();
                }
            }, 300);
        }
    }

    updateTraySelection(requirementIndex) {
        try {
            const traySelector = document.getElementById(`traySelect_${requirementIndex}`);
            if (!traySelector || !traySelector.value) return;

            const selectedOption = traySelector.options[traySelector.selectedIndex];
            const trayName = selectedOption.dataset.trayName || selectedOption.text;

            // Update any visual indicators if needed
            console.log(`Tray selection updated for requirement ${requirementIndex}: ${trayName}`);

            // Clear any existing photo for this requirement when tray changes
            const photoContext = `manualCheckin${requirementIndex}`;
            if (window.app?.photoManager) {
                window.app.photoManager.clearPhoto(photoContext);
            }

        } catch (error) {
            console.error('Error updating tray selection:', error);
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

    generateAdditionalTrayOptions(allTrays, caseTypeId = null) {
        // Filter trays by case type compatibility if case type is available
        let filteredTrays = allTrays;
        if (caseTypeId && window.app?.dataManager?.filterForTrayCompatibilityType) {
            filteredTrays = window.app.dataManager.filterForTrayCompatibilityType(caseTypeId, allTrays);
        }

        // Sort filtered trays alphabetically
        const sortedTrays = [...filteredTrays].sort((a, b) => {
            const nameA = (a.tray_name || a.name || a.tray_id || '').toLowerCase();
            const nameB = (b.tray_name || b.name || b.tray_id || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        return sortedTrays.map(tray => {
            const isCheckedIn = tray.status === TRAY_STATUS.IN_USE || tray.status === TRAY_STATUS.CHECKED_IN;
            const statusText = isCheckedIn ? ' (Already Checked In)' : ' (' + (tray.status || 'Available') + ')';

            return '<option value="' + (tray.id || tray.tray_id) + '" data-tray-name="' + (tray.tray_name || tray.name || tray.tray_id) + '" ' +
                (isCheckedIn ? 'disabled' : '') + '>' +
                (tray.tray_name || tray.name || tray.tray_id) + ' - ' + (tray.location || 'Unknown Location') + statusText +
            '</option>';
        }).join('');
    }

    addAdditionalTray() {
        const select = document.getElementById('additionalTraySelect');
        const traysList = document.getElementById('additionalTraysList');

        if (!select.value) {
            this.showWarningNotification('Please select a tray to add');
            return;
        }

        const selectedOption = select.options[select.selectedIndex];
        const trayId = select.value;
        const trayName = selectedOption.getAttribute('data-tray-name');

        // Check if tray is already added
        const existingTray = traysList.querySelector(`[data-additional-tray-id="${trayId}"]`);
        if (existingTray) {
            this.showWarningNotification('This tray is already added to additional trays');
            return;
        }

        // Create additional tray item
        const additionalTrayHtml = `
            <div class="additional-tray-item p-2 border rounded mb-2" data-additional-tray-id="${trayId}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${trayName}</strong>
                        <small class="text-muted d-block">Will be checked in and added to case requirements</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.app.dashboardManager.removeAdditionalTray('${trayId}')">
                        <i class="fas fa-times"></i> Remove
                    </button>
                </div>
            </div>
        `;

        traysList.insertAdjacentHTML('beforeend', additionalTrayHtml);

        // Reset select
        select.value = '';

        this.showSuccessNotification(`Added ${trayName} to additional trays`);
    }

    removeAdditionalTray(trayId) {
        const trayItem = document.querySelector(`[data-additional-tray-id="${trayId}"]`);
        if (trayItem) {
            trayItem.remove();
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
        
        // Store the updated cases data
        this.cases = cases;
        
        // Refresh dashboard if currently viewing dashboard
        if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
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
        } else {
        }
    }
}