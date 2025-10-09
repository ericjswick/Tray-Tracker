// js/CasesManager.js - Cases Management for Tray Tracker
import { CASE_STATUS, CASE_STATUS_OPTIONS, DEFAULT_CASE_STATUS, getCaseStatusClass, getCaseStatusColor, getCaseStatusLabel, isCompletedCaseStatus, isValidCaseStatus, normalizeCaseStatus, populateCaseStatusDropdown } from './constants/CaseStatus.js';
import { TRAY_LOCATIONS } from './constants/TrayLocations.js';
import { TRAY_STATUS, isCheckedInStatus } from './constants/TrayStatus.js';
import { emailNotifications } from './utils/EmailNotifications.js';
import { smsNotifications } from './utils/SmsNotifications.js';
import { getPhysicianName } from './utils/PhysicianHelper.js';
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class CasesManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentCases = [];
        this.viewMode = this.getStoredViewMode();
        
        // Note: Services moved to backend API - frontend uses direct API calls
    }

    async getCaseById(caseId) {
        let cases = this.currentCases;
        
        // If no cases loaded, try to get them from dataManager
        if (!cases || cases.length === 0) {
            try {
                cases = await this.dataManager.getAllCases();
            } catch (error) {
                console.error('Error loading cases for getCaseById:', error);
                return null;
            }
        }
        
        return cases.find(caseItem => caseItem.id === caseId);
    }

    getStoredViewMode() {
        return localStorage.getItem('casesViewMode') || 'list';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('casesViewMode', mode);

        // Update button states
        const cardBtn = document.getElementById('casesCardViewBtn');
        const listBtn = document.getElementById('casesListViewBtn');
        const calendarBtn = document.getElementById('casesCalendarViewBtn');

        if (cardBtn && listBtn && calendarBtn) {
            [cardBtn, listBtn, calendarBtn].forEach(btn => btn.classList.remove('active'));
            
            if (mode === 'card') cardBtn.classList.add('active');
            else if (mode === 'list') listBtn.classList.add('active');
            else if (mode === 'calendar') calendarBtn.classList.add('active');
        }

        // Update view containers
        const cardView = document.getElementById('casesCardView');
        const listView = document.getElementById('casesListView');
        const calendarView = document.getElementById('casesCalendarView');

        if (cardView && listView && calendarView) {
            [cardView, listView, calendarView].forEach(view => view.classList.add('d-none'));
            
            if (mode === 'card') cardView.classList.remove('d-none');
            else if (mode === 'list') listView.classList.remove('d-none');
            else if (mode === 'calendar') calendarView.classList.remove('d-none');
        }

        // Re-render cases in the new view mode
        this.renderCases(this.currentCases);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        // Initialize filters
        this.initializeFilters();
        // Wait for essential data before loading cases
        this.waitForEssentialDataThenLoad();
    }

    initializeFilters() {
        // Populate status filter using central function
        const statusFilter = document.getElementById('casesStatusFilter');
        if (statusFilter) {
            populateCaseStatusDropdown(statusFilter, {
                includeAllOption: true,
                allOptionText: 'All Status'
            });
        }

        // Add event listeners for filters
        const dateFilter = document.getElementById('casesDateFilter');
        const statusFilterElement = document.getElementById('casesStatusFilter');

        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                this.renderCases(this.currentCases);
            });
        }

        if (statusFilterElement) {
            statusFilterElement.addEventListener('change', () => {
                this.renderCases(this.currentCases);
            });
        }
    }
    
    async waitForEssentialDataThenLoad() {
        
        // Wait for essential data to be available
        const maxWait = 50; // 5 seconds max
        let attempts = 0;
        
        while (attempts < maxWait) {
            const surgeons = this.dataManager.getSurgeons();
            const facilities = this.dataManager.getFacilities();
            const caseTypes = this.dataManager.getCaseTypes();
            
            // Check if we have some data (at least one item in each or empty arrays are OK)
            if (surgeons !== null && facilities !== null && caseTypes !== null) {
                this.loadCases();
                this.setupDataUpdateListeners();
                return;
            }
            
            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        this.loadCases();
        this.setupDataUpdateListeners();
    }
    
    setupDataUpdateListeners() {
        // Set up a periodic check to re-render if surgeon/facility data gets updated
        // This ensures cases show proper names even if data loads after initial render
        let lastDataState = {
            surgeonCount: this.dataManager.getSurgeons().length,
            facilityCount: this.dataManager.getFacilities().length,
            caseTypeCount: this.dataManager.getCaseTypes().length
        };
        
        const checkDataUpdates = () => {
            const currentState = {
                surgeonCount: this.dataManager.getSurgeons().length,
                facilityCount: this.dataManager.getFacilities().length,
                caseTypeCount: this.dataManager.getCaseTypes().length
            };
            
            // If data counts have changed, re-render cases
            if (currentState.surgeonCount !== lastDataState.surgeonCount || 
                currentState.facilityCount !== lastDataState.facilityCount ||
                currentState.caseTypeCount !== lastDataState.caseTypeCount) {
                
                if (this.currentCases) {
                    this.renderCases(this.currentCases);
                }
                lastDataState = currentState;
            }
        };
        
        // Check every 2 seconds for the first minute, then less frequently
        const initialInterval = setInterval(checkDataUpdates, 2000);
        setTimeout(() => {
            clearInterval(initialInterval);
            // Continue checking every 10 seconds
            setInterval(checkDataUpdates, 10000);
        }, 60000);
    }

    async addCase() {
        try {
            // Check authentication first
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.debug('Attempting to add case', {
                    isAuthenticated: !!window.app?.authManager?.currentUser,
                    currentUser: window.app?.authManager?.currentUser?.email || 'None'
                }, 'case-add-auth');
            }

            const caseTypeId = document.getElementById('addCaseCaseType').value;
            const physician_id = document.getElementById('addCasePhysician').value;
            
            // Get case type name for tray requirements lookup
            const caseType = this.dataManager.caseTypes.find(ct => ct.id === caseTypeId);
            const caseTypeName = caseType?.name;
            
            const scheduledDate = document.getElementById('scheduledDate').value;
            const scheduledTime = document.getElementById('scheduledTime').value;

            const caseData = {
                patientName: document.getElementById('patientName').value,
                physician_id: physician_id,
                facility_id: document.getElementById('addCaseFacility').value,
                caseTypeId: caseTypeId,
                implant_type_id: document.getElementById('addCaseImplantType').value || '',
                case_type: caseTypeName, // MyRepData compatibility
                scheduledDate: scheduledDate, // Store date (assume CDT)
                scheduledTime: scheduledTime, // Store time (assume CDT)
                estimatedDuration: parseInt(document.getElementById('estimatedDuration').value) || 60,
                status: normalizeCaseStatus(document.getElementById('caseStatus').value || DEFAULT_CASE_STATUS),
                notes: document.getElementById('caseNotes').value,
                priority: document.getElementById('casePriority').value || 'normal'
            };

            // Get merged tray requirements using MyRepData logic
            const trayRequirements = await this.getMergedTrayRequirements(caseTypeName, physician_id);
            caseData.tray_requirements = trayRequirements;

            // Log the case data before attempting to save
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.debug('Case data collected', {
                    patientName: caseData.patientName,
                    physician_id: caseData.physician_id,
                    facility_id: caseData.facility_id,
                    caseTypeId: caseData.caseTypeId,
                    scheduledDate: caseData.scheduledDate,
                    scheduledTime: caseData.scheduledTime,
                    estimatedDuration: caseData.estimatedDuration,
                    trayRequirementsCount: this.getTrayRequirements(caseData).length,
                    status: caseData.status,
                    priority: caseData.priority,
                    hasNotes: !!caseData.notes,
                    dataValid: {
                        hasPatientName: !!caseData.patientName,
                        hasSurgeon: !!caseData.physician_id,
                        hasFacility: !!caseData.facility_id,
                        hasCaseType: !!caseData.caseTypeId,
                        hasDate: !!caseData.scheduledDate
                    }
                }, 'case-data-validation');
            }

            const savedCase = await this.dataManager.saveCase(caseData);
            if (savedCase && savedCase.id) {

                // Update physician's last case type
                if (physician_id && caseTypeId) {
                    try {
                        await this.dataManager.updatePhysician(physician_id, {
                            last_case_type_id: caseTypeId
                        });
                        console.log(`✅ Updated physician ${physician_id} last_case_type_id to ${caseTypeId}`);
                    } catch (error) {
                        console.error('Failed to update physician last case type:', error);
                        // Don't fail the case creation if physician update fails
                    }
                }

                // Log case creation activity
                const facilityName = this.getFacilityName(caseData.facility_id) || 'Unknown Facility';
                const physicianName = this.getPhysicianName(caseData.physician_id) || 'Unknown Physician';
                await this.dataManager.addSystemActivity(
                    'case-created',
                    `Created case for ${caseData.patientName} at ${facilityName} with ${physicianName} on ${caseData.scheduledDate}`,
                    savedCase.id,
                    'case'
                );

                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.info('Case save operation successful', {
                        caseId: savedCase.id,
                        patientName: caseData.patientName
                    }, 'case-save-success');
                }
            }

            bootstrap.Modal.getInstance(document.getElementById('addCaseModal')).hide();
            document.getElementById('addCaseForm').reset();
            this.showSuccessNotification('Case added successfully!');

            // Refresh cases list
            this.loadCases();
        } catch (error) {
            console.error('Error adding case:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('Case add operation failed in CasesManager', {
                    error: error.message,
                    code: error.code,
                    stack: error.stack
                }, 'case-add-error');
            }
            this.showErrorNotification('Error adding case: ' + error.message);
        }
    }

    getSelectedTrayRequirements() {
        if (window.app.modalManager && window.app.modalManager.getTrayRequirementsFromUI) {
            return window.app.modalManager.getTrayRequirementsFromUI('add');
        }
        return [];
    }

    // MyRepData-compatible method to merge tray requirements with physician preferences
    // Note: Backend services moved to API - this now uses direct frontend data
    async getMergedTrayRequirements(caseTypeName, physician_id) {
        try {
            // Use embedded requirements since services are now in backend API
            return this.getSelectedTrayRequirements();
        } catch (error) {
            console.error('Error getting merged tray requirements:', error);
            return [];
        }
    }

    async loadCases() {
        try {
            const cases = await this.dataManager.getAllCases();
            this.handleCasesUpdate(cases);
        } catch (error) {
            console.error('Error loading cases:', error);
            this.showErrorNotification('Error loading cases');
        }
    }

    handleCasesUpdate(cases) {
        this.currentCases = cases;
        this.renderCases(cases);
        this.updateCasesStats(cases);
    }

    renderCases(cases) {
        // Apply filters
        const filteredCases = this.applyFilters(cases);
        
        if (this.viewMode === 'list') {
            this.renderCasesList(filteredCases);
        } else if (this.viewMode === 'card') {
            this.renderCasesCards(filteredCases);
        } else if (this.viewMode === 'calendar') {
            this.renderCasesCalendar(filteredCases);
        }
    }

    applyFilters(cases) {
        const statusFilter = document.getElementById('casesStatusFilter')?.value || '';
        const dateFilter = document.getElementById('casesDateFilter')?.value || 'upcoming';

        let filteredCases = cases;

        // Apply status filter
        if (statusFilter) {
            filteredCases = filteredCases.filter(caseItem => caseItem.status === statusFilter);
        }

        // Apply date filter - use local timezone dates to avoid timezone issues
        const todayDate = new Date();
        const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

        // Calculate other dates as strings in local timezone
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

        const weekFromNowDate = new Date();
        weekFromNowDate.setDate(weekFromNowDate.getDate() + 7);
        const weekFromNow = `${weekFromNowDate.getFullYear()}-${String(weekFromNowDate.getMonth() + 1).padStart(2, '0')}-${String(weekFromNowDate.getDate()).padStart(2, '0')}`;

        const monthFromNowDate = new Date();
        monthFromNowDate.setMonth(monthFromNowDate.getMonth() + 1);
        const monthFromNow = `${monthFromNowDate.getFullYear()}-${String(monthFromNowDate.getMonth() + 1).padStart(2, '0')}-${String(monthFromNowDate.getDate()).padStart(2, '0')}`;

        const weekAgoDate = new Date();
        weekAgoDate.setDate(weekAgoDate.getDate() - 7);
        const weekAgo = `${weekAgoDate.getFullYear()}-${String(weekAgoDate.getMonth() + 1).padStart(2, '0')}-${String(weekAgoDate.getDate()).padStart(2, '0')}`;

        filteredCases = filteredCases.filter(caseItem => {
            const caseDate = caseItem.scheduledDate; // Already in YYYY-MM-DD format

            switch (dateFilter) {
                case 'all':
                    // Show all cases regardless of date
                    return true;
                case 'today':
                    return caseDate === today;
                case 'tomorrow':
                    return caseDate === tomorrow;
                case 'week':
                    return caseDate >= today && caseDate <= weekFromNow;
                case 'upcoming':
                    return caseDate >= today;
                case 'month':
                    return caseDate >= today && caseDate <= monthFromNow;
                case 'recent':
                    return caseDate >= weekAgo && caseDate < today;
                case 'past':
                    return caseDate < today;
                default:
                    return true;
            }
        });

        // Sort cases by date and time
        const sortedCases = filteredCases.sort((a, b) => {
            const dateA = new Date(a.scheduledDate + 'T' + (a.scheduledTime || '08:00'));
            const dateB = new Date(b.scheduledDate + 'T' + (b.scheduledTime || '08:00'));

            // For past cases, sort newest first (descending)
            if (dateFilter === 'recent' || dateFilter === 'past') {
                return dateB - dateA;
            } else {
                // For upcoming cases, sort oldest first (ascending)
                return dateA - dateB;
            }
        });

        return sortedCases;
    }

    renderCasesList(cases) {
        const container = document.getElementById('casesListView');
        if (!container) return;

        if (cases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus fa-3x text-muted mb-3"></i>
                    <h4>No Cases Found</h4>
                    <p class="text-muted">Add your first surgical case to get started</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Case Name</th>
                            <th>Physician</th>
                            <th>Facility</th>
                            <th>Date & Time</th>
                            <th>Case Type</th>
                            <th>Status</th>
                            <th>Trays Required</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cases.map(caseItem => this.renderCaseRow(caseItem)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tableHTML;
    }

    renderCaseRow(caseItem) {
        const surgeons = this.dataManager.getSurgeons();
        const facilities = this.dataManager.getFacilities();
        const caseTypes = this.dataManager.getCaseTypes();
        
        const surgeon = surgeons.find(s => s && s.id === caseItem.physician_id);
        const facility = facilities.find(f => f && f.id === caseItem.facility_id);
        const caseType = caseTypes.find(ct => ct && ct.id === caseItem.caseTypeId);
        
        // Display date/time assuming they're stored in CDT
        const scheduledDateTime = new Date(caseItem.scheduledDate + 'T' + (caseItem.scheduledTime || '08:00'));
        const dateStr = scheduledDateTime.toLocaleDateString();
        const timeStr = scheduledDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (CDT)';

        return `
            <tr>
                <td>
                    <strong>${caseItem.patientName || 'N/A'}</strong>
                    ${caseItem.priority === 'urgent' ? '<span class="badge bg-danger ms-2">Urgent</span>' : ''}
                </td>
                <td>${surgeon ? surgeon.full_name : (surgeons.length === 0 ? 'Loading...' : 'Unknown')}</td>
                <td>${this.getFacilityDisplayName(caseItem.facility_id, facilities)}</td>
                <td>
                    <div>${dateStr}</div>
                    <small class="text-muted">${timeStr}</small>
                </td>
                <td>${caseType ? caseType.name : (caseTypes.length === 0 ? 'Loading...' : 'Unknown')}</td>
                <td>
                    <span class="badge bg-${getCaseStatusColor(caseItem.status)}">
                        ${getCaseStatusLabel(caseItem.status)}
                    </span>
                </td>
                <td>
                    <span class="badge bg-secondary">
                        ${this.getTrayRequirements(caseItem).length} trays
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="window.app.casesManager.editCase('${caseItem.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="window.app.casesManager.viewCaseDetails('${caseItem.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="window.app.casesManager.deleteCase('${caseItem.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    async renderCasesCards(cases) {
        const container = document.getElementById('casesCardView');
        if (!container) return;

        if (cases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus fa-3x text-muted mb-3"></i>
                    <h4>No Cases Found</h4>
                    <p class="text-muted">Add your first surgical case to get started</p>
                </div>
            `;
            return;
        }

        // Use DashboardManager's renderCaseCard for consistency
        if (window.app.dashboardManager) {
            const cardsPromises = cases.map(caseItem => window.app.dashboardManager.renderCaseCard(caseItem));
            const cardsHTML = await Promise.all(cardsPromises);
            // Use the same grid class as dashboard
            container.className = 'cases-cards-grid';
            container.innerHTML = cardsHTML.join('');
        } else {
            console.error('DashboardManager not available');
            container.innerHTML = '<div class="alert alert-warning">Unable to render case cards</div>';
        }
    }


    renderCasesCalendar(cases) {
        const container = document.getElementById('casesCalendarView');
        if (!container) return;

        // Group cases by date
        const casesByDate = {};
        cases.forEach(caseItem => {
            const date = caseItem.scheduledDate;
            if (!casesByDate[date]) {
                casesByDate[date] = [];
            }
            casesByDate[date].push(caseItem);
        });

        // Generate calendar HTML
        const calendarHTML = `
            <div class="calendar-view">
                <h5>Cases Calendar View</h5>
                <p class="text-muted">Calendar view coming soon. For now, cases are grouped by date:</p>
                ${Object.entries(casesByDate).map(([date, dateCases]) => `
                    <div class="date-group mb-4">
                        <h6 class="text-primary">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h6>
                        <div class="row g-2">
                            ${dateCases.map(caseItem => `
                                <div class="col-md-6">
                                    <div class="card border-start border-primary border-3">
                                        <div class="card-body py-2">
                                            <div class="d-flex justify-content-between">
                                                <strong>${caseItem.patientName}</strong>
                                                <small>${caseItem.scheduledTime || '08:00'}</small>
                                            </div>
                                            <small class="text-muted">
                                                ${this.getSurgeonName(caseItem.physician_id) || 'Unknown Physician'}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = calendarHTML;
    }

    updateCasesStats(cases) {
        const todayDate = new Date();
        const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
        const totalCases = cases.length;
        const todayCases = cases.filter(c => c.scheduledDate === today).length;
        const urgentCases = cases.filter(c => c.priority === 'urgent').length;
        const completedCases = cases.filter(c => c.status === CASE_STATUS.COMPLETE).length;

        // Update the existing metric cards in the dashboard
        const statsContainer = document.getElementById('casesStats');
        if (statsContainer) {
            const metricCards = statsContainer.querySelectorAll('.metric-card');
            
            if (metricCards.length >= 4) {
                // Total Cases
                const totalElement = metricCards[0].querySelector('.metric-value');
                if (totalElement) totalElement.textContent = totalCases;
                
                // Today
                const todayElement = metricCards[1].querySelector('.metric-value');
                if (todayElement) todayElement.textContent = todayCases;
                
                // Urgent
                const urgentElement = metricCards[2].querySelector('.metric-value');
                if (urgentElement) urgentElement.textContent = urgentCases;
                
                // Completed
                const completedElement = metricCards[3].querySelector('.metric-value');
                if (completedElement) completedElement.textContent = completedCases;
            }
        }
    }

    async editCase(caseId) {
        try {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('CasesManager.editCase() called', { caseId: caseId }, 'case-edit-flow');
            }
            
            const caseData = await this.dataManager.getCase(caseId);
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('Case data received in editCase', {
                    caseId: caseId,
                    hasCaseData: !!caseData,
                    patientName: caseData?.patientName
                }, 'case-edit-flow');
            }
            
            if (caseData) {
                // First populate the dropdowns and tray requirements
                if (window.app.modalManager) {
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Starting modal UI population', { caseId: caseId }, 'case-edit-flow');
                    }
                    
                    await window.app.modalManager.populateCaseModalDropdowns();
                    await window.app.modalManager.populateTrayRequirements();
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Modal UI population completed', { caseId: caseId }, 'case-edit-flow');
                    }
                }
                
                // Then populate the form with case data
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.info('About to populate edit form', { 
                        caseId: caseId,
                        caseData: {
                            id: caseData.id,
                            patientName: caseData.patientName,
                            hasTrayRequirements: !!caseData.tray_requirements,
                            trayRequirementsCount: (caseData.tray_requirements || []).length
                        }
                    }, 'case-edit-flow');
                }
                this.populateEditForm(caseData);

                // Ensure dropdowns are populated before showing modal
                await window.app.modalManager.populateCaseModalDropdowns();

                // Update modal footer based on case status
                const modalFooter = document.querySelector('#editCaseModal .modal-footer');
                if (modalFooter) {
                    // Always show Complete Case button, add Download RPO button for completed cases
                    const downloadButton = isCompletedCaseStatus(caseData.status)
                        ? `<button type="button" class="btn btn-info me-2" onclick="window.app.casesManager.downloadCompletedCaseRPO('${caseData.id}', '${caseData.facility_id || caseData.facility}', '${caseData.case_type || caseData.type}')">
                            <i class="fas fa-download"></i> Download RPO
                           </button>`
                        : '';

                    modalFooter.innerHTML = `
                        <div class="d-flex justify-content-between w-100">
                            <div>
                                ${downloadButton}
                                <button type="button" class="btn btn-warning me-2" onclick="app.casesManager.cancelCase('${caseData.id}')" data-bs-dismiss="modal">
                                    <i class="fas fa-times-circle"></i> Cancel Case
                                </button>
                                <button type="button" class="btn btn-success" onclick="app.casesManager.showCompleteCaseModal('${caseData.id}')">
                                    <i class="fas fa-check-circle"></i> Complete Case
                                </button>
                            </div>
                            <div>
                                <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="app.casesManager.updateCase()">Update Case</button>
                            </div>
                        </div>
                    `;
                }

                const modal = new bootstrap.Modal(document.getElementById('editCaseModal'));
                modal.show();

                // Store the case ID on the modal for potential refresh
                const editModal = document.getElementById('editCaseModal');
                if (editModal) {
                    editModal.setAttribute('data-case-id', caseData.id);
                }

                // Re-populate form values after dropdowns are loaded to ensure physician selection works
                setTimeout(async () => {
                    // Double-check that physician dropdown is populated before setting values
                    const editPhysicianSelect = document.getElementById('editCasePhysician');
                    if (editPhysicianSelect && editPhysicianSelect.options.length <= 1) {
                        console.log('🔄 Physician dropdown empty on edit, ensuring surgeons loaded...');
                        if (window.app.dataManager) {
                            await window.app.dataManager.ensureSurgeonsLoaded();
                        }
                    }

                    this.populateEditForm(caseData);
                }, 100);
            } else {
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.error('No case data received', { caseId: caseId }, 'case-edit-flow');
                }
            }
        } catch (error) {
            console.error('Error loading case for edit:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('Error in editCase', { 
                    caseId: caseId, 
                    error: error.message 
                }, 'case-edit-flow');
            }
            this.showErrorNotification('Error loading case details');
        }
    }

    async populateEditForm(caseData) {
        if (window.frontendLogger) {
            window.frontendLogger.info('populateEditForm started', {
                caseId: caseData.id,
                patientName: caseData.patientName
            }, 'case-edit-flow');
        }

        document.getElementById('editCaseId').value = caseData.id;
        document.getElementById('editPatientName').value = caseData.patientName || '';

        // Handle physician dropdown - check if it's populated first
        const physicianSelect = document.getElementById('editCasePhysician');
        if (physicianSelect) {
            // Store the physician_id in a data attribute to preserve it
            physicianSelect.setAttribute('data-original-physician', caseData.physician_id || '');

            // Check if dropdown has options (more than just the default option)
            if (physicianSelect.options.length > 1) {
                physicianSelect.value = caseData.physician_id || '';
                console.log(`👨‍⚕️ Set physician value: ${caseData.physician_id}`);
            } else {
                console.log('⚠️ Physician dropdown not populated yet, will set value after dropdown loads');
                // Store the value to be set later
                physicianSelect.setAttribute('data-pending-value', caseData.physician_id || '');
            }
        }

        document.getElementById('editCaseFacility').value = caseData.facility_id || '';
        document.getElementById('editCaseType').value = caseData.caseTypeId || '';
        document.getElementById('editCaseImplantType').value = caseData.implant_type_id || '';
        document.getElementById('editScheduledDate').value = caseData.scheduledDate || '';
        document.getElementById('editScheduledTime').value = caseData.scheduledTime || '';
        document.getElementById('editEstimatedDuration').value = caseData.estimatedDuration || '';
        
        // Initialize and populate case status dropdown using central function
        const statusDropdown = document.getElementById('editCaseStatus');
        if (statusDropdown) {
            // Normalize status value using centralized function
            const normalizedStatus = normalizeCaseStatus(caseData.status);

            console.log('🔍 Setting status dropdown:', {
                caseDataStatus: caseData.status,
                normalizedStatus: normalizedStatus,
                defaultStatus: DEFAULT_CASE_STATUS
            });
            populateCaseStatusDropdown(statusDropdown, {
                includeAllOption: false,
                includeEmptyOption: false,
                selectedValue: normalizedStatus
            });
            console.log('✅ Status dropdown set to:', statusDropdown.value);
        }
        
        document.getElementById('editCasePriority').value = caseData.priority || '';
        document.getElementById('editCaseNotes').value = caseData.notes || '';
        
        if (window.frontendLogger) {
            window.frontendLogger.info('Form fields populated, about to handle tray requirements', { 
                caseId: caseData.id,
                aboutToCallGetTrayRequirements: true
            }, 'case-edit-flow');
        }
        
        const trayRequirements = this.getTrayRequirements(caseData);
        if (window.frontendLogger) {
            window.frontendLogger.info('Got tray requirements, about to wait for UI', { 
                caseId: caseData.id,
                trayRequirements: trayRequirements,
                trayRequirementsLength: trayRequirements?.length
            }, 'case-edit-flow');
        }
        
        // Set selected tray requirements after ensuring UI is ready
        try {
            await this.waitForTrayRequirementsUI();
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('UI ready, calling setSelectedTrayRequirements', { 
                    caseId: caseData.id,
                    trayRequirements: trayRequirements 
                }, 'case-edit-flow');
            }
            await this.setSelectedTrayRequirements(trayRequirements);
        } catch (error) {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('waitForTrayRequirementsUI failed', { 
                    caseId: caseData.id,
                    error: error.message 
                }, 'case-edit-flow');
            }
        }
    }

    waitForTrayRequirementsUI() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 5 seconds max (100 * 50ms)
            
            const checkUI = () => {
                attempts++;
                const container = document.querySelector('[data-modal="edit"].tray-requirements-list');
                const addButton = container?.parentElement?.querySelector('.btn-primary');
                
                // Enhanced debugging - check what's actually in the DOM
                if (attempts % 20 === 1) { // Log every 20 attempts (once per second)
                    const editTrayContainer = document.getElementById('editTrayRequirements');
                    const allTrayRequirementsLists = document.querySelectorAll('.tray-requirements-list');
                    const allDataModal = document.querySelectorAll('[data-modal]');
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('DOM debug info', {
                            attempt: attempts,
                            editTrayContainerExists: !!editTrayContainer,
                            editTrayContainerHTML: editTrayContainer?.innerHTML?.substring(0, 200),
                            trayRequirementsListsCount: allTrayRequirementsLists.length,
                            dataModalElementsCount: allDataModal.length,
                            containerFound: !!container,
                            addButtonFound: !!addButton
                        }, 'tray-requirements-debug');
                    }
                }
                
                if (container && addButton) {
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Tray requirements UI is ready', {
                            containerFound: !!container,
                            addButtonFound: !!addButton,
                            attempts: attempts
                        }, 'tray-requirements-debug');
                    }
                    resolve();
                } else if (attempts >= maxAttempts) {
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.error('Tray requirements UI timeout - elements not found', {
                            containerFound: !!container,
                            addButtonFound: !!addButton,
                            attempts: attempts,
                            maxAttempts: maxAttempts,
                            containerSelector: '[data-modal="edit"].tray-requirements-list',
                            buttonSelector: 'parent .btn-primary (relative to container)'
                        }, 'tray-requirements-debug');
                    }
                    reject(new Error('Tray requirements UI elements not found after timeout'));
                } else {
                    // Only log every 20 attempts to reduce spam
                    if (attempts % 20 === 0 && window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('Still waiting for tray requirements UI', {
                            containerFound: !!container,
                            addButtonFound: !!addButton,
                            attempts: attempts,
                            maxAttempts: maxAttempts
                        }, 'tray-requirements-debug');
                    }
                    setTimeout(checkUI, 50);
                }
            };
            checkUI();
        });
    }

    async setSelectedTrayRequirements(trayRequirements) {
        if (window.frontendLogger) {
            window.frontendLogger.info('setSelectedTrayRequirements called', {
                trayRequirements: trayRequirements,
                requirementsLength: trayRequirements?.length,
                hasModalManager: !!(window.app.modalManager),
                hasSetTrayRequirementsInUI: !!(window.app.modalManager?.setTrayRequirementsInUI)
            }, 'tray-requirements-debug');
        }
        
        if (window.app.modalManager && window.app.modalManager.setTrayRequirementsInUI) {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('Calling setTrayRequirementsInUI', {
                    trayRequirements: trayRequirements,
                    modal: 'edit'
                }, 'tray-requirements-debug');
            }
            await window.app.modalManager.setTrayRequirementsInUI(trayRequirements, 'edit');
        } else {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('ModalManager or setTrayRequirementsInUI not available', {
                    hasModalManager: !!(window.app.modalManager),
                    hasSetMethod: !!(window.app.modalManager?.setTrayRequirementsInUI)
                }, 'tray-requirements-debug');
            }
        }
    }

    getEditSelectedTrayRequirements() {
        if (window.app.modalManager && window.app.modalManager.getTrayRequirementsFromUI) {
            const result = window.app.modalManager.getTrayRequirementsFromUI('edit');
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('getEditSelectedTrayRequirements result', {
                    result: result,
                    resultLength: result?.length,
                    resultType: typeof result,
                    isArray: Array.isArray(result)
                }, 'tray-requirements-debug');
            }
            return result;
        }
        if (window.frontendLogger) {
            window.frontendLogger.error('getEditSelectedTrayRequirements: modalManager not available', {
                hasModalManager: !!(window.app.modalManager),
                hasGetMethod: !!(window.app.modalManager?.getTrayRequirementsFromUI)
            }, 'tray-requirements-debug');
        }
        return [];
    }

    getTrayTypeDisplayName(tray) {
        // Support both MyRepData case type compatibility and legacy type
        if (typeof tray === 'object' && tray.case_type_compatibility && Array.isArray(tray.case_type_compatibility) && tray.case_type_compatibility.length > 0) {
            return tray.case_type_compatibility.join(', ');
        }
        
        // Handle legacy string type or object with type field
        const trayTypeCode = typeof tray === 'string' ? tray : (tray.type || '');
        const trayTypeNames = {
            'fusion': 'Fusion Set',
            'revision': 'Revision Kit', 
            'mi': 'Minimally Invasive',
            'complete': 'Complete System'
        };
        return trayTypeNames[trayTypeCode] || trayTypeCode || 'General Purpose';
    }

    // Helper method to get tray requirements from case data (handles both field name formats)
    getTrayRequirements(caseData) {
        const result = caseData.tray_requirements || [];

        if (window.frontendLogger) {
            window.frontendLogger.info('CasesManager.getTrayRequirements() called', {
                caseId: caseData.id,
                tray_requirements: caseData.tray_requirements,
                result: result,
                resultType: typeof result,
                resultLength: result?.length,
                isArray: Array.isArray(result)
            }, 'tray-requirements-debug');
        }
        
        return result;
    }

    async updateCase() {
        try {
            const caseId = document.getElementById('editCaseId').value;

            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('updateCase started', {
                    caseId: caseId
                }, 'case-save-flow');
            }

            const trayRequirements = this.getEditSelectedTrayRequirements();

            // Get the physician dropdown and log its state
            const physicianDropdown = document.getElementById('editCasePhysician');
            const physicianValue = physicianDropdown ? physicianDropdown.value : '';
            const originalPhysician = physicianDropdown ? physicianDropdown.getAttribute('data-original-physician') : '';


            // Determine the final physician ID to use
            let finalPhysicianId = physicianValue;

            // If dropdown value is empty but we have the original physician stored, use that
            if ((!finalPhysicianId || finalPhysicianId === '') && originalPhysician) {
                console.log('⚠️ Physician dropdown value is empty, using stored original physician_id:', originalPhysician);
                finalPhysicianId = originalPhysician;
            }

            // As a last resort, fetch from database if still empty
            if (!finalPhysicianId || finalPhysicianId === '') {
                const originalCase = await this.dataManager.getCase(caseId);
                if (originalCase && originalCase.physician_id) {
                    console.log('⚠️ Using physician_id from database:', originalCase.physician_id);
                    finalPhysicianId = originalCase.physician_id;
                }
            }

            const updates = {
                patientName: document.getElementById('editPatientName').value,
                physician_id: finalPhysicianId,
                facility_id: document.getElementById('editCaseFacility').value,
                caseTypeId: document.getElementById('editCaseType').value,
                implant_type_id: document.getElementById('editCaseImplantType').value || '',
                scheduledDate: document.getElementById('editScheduledDate').value,
                scheduledTime: document.getElementById('editScheduledTime').value,
                estimatedDuration: parseInt(document.getElementById('editEstimatedDuration').value) || 60,
                status: normalizeCaseStatus(document.getElementById('editCaseStatus').value),
                priority: document.getElementById('editCasePriority').value,
                notes: document.getElementById('editCaseNotes').value,
                tray_requirements: trayRequirements
            };


            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('About to save case with tray requirements', {
                    caseId: caseId,
                    trayRequirements: trayRequirements,
                    trayRequirementsLength: trayRequirements?.length,
                    patientName: updates.patientName,
                    physician_id: updates.physician_id
                }, 'case-save-flow');
            }

            await this.dataManager.updateCase(caseId, updates);

            // Verify what was actually saved
            const savedCase = await this.dataManager.getCase(caseId);
            console.log('✅ Case after save:', {
                caseId: caseId,
                physician_id: savedCase?.physician_id,
                hasPhysician: !!savedCase?.physician_id
            });

            // Update physician's last case type
            const physician_id = updates.physician_id;
            const caseTypeId = updates.caseTypeId;
            if (physician_id && caseTypeId) {
                try {
                    await this.dataManager.updatePhysician(physician_id, {
                        last_case_type_id: caseTypeId
                    });
                    console.log(`✅ Updated physician ${physician_id} last_case_type_id to ${caseTypeId} (case update)`);
                } catch (error) {
                    console.error('Failed to update physician last case type:', error);
                    // Don't fail the case update if physician update fails
                }
            }
            
            // Check if case status was changed to "Removed" - if so, move all checked-in trays to trunk
            if (updates.status === CASE_STATUS.REMOVED) {
                await this.handleCaseRemovedTrays(caseId);
            }
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('Case saved successfully', {
                    caseId: caseId
                }, 'case-save-flow');
            }

            // Send notifications to users based on their physician notification preferences
            await this.sendCaseUpdateNotifications(caseId, updates.physician_id, savedCase);

            bootstrap.Modal.getInstance(document.getElementById('editCaseModal')).hide();
            this.showSuccessNotification('Case updated successfully!');
            this.loadCases();
        } catch (error) {
            console.error('Error updating case:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('Error updating case', { 
                    error: error.message 
                }, 'case-save-flow');
            }
            this.showErrorNotification('Error updating case: ' + error.message);
        }
    }

    async deleteCase(caseId) {
        if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
            return;
        }

        try {
            await this.dataManager.deleteCase(caseId);
            this.showSuccessNotification('Case deleted successfully!');
            this.loadCases();
        } catch (error) {
            console.error('Error deleting case:', error);
            this.showErrorNotification('Error deleting case: ' + error.message);
        }
    }

    async cancelCase(caseId) {
        if (!confirm('Are you sure you want to cancel this case? All assigned trays will be marked as Ready For Pickup.')) {
            return;
        }

        try {
            // Update case status to cancelled
            await this.dataManager.updateCase(caseId, {
                status: CASE_STATUS.CANCELLED,
                updated_at: new Date().toISOString()
            });

            // Get all trays assigned to this case and update their status
            const trays = await this.dataManager.getAllTrays();
            const assignedTrays = trays.filter(tray =>
                tray.assignedCaseId === caseId ||
                tray.case_id === caseId ||
                (tray.assigned_cases && tray.assigned_cases.includes(caseId))
            );

            console.log(`Found ${assignedTrays.length} trays assigned to case ${caseId}`);

            // Update each assigned tray to Ready For Pickup status
            const updatePromises = assignedTrays.map(tray =>
                this.dataManager.updateTray(tray.id, {
                    status: TRAY_STATUS.READY_FOR_PICKUP,
                    assignedCaseId: null,
                    case_id: null,
                    updated_at: new Date().toISOString()
                })
            );

            await Promise.all(updatePromises);

            this.showSuccessNotification(`Case cancelled. ${assignedTrays.length} tray(s) marked as Ready For Pickup.`);
            this.loadCases();
        } catch (error) {
            console.error('Error cancelling case:', error);
            this.showErrorNotification('Error cancelling case: ' + error.message);
        }
    }

    async showCompleteCaseModal(caseId) {
        // Store the case ID for later use
        this.completeCaseId = caseId;

        // Get case data to determine facility and case type
        const caseData = await this.getCaseById(caseId);
        if (!caseData) {
            this.showErrorNotification('Case not found');
            return;
        }

        this.currentCaseFacility = caseData.facility_id || caseData.facility;
        this.currentCaseType = caseData.case_type || caseData.type;

        // Get implant type name
        let implantTypeName = 'Unknown Implant Type';
        console.log('Case implant_type_id:', caseData.implant_type_id);
        console.log('implantTypeManager available:', !!window.app?.implantTypeManager);

        if (caseData.implant_type_id && window.app?.implantTypeManager) {
            const implantTypes = window.app.implantTypeManager.getActiveImplantTypes?.() || [];
            console.log('Available implant types:', implantTypes.length);
            console.log('First implant type:', implantTypes[0]);

            const implantType = implantTypes.find(it => it && it.id === caseData.implant_type_id);
            console.log('Found implant type:', implantType);

            if (implantType) {
                implantTypeName = implantType.name || implantType.implant_type_name || 'Unknown Implant Type';
            }
        }

        console.log('Final implant type name:', implantTypeName);

        // Show the modal with higher z-index to appear above case details modal
        const modalElement = document.getElementById('completeCaseModal');
        const modal = new bootstrap.Modal(modalElement);

        // Listen for modal shown event to adjust z-index
        modalElement.addEventListener('shown.bs.modal', () => {
            // Bootstrap default modal z-index is 1055, backdrop is 1050
            // Case details modal uses default, so we need to be higher
            const backdrop = document.querySelector('.modal-backdrop:last-of-type');
            if (backdrop) {
                backdrop.style.zIndex = '1056';
            }
            modalElement.style.zIndex = '1057';
        }, { once: true });

        modal.show();

        // Set implant type name after modal is shown
        const implantTypeNameElement = document.getElementById('completeCaseImplantTypeName');
        console.log('implantTypeName element:', implantTypeNameElement);
        if (implantTypeNameElement) {
            implantTypeNameElement.textContent = implantTypeName;
            console.log('Set implant type name to:', implantTypeName);
        } else {
            console.error('implantTypeName element not found!');
        }

        // Set up disposables calculation (includes implant type now)
        this.setupDisposablesCalculation();

        // First, try to load case-specific disposables data if it exists
        if (caseData.disposables_data) {
            console.log('Loading case-specific disposables data:', caseData.disposables_data);
            this.loadDisposablesFromData(caseData.disposables_data);
        } else {
            // Fall back to template data if no case-specific data exists
            await this.loadSavedLineItems(this.currentCaseFacility, this.currentCaseType);
        }

        // Set up the confirm button click handler
        const confirmBtn = document.getElementById('confirmCompleteCaseBtn');
        confirmBtn.onclick = async () => {
            // Collect disposables data
            const implantTypeQty = document.getElementById('completeCaseImplantTypeQty');
            const implantTypePrice = document.getElementById('completeCaseImplantTypePrice');
            const implantTypeName = document.getElementById('completeCaseImplantTypeName');

            const implantType = {
                name: implantTypeName ? implantTypeName.textContent : '',
                qty: implantTypeQty ? (parseFloat(implantTypeQty.value) || 0) : 0,
                price: implantTypePrice ? (parseFloat(implantTypePrice.value) || 0) : 0
            };

            // Collect all line items
            const lineItems = {};
            document.querySelectorAll('.consumable-qty').forEach((qtyInput) => {
                const rowIndex = qtyInput.dataset.row;
                const priceInput = document.querySelector(`.consumable-price[data-row="${rowIndex}"]`);
                const itemName = qtyInput.closest('tr').querySelector('td:first-child').textContent.trim();

                lineItems[rowIndex] = {
                    itemName: itemName,
                    qty: parseFloat(qtyInput.value) || 0,
                    price: parseFloat(priceInput.value) || 0
                };
            });

            const disposablesData = {
                implant_type: implantType,
                line_items: lineItems
            };

            // Save to template (for future cases with same facility + case type)
            await this.saveLineItems(this.currentCaseFacility, this.currentCaseType);

            // Save disposables to the case document itself
            await this.saveCaseDisposables(caseId, disposablesData);

            const completionData = {
                implant_type: {
                    name: implantType.name,
                    qty: implantType.qty,
                    price: implantType.price,
                    total: implantType.qty * implantType.price
                },
                disposables: this.getDisposablesData()
            };

            console.log('Completion data being saved:', completionData);

            modal.hide();
            // Close parent modal (case details modal) if it exists
            const caseDetailsModal = bootstrap.Modal.getInstance(document.getElementById('caseDetailsModal'));
            if (caseDetailsModal) {
                caseDetailsModal.hide();
            }
            this.completeCase(caseId, completionData);
        };

        // Set up PDF preview button click handler
        const previewPdfBtn = document.getElementById('previewPdfBtn');
        previewPdfBtn.onclick = async () => {
            await this.saveLineItems(this.currentCaseFacility, this.currentCaseType);
            this.generatePdfPreview();
        };
    }


    async saveLineItems(facilityId, caseType) {
        try {
            if (!facilityId || !caseType) {
                console.warn('Missing facility or case type for saving line items');
                return;
            }

            // Collect implant type data
            const implantTypeQty = document.getElementById('completeCaseImplantTypeQty');
            const implantTypePrice = document.getElementById('completeCaseImplantTypePrice');
            const implantTypeName = document.getElementById('completeCaseImplantTypeName');

            const implantType = {
                name: implantTypeName ? implantTypeName.textContent : '',
                qty: implantTypeQty ? (parseFloat(implantTypeQty.value) || 0) : 0,
                price: implantTypePrice ? (parseFloat(implantTypePrice.value) || 0) : 0
            };

            // Collect all line item data
            const lineItems = {};
            document.querySelectorAll('.consumable-qty').forEach((qtyInput) => {
                const rowIndex = qtyInput.dataset.row;
                const priceInput = document.querySelector(`.consumable-price[data-row="${rowIndex}"]`);
                const itemName = qtyInput.closest('tr').querySelector('td:first-child').textContent.trim();

                lineItems[rowIndex] = {
                    itemName: itemName,
                    qty: parseFloat(qtyInput.value) || 0,
                    price: parseFloat(priceInput.value) || 0
                };
            });

            // Create composite key for facility + case type
            const docId = `${facilityId}_${caseType}`;

            // Save to Firestore using modular SDK
            const currentUser = window.app?.authManager?.getCurrentUser();

            await setDoc(doc(this.dataManager.db, 'disposable_saved_line_items', docId), {
                facility_id: facilityId,
                case_type: caseType,
                implant_type: implantType,
                line_items: lineItems,
                updated_at: serverTimestamp(),
                updated_by: currentUser?.uid || null
            }, { merge: true });

            console.log(`✅ Saved line items for facility ${facilityId}, case type ${caseType}`);
        } catch (error) {
            console.error('Error saving line items:', error);
            // Don't show error to user - this is a background operation
        }
    }

    async saveCaseDisposables(caseId, disposablesData) {
        try {
            console.log('💾 Saving disposables to case document:', caseId, disposablesData);

            await this.dataManager.updateCase(caseId, {
                disposables_data: disposablesData,
                updated_at: new Date().toISOString()
            });

            console.log('✅ Saved disposables to case document');
        } catch (error) {
            console.error('Error saving disposables to case:', error);
        }
    }

    loadDisposablesFromData(disposablesData) {
        try {
            console.log('Loading disposables from case data:', disposablesData);

            // Load implant type if available
            if (disposablesData.implant_type) {
                const implantTypeQty = document.getElementById('completeCaseImplantTypeQty');
                const implantTypePrice = document.getElementById('completeCaseImplantTypePrice');

                if (implantTypeQty && implantTypePrice) {
                    implantTypeQty.value = disposablesData.implant_type.qty || 0;
                    implantTypePrice.value = disposablesData.implant_type.price || 0;

                    // Trigger calculation
                    const event = new Event('input', { bubbles: true });
                    implantTypeQty.dispatchEvent(event);
                }
            }

            // Load line items if available
            if (disposablesData.line_items) {
                Object.keys(disposablesData.line_items).forEach((rowIndex) => {
                    const item = disposablesData.line_items[rowIndex];
                    const qtyInput = document.querySelector(`.consumable-qty[data-row="${rowIndex}"]`);
                    const priceInput = document.querySelector(`.consumable-price[data-row="${rowIndex}"]`);

                    if (qtyInput && priceInput) {
                        qtyInput.value = item.qty || 0;
                        priceInput.value = item.price || 0;

                        // Trigger calculation
                        const event = new Event('input', { bubbles: true });
                        qtyInput.dispatchEvent(event);
                    }
                });
            }

            console.log('✅ Loaded disposables from case data');
        } catch (error) {
            console.error('Error loading disposables from case data:', error);
        }
    }

    async loadSavedLineItems(facilityId, caseType) {
        try {
            console.log('🔍 loadSavedLineItems called with:', { facilityId, caseType });

            if (!facilityId || !caseType) {
                console.warn('Missing facility or case type for loading line items');
                return;
            }

            // Create composite key for facility + case type
            const docId = `${facilityId}_${caseType}`;
            console.log('Looking for document ID:', docId);

            // Load from Firestore using modular SDK
            const docRef = doc(this.dataManager.db, 'disposable_saved_line_items', docId);
            const docSnap = await getDoc(docRef);

            console.log('Document exists:', docSnap.exists());

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Saved data:', data);

                // Load implant type data if available
                if (data.implant_type) {
                    console.log('Loading implant type data:', data.implant_type);
                    const implantTypeQty = document.getElementById('completeCaseImplantTypeQty');
                    const implantTypePrice = document.getElementById('completeCaseImplantTypePrice');

                    console.log('Implant type elements found:', { qtyInput: !!implantTypeQty, priceInput: !!implantTypePrice });

                    if (implantTypeQty && implantTypePrice) {
                        implantTypeQty.value = data.implant_type.qty || 0;
                        implantTypePrice.value = data.implant_type.price || 0;

                        // Trigger calculation
                        const event = new Event('input', { bubbles: true });
                        implantTypeQty.dispatchEvent(event);
                    }
                }

                // Load line items
                const lineItems = data.line_items;
                console.log('Line items to load:', lineItems);

                // Populate the form with saved values
                Object.keys(lineItems).forEach((rowIndex) => {
                    const item = lineItems[rowIndex];
                    const qtyInput = document.querySelector(`.consumable-qty[data-row="${rowIndex}"]`);
                    const priceInput = document.querySelector(`.consumable-price[data-row="${rowIndex}"]`);

                    console.log(`Row ${rowIndex}:`, { item, foundQty: !!qtyInput, foundPrice: !!priceInput });

                    if (qtyInput && priceInput) {
                        qtyInput.value = item.qty || 0;
                        priceInput.value = item.price || 0;

                        // Trigger calculation for this row
                        const event = new Event('input', { bubbles: true });
                        qtyInput.dispatchEvent(event);
                    }
                });

                console.log(`✅ Loaded saved line items for facility ${facilityId}, case type ${caseType}`);
            } else {
                console.log(`❌ No saved line items found for facility ${facilityId}, case type ${caseType}`);
            }
        } catch (error) {
            console.error('Error loading line items:', error);
            // Don't show error to user - form will just have default values
        }
    }

    setupDisposablesCalculation() {
        // Function to calculate implant type total
        const calculateImplantTypeTotal = () => {
            const qtyInput = document.getElementById('completeCaseImplantTypeQty');
            const priceInput = document.getElementById('completeCaseImplantTypePrice');
            const totalSpan = document.getElementById('completeCaseImplantTypeTotal');

            if (qtyInput && priceInput && totalSpan) {
                const qty = parseFloat(qtyInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const total = qty * price;
                totalSpan.textContent = `$${total.toFixed(2)}`;
            }
        };

        // Function to calculate row total
        const calculateRowTotal = (rowIndex) => {
            const qtyInput = document.querySelector(`.consumable-qty[data-row="${rowIndex}"]`);
            const priceInput = document.querySelector(`.consumable-price[data-row="${rowIndex}"]`);
            const totalSpan = document.querySelector(`.consumable-total[data-row="${rowIndex}"]`);

            if (qtyInput && priceInput && totalSpan) {
                const qty = parseFloat(qtyInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const total = qty * price;
                totalSpan.textContent = `$${total.toFixed(2)}`;
            }
        };

        // Function to calculate grand total (includes implant type)
        const calculateGrandTotal = () => {
            let grandTotal = 0;

            // Add implant type total
            const implantTotal = document.getElementById('completeCaseImplantTypeTotal');
            if (implantTotal) {
                const value = implantTotal.textContent.replace('$', '');
                grandTotal += parseFloat(value) || 0;
            }

            // Add all disposable totals
            document.querySelectorAll('.consumable-total').forEach(span => {
                const value = span.textContent.replace('$', '');
                grandTotal += parseFloat(value) || 0;
            });

            document.getElementById('consumablesGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
        };

        // Add event listeners to implant type inputs
        const implantTypeQty = document.getElementById('completeCaseImplantTypeQty');
        const implantTypePrice = document.getElementById('completeCaseImplantTypePrice');

        if (implantTypeQty && implantTypePrice) {
            [implantTypeQty, implantTypePrice].forEach(input => {
                input.addEventListener('input', () => {
                    calculateImplantTypeTotal();
                    calculateGrandTotal();
                });

                input.addEventListener('focus', (e) => {
                    e.target.select();
                });
            });
        }

        // Add event listeners to all qty and price inputs
        document.querySelectorAll('.consumable-qty, .consumable-price').forEach(input => {
            input.addEventListener('input', (e) => {
                const rowIndex = e.target.dataset.row;
                calculateRowTotal(rowIndex);
                calculateGrandTotal();
            });

            // Select all text when clicking on the input
            input.addEventListener('focus', (e) => {
                e.target.select();
            });
        });
    }

    async generatePdfPreview() {
        try {
            // Show loader
            this.showLoader('Generating PDF preview...');

            // Collect disposable data
            const disposablesData = this.getDisposablesData();

            // Get case data
            const caseData = await this.getCaseData(this.completeCaseId);

            // Get sticker photos from PhotoManager
            const photoManager = window.app?.photoManager;
            let stickerPhotos = {
                leftSideStickers: null,
                rightSideStickers: null,
                patientStickers: null
            };

            if (photoManager && typeof photoManager.getPhoto === 'function') {
                stickerPhotos = {
                    leftSideStickers: await photoManager.getPhoto('leftSideStickers'),
                    rightSideStickers: await photoManager.getPhoto('rightSideStickers'),
                    patientStickers: await photoManager.getPhoto('patientStickers')
                };
            } else {
                console.error('PhotoManager.getPhoto not available');
            }

            // Generate the PDF
            const pdfBytes = await this.createPurchaseOrderPdf(disposablesData, caseData, stickerPhotos);

            // Store the PDF for download
            this.currentPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            // Show preview modal and render PDF
            await this.showPdfPreview(pdfBytes);

            // Hide loader after PDF is rendered
            this.hideLoader();

        } catch (error) {
            console.error('Error generating PDF preview:', error);
            this.hideLoader();
            this.showErrorNotification('Error generating PDF preview: ' + error.message);
        }
    }

    async downloadCompletedCaseRPO(caseId, facilityId, caseType) {
        console.log('🔍 downloadCompletedCaseRPO called with:', { caseId, facilityId, caseType });
        try {
            // Show loader
            this.showLoader('Generating RPO PDF...');

            // Get the case document to access disposables_data
            const caseDoc = await this.dataManager.getCase(caseId);

            if (!caseDoc || !caseDoc.disposables_data) {
                this.hideLoader();
                this.showErrorNotification('No disposables data found for this case');
                return;
            }

            const savedData = caseDoc.disposables_data;
            const lineItems = savedData.line_items;

            // Include implant type if it has qty > 0
            const items = [];

            if (savedData.implant_type && savedData.implant_type.qty > 0) {
                items.push({
                    item: savedData.implant_type.name,
                    qty: savedData.implant_type.qty,
                    price: savedData.implant_type.price,
                    total: savedData.implant_type.qty * savedData.implant_type.price,
                    rowIndex: -1, // Special index for implant type
                    isImplantType: true // Flag to identify implant type
                });
            }

            // Convert saved line items to disposablesData format
            Object.keys(lineItems).forEach(rowIndex => {
                const item = lineItems[rowIndex];
                if (item.qty > 0) {
                    items.push({
                        item: item.itemName,
                        qty: item.qty,
                        price: item.price,
                        total: item.qty * item.price,
                        rowIndex: parseInt(rowIndex)
                    });
                }
            });

            // Calculate grand total
            const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

            const disposablesData = {
                items: items,
                grandTotal: grandTotal
            };

            // Get case data
            const caseData = await this.getCaseData(caseId);

            // No sticker photos for completed cases (they weren't saved)
            const stickerPhotos = {
                leftSideStickers: null,
                rightSideStickers: null,
                patientStickers: null
            };

            // Generate the PDF
            const pdfBytes = await this.createPurchaseOrderPdf(disposablesData, caseData, stickerPhotos);

            // Download the PDF directly
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `RPO_${caseData.patientName || 'Case'}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Hide loader
            this.hideLoader();

            // Show success message
            this.showSuccessNotification('RPO PDF downloaded successfully');

        } catch (error) {
            console.error('Error generating completed case RPO:', error);
            this.hideLoader();
            this.showErrorNotification('Error generating RPO: ' + error.message);
        }
    }

    async getCaseData(caseId) {
        try {
            // Get the case
            const caseObj = await this.dataManager.getCase(caseId);
            if (!caseObj) {
                throw new Error('Case not found');
            }

            console.log('Case object:', caseObj);
            console.log('All case fields:', Object.keys(caseObj));

            // Get physician name using central function
            let physicianName = '';
            const physicianId = caseObj.physician_id || caseObj.physicianId || caseObj.surgeon_id;
            console.log('Physician ID from case:', physicianId);

            if (physicianId) {
                const physicians = this.dataManager.getSurgeons();
                console.log('Physicians array length:', physicians?.length);
                console.log('First physician sample:', physicians?.[0]);

                physicianName = getPhysicianName(physicianId, physicians);
                console.log('getPhysicianName returned:', physicianName);
            }

            if (!physicianName) {
                physicianName = caseObj.physician_name || caseObj.physician || caseObj.doctor_name || caseObj.surgeonName || 'Unknown Physician';
            }
            console.log('Final physician name result:', physicianName);

            // Get facility data
            let facilityData = {
                name: '',
                address: '',
                city: '',
                state: '',
                zip: ''
            };

            if (caseObj.facility_id) {
                const facilities = this.dataManager.getFacilities();
                const facility = facilities.find(f => f.id === caseObj.facility_id);
                console.log('Facility found:', facility);

                if (facility) {
                    console.log('Facility fields:', Object.keys(facility));

                    // Handle address object structure
                    let addressStr = '';
                    let city = '';
                    let state = '';
                    let zip = '';

                    if (facility.address && typeof facility.address === 'object') {
                        // Address is an object with street, city, state, zip
                        addressStr = facility.address.street || '';
                        city = facility.address.city || '';
                        state = facility.address.state || '';
                        zip = facility.address.zip || '';
                    } else {
                        // Fallback to individual fields
                        addressStr = facility.billing_street || facility.street || facility.address || facility.shipping_street || '';
                        city = facility.billing_city || facility.city || facility.shipping_city || '';
                        state = facility.billing_state || facility.state || facility.shipping_state || '';
                        zip = facility.billing_postal_code || facility.zip || facility.postal_code || facility.shipping_postal_code || '';
                    }

                    facilityData = {
                        name: facility.account_name || facility.name || facility.facility_name || '',
                        address: addressStr,
                        city: city,
                        state: state,
                        zip: zip
                    };
                    console.log('Facility data extracted:', facilityData);
                }
            }

            // Get sales rep name from current user
            let salesRepName = '';
            const currentUser = window.app?.authManager?.getCurrentUser();
            if (currentUser) {
                const users = this.dataManager.getUsers();
                const user = users.get(currentUser.uid);
                console.log('Sales rep (current user):', user);
                if (user) {
                    salesRepName = user.display_name || user.name || user.email || '';
                }
            }

            // Get case date from scheduledDate and format as mm/dd/yyyy
            let caseDate = '';
            const rawDate = caseObj.scheduledDate || caseObj.scheduled_date || caseObj.case_date || caseObj.surgery_date || caseObj.date;

            if (rawDate) {
                try {
                    const dateObj = new Date(rawDate);
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const year = dateObj.getFullYear();
                    caseDate = `${month}/${day}/${year}`;
                } catch (e) {
                    console.error('Error formatting date:', e);
                    caseDate = rawDate;
                }
            }

            console.log('Final case data:', { physicianName, facilityData, salesRepName, caseDate, rawDate });

            const result = {
                physicianName,
                facilityData,
                salesRepName,
                caseType: caseObj.case_type || '',
                caseDate: caseDate
            };

            // Include completion_data if it exists
            if (caseObj.completion_data) {
                result.completion_data = caseObj.completion_data;
            }

            return result;

        } catch (error) {
            console.error('Error getting case data:', error);
            return {
                physicianName: '',
                facilityData: { name: '', address: '', city: '', state: '', zip: '' },
                salesRepName: '',
                caseType: '',
                caseDate: ''
            };
        }
    }

    getDisposablesData() {
        const disposablesData = [];

        // Get implant type if qty > 0
        const implantTypeQty = document.getElementById('completeCaseImplantTypeQty');
        const implantTypePrice = document.getElementById('completeCaseImplantTypePrice');
        const implantTypeName = document.getElementById('completeCaseImplantTypeName');

        console.log('Implant Type Elements:', {
            qtyElement: implantTypeQty,
            priceElement: implantTypePrice,
            nameElement: implantTypeName,
            qty: implantTypeQty?.value,
            price: implantTypePrice?.value,
            name: implantTypeName?.textContent
        });

        if (implantTypeQty && implantTypePrice && implantTypeName) {
            const qty = parseFloat(implantTypeQty.value) || 0;
            console.log('Implant Type Qty:', qty);
            if (qty > 0) {
                const price = parseFloat(implantTypePrice.value) || 0;
                const total = qty * price;
                const implantData = {
                    item: implantTypeName.textContent.trim(),
                    qty: qty,
                    price: price,
                    total: total,
                    rowIndex: -1, // Special index for implant type
                    isImplantType: true // Flag to identify implant type
                };
                console.log('Adding implant type to disposablesData:', implantData);
                disposablesData.push(implantData);
            }
        }

        // Get all disposable rows with quantities > 0, preserving their row index
        document.querySelectorAll('.consumable-qty').forEach((qtyInput) => {
            const qty = parseFloat(qtyInput.value) || 0;
            if (qty > 0) {
                const row = qtyInput.closest('tr');
                const itemText = row.querySelector('td:first-child').textContent.trim();
                const priceInput = row.querySelector('.consumable-price');
                const price = parseFloat(priceInput.value) || 0;
                const totalSpan = row.querySelector('.consumable-total');
                const total = parseFloat(totalSpan.textContent.replace('$', '')) || 0;
                const rowIndex = parseInt(qtyInput.dataset.row); // Get the row index from data-row attribute

                disposablesData.push({
                    item: itemText,
                    qty: qty,
                    price: price,
                    total: total,
                    rowIndex: rowIndex // Include the original row index
                });
            }
        });

        // Add grand total
        const grandTotalText = document.getElementById('consumablesGrandTotal').textContent;
        const grandTotal = parseFloat(grandTotalText.replace('$', '')) || 0;

        return {
            items: disposablesData,
            grandTotal: grandTotal
        };
    }

    async createPurchaseOrderPdf(disposablesData, caseData, stickerPhotos) {
        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;

        // Load the template image
        const templatePath = 'documents/request-for-purchase-order-template.png';
        const imageBytes = await fetch(templatePath).then(res => res.arrayBuffer());

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Embed the template image
        const image = await pdfDoc.embedPng(imageBytes);
        const imageDims = image.scale(1);

        // Add a page with the same dimensions as the image
        const page = pdfDoc.addPage([imageDims.width, imageDims.height]);

        // Draw the template image
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: imageDims.width,
            height: imageDims.height,
        });

        // Embed fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Helper function to sanitize text for PDF encoding
        const sanitizeText = (text) => {
            // Ensure text is a string
            if (!text) return '';
            const str = String(text);

            // Remove or replace characters that can't be encoded in WinAnsi
            return str
                .replace(/×/g, 'x') // Replace multiplication sign with x
                .replace(/°/g, ' deg') // Replace degree symbol
                .replace(/'/g, "'") // Replace smart quotes
                .replace(/"/g, '"')
                .replace(/–/g, '-') // Replace en-dash
                .replace(/—/g, '-') // Replace em-dash
                .replace(/[^\x20-\x7E]/g, ''); // Remove any other non-ASCII characters
        };

        // CALIBRATION MODE - Draw alignment markers to find exact positions
        // The disposables table appears to start around row with "300073 - Exam Pin, 2.0 mm"
        // COMMENTED OUT - hidden for now, will need later for adjustments

        /*
        // Draw vertical grid lines every 50 pixels to help identify X positions
        for (let x = 0; x < imageDims.width; x += 50) {
            page.drawLine({
                start: { x: x, y: 0 },
                end: { x: x, y: imageDims.height },
                thickness: 0.5,
                color: rgb(1, 0, 0), // Red
                opacity: 0.3,
            });
            // Label the X coordinate
            page.drawText(sanitizeText(`${x}`), {
                x: x + 2,
                y: imageDims.height - 20,
                size: 8,
                font: font,
                color: rgb(1, 0, 0),
            });
        }

        // Draw horizontal grid lines every 50 pixels to help identify Y positions
        for (let y = 0; y < imageDims.height; y += 50) {
            page.drawLine({
                start: { x: 0, y: y },
                end: { x: imageDims.width, y: y },
                thickness: 0.5,
                color: rgb(0, 0, 1), // Blue
                opacity: 0.3,
            });
            // Label the Y coordinate
            page.drawText(sanitizeText(`${y}`), {
                x: 5,
                y: y + 2,
                size: 8,
                font: font,
                color: rgb(0, 0, 1),
            });
        }
        */

        // Draw test markers at estimated positions for the disposables columns
        // Adjusted based on user feedback
        const qtyX = 1015;
        const priceX = 1045; // Moved left by 20px
        const totalX = 1095; // Moved left by 20px
        const firstRowY = 1127; // PDF coordinates are from bottom (brought down 3px)
        const lineHeight = 15.5;
        const fontSize = 8;


        // Items that use double height (two lines) - map row index to whether it's double height
        const doubleHeightItems = ['400471', '501820', '400170', '502156'];

        // Map of row indices to determine which rows are double height
        const rowHeightMap = {};
        // Pre-calculate height for each row (0-34)
        const allItemsInOrder = [
            '500373', '500374', '500375', '500376', '500377', '500378', '400146', '501168', '501117',
            '400471', '501820', '500079', '500842', '500845', '400170', '501765', '501769-0250',
            '501769-0330', '501770-0330', '501770-0450', '501771-0330', '501771-0450', '501772-0450',
            '501918-0330', '501918-0450', '501939-0016', '500076', '500078', '500090', '500095',
            '500250', '500906', '500907', '501385', '502156'
        ];

        allItemsInOrder.forEach((partNum, idx) => {
            rowHeightMap[idx] = doubleHeightItems.includes(partNum) ? lineHeight * 2 : lineHeight;
        });

        // Separate implant type from disposables
        const implantTypeItem = disposablesData.items.find(item => item.isImplantType);
        const disposableItems = disposablesData.items.filter(item => !item.isImplantType);

        console.log('Implant type item found:', implantTypeItem);
        console.log('Disposable items:', disposableItems.length);

        // Draw disposable items (not including implant type)
        if (disposableItems.length > 0) {
            disposableItems.forEach((item) => {
                // Calculate Y position based on the item's original row index
                // Sum up all the heights of rows from 0 to rowIndex-1
                let yOffset = 0;
                for (let i = 0; i < item.rowIndex; i++) {
                    yOffset += rowHeightMap[i] || lineHeight;
                }

                const itemY = firstRowY - yOffset;

                // Draw quantity
                page.drawText(sanitizeText(item.qty.toString()), {
                    x: qtyX,
                    y: itemY,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });

                // Draw price
                page.drawText(sanitizeText(`$${item.price.toFixed(2)}`), {
                    x: priceX,
                    y: itemY,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });

                // Draw total
                page.drawText(sanitizeText(`$${item.total.toFixed(2)}`), {
                    x: totalX,
                    y: itemY,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });
            });
        }

        // Disposable Total - moved up by 7px, then down by 3px
        const disposableTotalY = 354;

        // Draw Implant Type if present (above disposable total)
        if (implantTypeItem) {
            const implantTypeNameQtyPriceY = disposableTotalY + 80 + 20 - 7 + 4; // Name, qty, price up by 20 then down by 7 then up by 4
            const implantTypeTotalY = disposableTotalY + 80 - 10 - 10 + 5 - 2; // Total down by 10 then down by 10 then up by 5 then down by 2

            // Draw implant type name
            page.drawText(sanitizeText(implantTypeItem.item), {
                x: 775,
                y: implantTypeNameQtyPriceY,
                size: fontSize,
                font: fontBold,
                color: rgb(0, 0, 0),
            });

            // Draw quantity
            page.drawText(sanitizeText(implantTypeItem.qty.toString()), {
                x: 965,
                y: implantTypeNameQtyPriceY,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });

            // Draw price (no $ sign)
            page.drawText(sanitizeText(`${implantTypeItem.price.toFixed(2)}`), {
                x: 1025,
                y: implantTypeNameQtyPriceY,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });

            // Draw total (no $ sign)
            page.drawText(sanitizeText(`${implantTypeItem.total.toFixed(2)}`), {
                x: totalX,
                y: implantTypeTotalY,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
        }
        page.drawText(sanitizeText('Disposable Total:'), {
            x: 950,
            y: disposableTotalY,
            size: 9,
            font: fontBold,
            color: rgb(0, 0, 0),
        });
        page.drawText(sanitizeText(disposablesData.grandTotal.toFixed(2)), {
            x: 1085,
            y: disposableTotalY,
            size: 9,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Grand Total (30px below disposable total, same value) - moved 10px right and 10px down
        const grandTotalY = disposableTotalY - 30;
        page.drawText(sanitizeText('Grand Total:'), {
            x: 970,
            y: grandTotalY,
            size: 9,
            font: fontBold,
            color: rgb(0, 0, 0),
        });
        page.drawText(sanitizeText(disposablesData.grandTotal.toFixed(2)), {
            x: 1085,
            y: grandTotalY,
            size: 9,
            font: fontBold,
            color: rgb(0, 0, 0),
        });

        // CALIBRATION - Add case data fields with test positioning
        // These positions are estimates based on the template image structure

        // Physician Name - positioned to the right of "Physician (Full Name):" label
        // OCR found label at x:78, y:199 (from top), width:125
        // Input field starts at x: 78+125 = 203
        // PDF y-coord = imageDims.height - 199 - 17 - 10 (brought down 10px)
        page.drawText(sanitizeText(caseData.physicianName || 'Dr. Test Physician'), {
            x: 210,
            y: imageDims.height - 220,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Facility City, State, Zip - moved down 5px (define first so we can use cityStateZipY)
        const cityStateZip = `${caseData.facilityData.city || 'Test City'}, ${caseData.facilityData.state || 'CA'} ${caseData.facilityData.zip || '12345'}`;
        const cityStateZipY = imageDims.height - 201;
        page.drawText(sanitizeText(cityStateZip), {
            x: 150,
            y: cityStateZipY,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Facility Address - positioned 20px above city/st/zip, moved up 2px
        page.drawText(sanitizeText(caseData.facilityData.address || '123 Test Street'), {
            x: 130,
            y: cityStateZipY + 22,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Institution/Facility Name - positioned 20px above address
        page.drawText(sanitizeText(caseData.facilityData.name || 'TEST FACILITY NAME'), {
            x: 145,
            y: cityStateZipY + 42,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Sales Rep Name - positioned 20px above city/st/zip (which means +20 in y coordinate)
        const salesRepY = cityStateZipY + 20;
        page.drawText(sanitizeText(caseData.salesRepName || 'TEST REP NAME'), {
            x: 700,
            y: salesRepY,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Case Date - positioned 40px above sales rep name
        page.drawText(sanitizeText(caseData.caseDate || 'NO DATE'), {
            x: 670,
            y: salesRepY + 40,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
        });

        // Helper function to calculate dimensions with max constraints
        const calculateImageDimensions = (image, maxWidth = 300, maxHeight = 300) => {
            const originalWidth = image.width;
            const originalHeight = image.height;

            // Calculate scale to fit within constraints
            const widthScale = maxWidth / originalWidth;
            const heightScale = maxHeight / originalHeight;
            const scale = Math.min(widthScale, heightScale, 1); // Don't scale up

            return {
                width: originalWidth * scale,
                height: originalHeight * scale
            };
        };

        // Add sticker photos if they exist
        if (stickerPhotos) {
            // Left Side Stickers - top-left at x: 100, y: 1100 (from bottom)
            if (stickerPhotos.leftSideStickers) {
                try {
                    const leftImageBytes = await fetch(stickerPhotos.leftSideStickers).then(res => res.arrayBuffer());
                    let leftImage;
                    if (stickerPhotos.leftSideStickers.startsWith('data:image/png')) {
                        leftImage = await pdfDoc.embedPng(leftImageBytes);
                    } else {
                        leftImage = await pdfDoc.embedJpg(leftImageBytes);
                    }
                    const dims = calculateImageDimensions(leftImage);
                    // PDF coordinates are from bottom-left, so y position needs to account for image height
                    page.drawImage(leftImage, {
                        x: 100,
                        y: 1100 - dims.height, // Subtract height so top-left is at y: 1100
                        width: dims.width,
                        height: dims.height,
                    });
                } catch (error) {
                    console.error('Error embedding left side sticker:', error);
                }
            }

            // Patient Stickers - top-left at x: 100, y: 850 (from bottom)
            if (stickerPhotos.patientStickers) {
                try {
                    const patientImageBytes = await fetch(stickerPhotos.patientStickers).then(res => res.arrayBuffer());
                    let patientImage;
                    if (stickerPhotos.patientStickers.startsWith('data:image/png')) {
                        patientImage = await pdfDoc.embedPng(patientImageBytes);
                    } else {
                        patientImage = await pdfDoc.embedJpg(patientImageBytes);
                    }
                    const dims = calculateImageDimensions(patientImage);
                    page.drawImage(patientImage, {
                        x: 100,
                        y: 850 - dims.height, // Subtract height so top-left is at y: 850
                        width: dims.width,
                        height: dims.height,
                    });
                } catch (error) {
                    console.error('Error embedding patient sticker:', error);
                }
            }

            // Right Side Stickers - top-left at x: 100, y: 550 (from bottom)
            if (stickerPhotos.rightSideStickers) {
                try {
                    const rightImageBytes = await fetch(stickerPhotos.rightSideStickers).then(res => res.arrayBuffer());
                    let rightImage;
                    if (stickerPhotos.rightSideStickers.startsWith('data:image/png')) {
                        rightImage = await pdfDoc.embedPng(rightImageBytes);
                    } else {
                        rightImage = await pdfDoc.embedJpg(rightImageBytes);
                    }
                    const dims = calculateImageDimensions(rightImage);
                    page.drawImage(rightImage, {
                        x: 100,
                        y: 550 - dims.height, // Subtract height so top-left is at y: 550
                        width: dims.width,
                        height: dims.height,
                    });
                } catch (error) {
                    console.error('Error embedding right side sticker:', error);
                }
            }
        }

        // Serialize the PDF to bytes
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    }

    async showPdfPreview(pdfBytes) {
        // Show the preview modal with highest z-index
        const previewModalElement = document.getElementById('pdfPreviewModal');
        const previewModal = new bootstrap.Modal(previewModalElement);

        // Listen for modal shown event to adjust z-index to be highest
        previewModalElement.addEventListener('shown.bs.modal', () => {
            // Set z-index higher than Complete Case modal (1057)
            const backdrop = document.querySelector('.modal-backdrop:last-of-type');
            if (backdrop) {
                backdrop.style.zIndex = '1060';
            }
            previewModalElement.style.zIndex = '1061';
        }, { once: true });

        previewModal.show();

        // Create blob URL for PDF
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Load PDF.js if not already loaded
        if (!window.pdfjsLib) {
            await this.loadPdfJs();
        }

        // Initialize zoom level
        let currentZoom = 1.5;
        let defaultZoom = 1.5;
        const zoomStep = 0.25;
        const minZoom = 0.5;
        const maxZoom = 3.0;

        // Render PDF to canvas
        const canvas = document.getElementById('pdfPreviewCanvas');
        const container = document.getElementById('pdfPreviewContainer');
        const loadingTask = pdfjsLib.getDocument(url);

        // Track current render task
        let currentRenderTask = null;

        const renderPage = (zoom) => {
            // Cancel previous render if still in progress
            if (currentRenderTask) {
                currentRenderTask.cancel();
                currentRenderTask = null;
            }

            loadingTask.promise.then(pdf => {
                // Render first page
                pdf.getPage(1).then(page => {
                    const viewport = page.getViewport({ scale: zoom });
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    currentRenderTask = page.render(renderContext);
                    currentRenderTask.promise.then(() => {
                        currentRenderTask = null;
                        // Update zoom level display
                        document.getElementById('zoomLevel').textContent = `${Math.round(zoom * 100)}%`;
                    }).catch(err => {
                        if (err.name !== 'RenderingCancelledException') {
                            console.error('Render error:', err);
                        }
                        currentRenderTask = null;
                    });
                });
            });
        };

        // Calculate fit-to-width zoom and render
        return loadingTask.promise.then(pdf => {
            return pdf.getPage(1).then(page => {
                const viewport = page.getViewport({ scale: 1.0 });
                const containerWidth = container.clientWidth - 20; // Subtract padding
                let fitZoom = containerWidth / viewport.width;

                // Ensure minimum zoom level (prevent negative or very small values)
                if (!fitZoom || fitZoom < minZoom || !isFinite(fitZoom)) {
                    fitZoom = 1.0;
                }

                currentZoom = fitZoom;
                defaultZoom = fitZoom;

                // Render and wait for completion
                return loadingTask.promise.then(pdf => {
                    return pdf.getPage(1).then(page => {
                        const viewport = page.getViewport({ scale: currentZoom });
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };

                        // Return the render promise so we can wait for it
                        return page.render(renderContext).promise.then(() => {
                            // Update zoom level display
                            document.getElementById('zoomLevel').textContent = `${Math.round(currentZoom * 100)}%`;

                            // Set up zoom buttons NOW that rendering is complete
                            const zoomInBtn = document.getElementById('zoomInBtn');
                            const zoomOutBtn = document.getElementById('zoomOutBtn');
                            const resetZoomBtn = document.getElementById('resetZoomBtn');

                            if (!zoomInBtn || !zoomOutBtn || !resetZoomBtn) {
                                return;
                            }

                            // Remove old listeners if any
                            const newZoomInBtn = zoomInBtn.cloneNode(true);
                            const newZoomOutBtn = zoomOutBtn.cloneNode(true);
                            const newResetZoomBtn = resetZoomBtn.cloneNode(true);

                            zoomInBtn.parentNode.replaceChild(newZoomInBtn, zoomInBtn);
                            zoomOutBtn.parentNode.replaceChild(newZoomOutBtn, zoomOutBtn);
                            resetZoomBtn.parentNode.replaceChild(newResetZoomBtn, resetZoomBtn);

                            newZoomInBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (currentZoom < maxZoom) {
                                    currentZoom += zoomStep;
                                    renderPage(currentZoom);
                                }
                            });

                            newZoomOutBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (currentZoom > minZoom) {
                                    currentZoom -= zoomStep;
                                    renderPage(currentZoom);
                                }
                            });

                            newResetZoomBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                currentZoom = defaultZoom;
                                renderPage(currentZoom);
                            });
                        });
                    });
                });
            });
        });

        // Mouse wheel zoom
        const wheelZoomHandler = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0 && currentZoom < maxZoom) {
                    currentZoom += zoomStep;
                    renderPage(currentZoom);
                } else if (e.deltaY > 0 && currentZoom > minZoom) {
                    currentZoom -= zoomStep;
                    renderPage(currentZoom);
                }
            }
        };
        container.addEventListener('wheel', wheelZoomHandler, { passive: false });

        // Set up download button
        const downloadBtn = document.getElementById('downloadPdfBtn');
        downloadBtn.onclick = () => {
            this.downloadPdf();
        };

        // Clean up blob URL and event listeners when modal is closed
        document.getElementById('pdfPreviewModal').addEventListener('hidden.bs.modal', () => {
            URL.revokeObjectURL(url);
            container.removeEventListener('wheel', wheelZoomHandler);
        }, { once: true });
    }

    async loadPdfJs() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    downloadPdf() {
        if (!this.currentPdfBlob) {
            this.showErrorNotification('No PDF available to download');
            return;
        }

        // Create download link
        const url = URL.createObjectURL(this.currentPdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `purchase-order-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showSuccessNotification('PDF downloaded successfully');
    }

    async completeCase(caseId, completionData = null) {
        try {
            // Prepare update data
            const updateData = {
                status: CASE_STATUS.COMPLETED,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Add completion data if provided
            if (completionData) {
                updateData.completion_data = completionData;
                console.log('Saving case with completion_data:', updateData.completion_data);
            }

            console.log('Update data being saved to case:', updateData);

            // Update case status to completed
            await this.dataManager.updateCase(caseId, updateData);

            // Get all trays assigned to this case and update their status
            const trays = await this.dataManager.getAllTrays();
            const assignedTrays = trays.filter(tray =>
                tray.assignedCaseId === caseId ||
                tray.case_id === caseId ||
                (tray.assigned_cases && tray.assigned_cases.includes(caseId))
            );

            console.log(`Found ${assignedTrays.length} trays assigned to case ${caseId}`);

            // Update each assigned tray to Ready For Pickup status
            const updatePromises = assignedTrays.map(tray =>
                this.dataManager.updateTray(tray.id, {
                    status: TRAY_STATUS.READY_FOR_PICKUP,
                    assignedCaseId: null,
                    case_id: null,
                    updated_at: new Date().toISOString()
                })
            );

            await Promise.all(updatePromises);

            this.showSuccessNotification(`Case completed. ${assignedTrays.length} tray(s) marked as Ready For Pickup.`);
            this.loadCases();
        } catch (error) {
            console.error('Error completing case:', error);
            this.showErrorNotification('Error completing case: ' + error.message);
        }
    }

    async viewCaseDetails(caseId) {
        try {
            const caseData = await this.dataManager.getCase(caseId);
            if (caseData) {
                this.showCaseDetailsModal(caseData);
            }
        } catch (error) {
            console.error('Error loading case details:', error);
            this.showErrorNotification('Error loading case details');
        }
    }

    async refreshCaseDetailsModal(caseId) {
        try {
            const caseData = await this.dataManager.getCase(caseId);
            if (caseData) {
                // Only refresh the modal body content, not the entire modal
                const modalBody = document.getElementById('caseDetailsModalBody');
                if (modalBody) {
                    // Get fresh data from DataManager arrays
                    const surgeon = this.dataManager.getSurgeons().find(s => s && s.id === caseData.physician_id);
                    const facility = this.dataManager.getFacilities().find(f => f && f.id === caseData.facility_id);
                    const caseType = this.dataManager.getCaseTypes().find(ct => ct && ct.id === caseData.caseTypeId);

                    // Find the case-details div and update only the content that might have changed
                    const caseDetailsDiv = modalBody.querySelector('.case-details');
                    if (caseDetailsDiv) {
                        // Update physician name
                        const physicianElements = modalBody.querySelectorAll('[data-physician-name]');
                        physicianElements.forEach(el => {
                            el.textContent = surgeon ? surgeon.full_name : 'Unknown';
                        });

                        // If there's no data-physician-name attribute, look for the text pattern
                        if (physicianElements.length === 0) {
                            // Update the HTML directly for physician
                            const htmlContent = modalBody.innerHTML;
                            const updatedHtml = htmlContent.replace(
                                /<strong>Surgeon:<\/strong>\s*[^<]*/,
                                `<strong>Surgeon:</strong> ${surgeon ? surgeon.full_name : 'Unknown'}`
                            );
                            if (updatedHtml !== htmlContent) {
                                modalBody.innerHTML = updatedHtml;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing case details modal:', error);
        }
    }

    showCaseDetailsModal(caseData) {
        const surgeon = this.dataManager.getSurgeons().find(s => s && s.id === caseData.physician_id);
        const facility = this.dataManager.getFacilities().find(f => f && f.id === caseData.facility_id);
        const caseType = this.dataManager.getCaseTypes().find(ct => ct && ct.id === caseData.caseTypeId);

        // Format date without timezone conversion
        const formatDateOnly = (dateStr) => {
            if (!dateStr) return 'N/A';
            // Handle YYYY-MM-DD format - parse as local date
            const [year, month, day] = dateStr.split('-');
            if (year && month && day) {
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            }
            return dateStr;
        };

        const modalBody = document.getElementById('caseDetailsModalBody');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="case-details" data-case-id="${caseData.id}">
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Patient:</strong> ${caseData.patientName || 'N/A'}<br>
                            <strong>Surgeon:</strong> ${surgeon ? surgeon.full_name : 'Unknown'}<br>
                            <strong>Facility:</strong> ${facility ? facility.account_name : 'Unknown'}<br>
                            <strong>Case Type:</strong> ${caseType ? caseType.name : 'Unknown'}
                        </div>
                        <div class="col-md-6">
                            <strong>Date:</strong> ${formatDateOnly(caseData.scheduledDate)}<br>
                            <strong>Time:</strong> ${caseData.scheduledTime || 'N/A'}<br>
                            <strong>Duration:</strong> ${caseData.estimatedDuration || 'N/A'} mins<br>
                            <strong>Status:</strong> <span class="badge bg-${getCaseStatusColor(caseData.status)}">${getCaseStatusLabel(caseData.status)}</span>
                        </div>
                    </div>
                    ${this.getTrayRequirements(caseData).length > 0 ? `
                        <div class="mt-3">
                            <strong>Required Trays:</strong>
                            <ul class="mt-2">
                                ${this.getTrayRequirements(caseData).map(req => {
                                    // Handle both old format (strings) and MyRepData format (objects)
                                    if (typeof req === 'string') {
                                        return `<li>${this.getTrayTypeDisplayName(req)}</li>`;
                                    } else if (req && req.tray_name) {
                                        return `<li>${req.tray_name} ${req.requirement_type ? `(${req.requirement_type})` : ''}</li>`;
                                    }
                                    return '';
                                }).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${caseData.notes ? `
                        <div class="mt-3">
                            <strong>Notes:</strong>
                            <p class="mt-1">${caseData.notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;

            // Update modal footer to include delete button on the left
            const modalFooter = document.querySelector('#caseDetailsModal .modal-footer');
            if (modalFooter) {
                // Show different buttons based on case status
                if (isCompletedCaseStatus(caseData.status)) {
                    modalFooter.innerHTML = `
                        <div class="d-flex justify-content-between w-100">
                            <div>
                                <button type="button" class="btn btn-info" onclick="window.app.casesManager.downloadCompletedCaseRPO('${caseData.id}', '${caseData.facility_id || caseData.facility}', '${caseData.case_type || caseData.type}')">
                                    <i class="fas fa-download"></i> Download RPO
                                </button>
                            </div>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    `;
                } else {
                    modalFooter.innerHTML = `
                        <div class="d-flex justify-content-between w-100">
                            <div>
                                <button type="button" class="btn btn-warning me-2" onclick="window.app.casesManager.cancelCase('${caseData.id}')" data-bs-dismiss="modal">
                                    <i class="fas fa-times-circle"></i> Cancel Case
                                </button>
                                <button type="button" class="btn btn-success" onclick="window.app.casesManager.showCompleteCaseModal('${caseData.id}')">
                                    <i class="fas fa-check-circle"></i> Complete Case
                                </button>
                            </div>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    `;
                }
            }

            const modal = new bootstrap.Modal(document.getElementById('caseDetailsModal'));
            modal.show();
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Populate case status dropdown with valid statuses
    populateCaseStatusDropdown(selectElementId) {
        const select = document.getElementById(selectElementId);
        if (!select) {
            return;
        }

        // Clear existing options
        select.innerHTML = '';

        // Add status options from constants
        CASE_STATUS_OPTIONS.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });
    }

    async handleCaseRemovedTrays(caseId) {
        try {
            
            // Get all trays from the tray manager or data manager
            let allTrays = [];
            if (window.app?.trayManager?.currentTrays) {
                allTrays = window.app.trayManager.currentTrays;
            } else if (window.app?.dataManager) {
                // Fallback to get trays from data manager
                allTrays = await window.app.dataManager.getAllTrays() || [];
            }
            
            if (allTrays.length === 0) {
                return;
            }
            
            // Find all trays that are checked in for this specific case
            const checkedInTrays = allTrays.filter(tray => {
                return tray.facility === caseId && isCheckedInStatus(tray.status);
            });
            
            if (checkedInTrays.length === 0) {
                console.log(`No checked-in trays found for case ${caseId}`);
                return;
            }
            
            console.log(`Found ${checkedInTrays.length} checked-in trays for removed case ${caseId}:`, 
                checkedInTrays.map(t => t.name || t.id));
            
            // Update each checked-in tray to move it to trunk and set status to available
            let updatedCount = 0;
            let errorCount = 0;
            const errors = [];
            
            for (const tray of checkedInTrays) {
                try {
                    const updates = {
                        location: TRAY_LOCATIONS.TRUNK,
                        status: TRAY_STATUS.AVAILABLE,
                        facility: '', // Clear the facility association
                        caseDate: '',
                        surgeon: '',
                        notes: `Auto-moved to trunk when case was removed`
                    };
                    
                    await window.app.dataManager.updateTray(tray.id, updates);
                    
                    // Add history entry
                    await window.app.dataManager.addHistoryEntry(
                        tray.id, 
                        'case_removed', 
                        `Moved to trunk automatically when case ${caseId} was removed`
                    );
                    
                    console.log(`✅ Moved tray ${tray.name || tray.id} to trunk`);
                    updatedCount++;
                    
                } catch (trayError) {
                    console.error(`❌ Error updating tray ${tray.name || tray.id}:`, trayError);
                    errorCount++;
                    errors.push({
                        trayId: tray.id,
                        trayName: tray.name || 'Unknown',
                        error: trayError.message
                    });
                }
            }
            
            // Show summary notification
            if (updatedCount > 0) {
                const message = errorCount > 0 
                    ? `${updatedCount} trays moved to trunk, ${errorCount} errors occurred`
                    : `${updatedCount} trays automatically moved to trunk`;
                    
                this.showSuccessNotification(message);
                console.log(`✅ Case removal tray update complete: ${updatedCount} updated, ${errorCount} errors`);
            }
            
            if (errorCount > 0) {
                console.error('Tray update errors:', errors);
                if (window.frontendLogger) {
                    window.frontendLogger.error('Error moving trays to trunk for removed case', {
                        caseId,
                        updatedCount,
                        errorCount,
                        errors
                    }, 'case-tray-update');
                }
            }
            
        } catch (error) {
            console.error(`❌ Error handling removed case trays for ${caseId}:`, error);
            if (window.frontendLogger) {
                window.frontendLogger.error('Error in handleCaseRemovedTrays', {
                    caseId,
                    error: error.message
                }, 'case-tray-update');
            }
            this.showErrorNotification('Error moving trays to trunk: ' + error.message);
        }
    }

    async sendCaseUpdateNotifications(caseId, physicianId, caseData) {
        try {
            if (!physicianId) {
                console.log('⚠️ No physician_id for case, skipping notifications');
                return;
            }

            console.log('📢 Sending case update notifications for physician:', physicianId);

            // Get all users
            const users = this.dataManager.getUsers();
            if (!users || users.size === 0) {
                console.log('⚠️ No users found, skipping notifications');
                return;
            }

            // Get physician and facility info for the notification message
            const physician = this.dataManager.getPhysicians().get(physicianId);
            const physicianName = physician ? physician.name : 'Unknown Physician';
            const facility = caseData.facility_id ? this.dataManager.getFacilities().get(caseData.facility_id) : null;
            const facilityName = facility ? facility.name : 'Unknown Facility';

            // Prepare notification message
            const caseInfo = {
                patientName: caseData.patientName || 'Unknown Patient',
                physicianName: physicianName,
                facilityName: facilityName,
                scheduledDate: caseData.scheduledDate || 'Not scheduled',
                status: caseData.status || 'Unknown'
            };

            const emailSubject = `Case Updated: ${caseInfo.patientName} - ${physicianName}`;
            const emailText = `A case has been updated:\n\nPatient: ${caseInfo.patientName}\nPhysician: ${physicianName}\nFacility: ${facilityName}\nScheduled Date: ${caseInfo.scheduledDate}\nStatus: ${caseInfo.status}`;
            const emailHtml = `
                <h3>Case Update Notification</h3>
                <p>A case has been updated with the following details:</p>
                <ul>
                    <li><strong>Patient:</strong> ${caseInfo.patientName}</li>
                    <li><strong>Physician:</strong> ${physicianName}</li>
                    <li><strong>Facility:</strong> ${facilityName}</li>
                    <li><strong>Scheduled Date:</strong> ${caseInfo.scheduledDate}</li>
                    <li><strong>Status:</strong> ${caseInfo.status}</li>
                </ul>
            `;

            const smsMessage = `Case Updated: ${caseInfo.patientName} with Dr. ${physicianName} at ${facilityName} on ${caseInfo.scheduledDate}. Status: ${caseInfo.status}`;

            // Iterate through all users and check their notification preferences
            for (const [userId, user] of users) {
                try {
                    let sendEmail = false;
                    let sendSMS = false;

                    // Check if user has physician_notification_preferences
                    if (user.physician_notification_preferences &&
                        typeof user.physician_notification_preferences === 'object') {

                        // Check if this physician is in their preferences
                        const physicianPref = user.physician_notification_preferences[physicianId];

                        if (physicianPref) {
                            // User has specific preferences for this physician
                            sendEmail = physicianPref.enableEmail === true;
                            sendSMS = physicianPref.enableSMS === true;
                            console.log(`📋 User ${user.name} has preferences for physician ${physicianId}: Email=${sendEmail}, SMS=${sendSMS}`);
                        } else {
                            // User has preferences configured but not for this physician - don't send
                            console.log(`📋 User ${user.name} has preferences but not for physician ${physicianId}, skipping`);
                            continue;
                        }
                    } else {
                        // No preferences set - send both email and SMS
                        sendEmail = true;
                        sendSMS = true;
                        console.log(`📋 User ${user.name} has no preferences set, sending both Email and SMS`);
                    }

                    // Send email notification if enabled
                    if (sendEmail && user.email) {
                        try {
                            await emailNotifications.sendEmail({
                                to: user.email,
                                subject: emailSubject,
                                text: emailText,
                                html: emailHtml
                            });
                            console.log(`✅ Email sent to ${user.name} (${user.email})`);
                        } catch (emailError) {
                            console.error(`❌ Failed to send email to ${user.name}:`, emailError);
                        }
                    }

                    // Send SMS notification if enabled
                    if (sendSMS && user.phone) {
                        try {
                            await smsNotifications.sendSMS({
                                to: user.phone,
                                message: smsMessage
                            });
                            console.log(`✅ SMS sent to ${user.name} (${user.phone})`);
                        } catch (smsError) {
                            console.error(`❌ Failed to send SMS to ${user.name}:`, smsError);
                        }
                    }

                } catch (userError) {
                    console.error(`❌ Error processing notifications for user ${user.name}:`, userError);
                }
            }

            console.log('✅ Case update notifications sent');

        } catch (error) {
            console.error('❌ Error sending case update notifications:', error);
            // Don't throw error - we don't want to block case update if notifications fail
        }
    }

    showSuccessNotification(message) {
        if (window.app && window.app.notificationManager) {
            window.app.notificationManager.show(message, 'success');
        } else {
            alert(message);
        }
    }

    showErrorNotification(message) {
        // Log the error first
        if (window.frontendLogger) {
            window.frontendLogger.error('Case operation error', {
                errorMessage: message,
                hasNotificationManager: !!window.app?.notificationManager,
                notificationManagerMethods: window.app?.notificationManager ? Object.keys(window.app.notificationManager) : 'None'
            }, 'case-error');
        }
        
        // Try different notification methods
        if (window.app?.notificationManager?.show) {
            window.app.notificationManager.show(message, 'error');
        } else if (window.app?.notificationManager?.showError) {
            window.app.notificationManager.showError(message);
        } else if (window.app?.notificationManager?.error) {
            window.app.notificationManager.error(message);
        } else {
            console.error('Cases Error:', message);
            alert(`Error: ${message}`);
        }
    }


    getFacilityDisplayName(facilityId, facilities) {
        if (!facilityId) return 'No Facility';

        // If it's already a name (not an ID), return it
        if (facilityId.length > 20 && !facilityId.match(/^[a-zA-Z0-9]{20}$/)) {
            return facilityId;
        }

        // First try the provided facilities array/map
        if (facilities) {
            // Handle if facilities is a Map
            if (facilities instanceof Map) {
                const facility = facilities.get(facilityId);
                if (facility) {
                    return facility.account_name || facility.name || 'Unknown Facility';
                }
            }
            // Handle if facilities is an array
            else if (Array.isArray(facilities) && facilities.length > 0) {
                const facility = facilities.find(f => f && f.id === facilityId);
                if (facility) {
                    return facility.account_name || facility.name || 'Unknown Facility';
                }
            }
        }

        // Try facilityManager as backup
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f && f.id === facilityId);
            if (facility) {
                return facility.account_name || facility.name || 'Unknown Facility';
            }
        }

        if (facilities && ((Array.isArray(facilities) && facilities.length === 0) || (facilities instanceof Map && facilities.size === 0))) {
            return 'Loading...';
        } else {
            return `Unknown Facility (${facilityId.substring(0, 8)}...)`;
        }
    }

    getPhysicianName(physicianId) {
        if (window.app.dataManager && window.app.dataManager.physicians) {
            const physician = window.app.dataManager.physicians.find(p => p.id === physicianId);
            return physician ? physician.full_name : null;
        }
        return null;
    }

    // Helper function to get surgeon name from ID - consistent with DashboardManager
    getSurgeonName(surgeonId) {
        return getPhysicianName(surgeonId, this.dataManager.getSurgeons());
    }

    // Calendar modal functionality - same as DashboardManager
    async showCalendarModal(caseId) {
        try {
            // Get case data
            const caseData = await this.dataManager.getCase(caseId);
            if (!caseData) {
                this.showErrorNotification('Case not found');
                return;
            }

            // Get additional data
            const physicianName = this.getSurgeonName(caseData.physician_id) || 'Unknown Physician';
            const facilityName = this.getFacilityName(caseData.facility_id) || 'Unknown Facility';
            const caseTypeName = this.getCaseTypeName(caseData.caseTypeId) || 'Surgery';

            // Create the modal HTML
            const modalHtml = `
                <div class="modal fade" id="calendarModal" tabindex="-1" role="dialog" aria-labelledby="calendarModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="calendarModalLabel">
                                    <i class="fas fa-calendar-plus me-2"></i>Add to Calendar
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="case-info mb-3">
                                    <h6><strong>Case Details:</strong></h6>
                                    <p class="mb-1"><strong>Patient:</strong> ${caseData.patientName || 'N/A'}</p>
                                    <p class="mb-1"><strong>Procedure:</strong> ${caseTypeName}</p>
                                    <p class="mb-1"><strong>Physician:</strong> ${physicianName}</p>
                                    <p class="mb-1"><strong>Facility:</strong> ${facilityName}</p>
                                    <p class="mb-1"><strong>Date:</strong> ${caseData.scheduledDate}</p>
                                    <p class="mb-1"><strong>Time:</strong> ${caseData.scheduledTime || '08:00'}</p>
                                </div>
                                <div class="calendar-options">
                                    <h6><strong>Choose an option:</strong></h6>
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-primary" onclick="window.app.casesManager.addToGoogleCalendar('${caseId}')">
                                            <i class="fab fa-google me-2"></i>Add to Google Calendar
                                        </button>
                                        <button class="btn btn-secondary" onclick="window.app.casesManager.downloadICS('${caseId}')">
                                            <i class="fas fa-download me-2"></i>Download ICS File
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if present
            const existingModal = document.getElementById('calendarModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Add modal to document
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('calendarModal'));
            modal.show();

            // Clean up modal after it's hidden
            document.getElementById('calendarModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });

        } catch (error) {
            console.error('Error showing calendar modal:', error);
            this.showErrorNotification('Error loading case data');
        }
    }

    async addToGoogleCalendar(caseId) {
        try {
            const caseData = await this.dataManager.getCase(caseId);
            if (!caseData) return;

            const physicianName = this.getSurgeonName(caseData.physician_id) || 'Unknown Physician';
            const facilityName = this.getFacilityName(caseData.facility_id) || 'Unknown Facility';
            const caseTypeName = this.getCaseTypeName(caseData.caseTypeId) || 'Surgery';

            // Create Google Calendar URL
            const eventTitle = `${caseTypeName} - ${caseData.patientName || 'Patient'}`;
            const eventDetails = `Surgical Procedure Details:
Patient: ${caseData.patientName || 'N/A'}
Procedure: ${caseTypeName}
Physician: ${physicianName}
Facility: ${facilityName}
Duration: ${caseData.estimatedDuration || 60} minutes
${caseData.notes ? `Notes: ${caseData.notes}` : ''}`;

            // Format date and time for Google Calendar
            const eventDate = caseData.scheduledDate.replace(/-/g, '');
            const eventTime = (caseData.scheduledTime || '08:00').replace(':', '') + '00';
            const startDateTime = eventDate + 'T' + eventTime;

            // Calculate end time (add estimated duration)
            const duration = caseData.estimatedDuration || 60;
            const startTime = new Date(`${caseData.scheduledDate}T${caseData.scheduledTime || '08:00'}`);
            const endTime = new Date(startTime.getTime() + duration * 60000);
            const endDateTime = endTime.toISOString().replace(/[-:]/g, '').split('.')[0];

            const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startDateTime}/${endDateTime}&details=${encodeURIComponent(eventDetails)}&location=${encodeURIComponent(facilityName)}`;

            // Open Google Calendar in new tab
            window.open(googleUrl, '_blank');

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('calendarModal'));
            if (modal) modal.hide();

        } catch (error) {
            console.error('Error adding to Google Calendar:', error);
            this.showErrorNotification('Error creating calendar event');
        }
    }

    async downloadICS(caseId) {
        try {
            const caseData = await this.dataManager.getCase(caseId);
            if (!caseData) return;

            const physicianName = this.getSurgeonName(caseData.physician_id) || 'Unknown Physician';
            const facilityName = this.getFacilityName(caseData.facility_id) || 'Unknown Facility';
            const caseTypeName = this.getCaseTypeName(caseData.caseTypeId) || 'Surgery';

            // Create ICS content
            const eventTitle = `${caseTypeName} - ${caseData.patientName || 'Patient'}`;
            const eventDescription = `Surgical Procedure Details:\\n` +
                `Patient: ${caseData.patientName || 'N/A'}\\n` +
                `Procedure: ${caseTypeName}\\n` +
                `Physician: ${physicianName}\\n` +
                `Facility: ${facilityName}\\n` +
                `Duration: ${caseData.estimatedDuration || 60} minutes\\n` +
                `${caseData.notes ? `Notes: ${caseData.notes}` : ''}`;

            // Format dates for ICS
            const startDate = new Date(`${caseData.scheduledDate}T${caseData.scheduledTime || '08:00'}`);
            const endDate = new Date(startDate.getTime() + (caseData.estimatedDuration || 60) * 60000);

            const formatICSDate = (date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TrayTracker//Surgery Calendar//EN
BEGIN:VEVENT
UID:${caseId}@traytracker.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${eventTitle}
DESCRIPTION:${eventDescription}
LOCATION:${facilityName}
END:VEVENT
END:VCALENDAR`;

            // Create and download file
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `surgery-${caseData.patientName?.replace(/[^a-zA-Z0-9]/g, '-') || 'case'}-${caseData.scheduledDate}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('calendarModal'));
            if (modal) modal.hide();

            this.showSuccessNotification('Calendar file downloaded successfully');

        } catch (error) {
            console.error('Error downloading ICS file:', error);
            this.showErrorNotification('Error creating calendar file');
        }
    }

    // Helper method to get case type name
    getCaseTypeName(caseTypeId) {
        const caseTypes = this.dataManager.getCaseTypes();
        const caseType = caseTypes.find(ct => ct && ct.id === caseTypeId);
        return caseType ? caseType.name : null;
    }

    // Helper method to get facility name
    getFacilityName(facilityId) {
        if (!facilityId) return null;

        // If it's already a name (not an ID), return it
        if (facilityId.length > 20 && !facilityId.match(/^[a-zA-Z0-9]{20}$/)) {
            return facilityId;
        }

        // Try to find facility by ID using DataManager
        const facilities = this.dataManager.getFacilities();
        if (facilities && facilities.length > 0) {
            const facility = facilities.find(f => f && f.id === facilityId);
            return facility ? (facility.account_name || facility.name) : null;
        }

        return null; // Return null if facility not found instead of ID
    }


    // Delegate to DashboardManager for check-in functionality
    async showManualCheckInModal(caseId) {
        if (window.app.dashboardManager) {
            await window.app.dashboardManager.showManualCheckInModal(caseId);
        } else {
            console.error('DashboardManager not available');
            this.showErrorNotification('Check-in functionality not available');
        }
    }

    // Loader methods
    showLoader(message = 'Loading...') {
        const loadingScreen = document.getElementById('loadingScreen');
        const loadingText = document.querySelector('.loading-text');
        if (loadingScreen) {
            if (loadingText) {
                loadingText.textContent = message;
            }
            // Set high z-index to appear above modals
            loadingScreen.style.zIndex = '9999';
            loadingScreen.style.display = 'flex';
            console.log('Loader shown:', message);
        } else {
            console.error('Loading screen element not found');
        }
    }

    hideLoader() {
        const loadingScreen = document.getElementById('loadingScreen');
        const loadingText = document.querySelector('.loading-text');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
            if (loadingText) {
                loadingText.textContent = 'Loading Tray Tracker...';
            }
            console.log('Loader hidden');
        }
    }
}