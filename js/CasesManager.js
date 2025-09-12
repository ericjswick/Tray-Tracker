// js/CasesManager.js - Cases Management for Tray Tracker
import { CASE_STATUS, CASE_STATUS_OPTIONS, DEFAULT_CASE_STATUS, getCaseStatusClass, isValidCaseStatus, populateCaseStatusDropdown } from './constants/CaseStatus.js';
import { TRAY_LOCATIONS } from './constants/TrayLocations.js';
import { TRAY_STATUS, isCheckedInStatus } from './constants/TrayStatus.js';

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
        // Wait for essential data before loading cases
        this.waitForEssentialDataThenLoad();
    }
    
    async waitForEssentialDataThenLoad() {
        console.log('Waiting for essential data (surgeons, facilities, case types) to load...');
        
        // Wait for essential data to be available
        const maxWait = 50; // 5 seconds max
        let attempts = 0;
        
        while (attempts < maxWait) {
            const surgeons = this.dataManager.getSurgeons();
            const facilities = this.dataManager.getFacilities();
            const caseTypes = this.dataManager.getCaseTypes();
            
            // Check if we have some data (at least one item in each or empty arrays are OK)
            if (surgeons !== null && facilities !== null && caseTypes !== null) {
                console.log(`✅ Essential data loaded - Surgeons: ${surgeons.length}, Facilities: ${facilities.length}, Case Types: ${caseTypes.length}`);
                this.loadCases();
                this.setupDataUpdateListeners();
                return;
            }
            
            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.warn('⚠️ Timeout waiting for essential data, loading cases anyway...');
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
                
                console.log('📊 Reference data updated, re-rendering cases...');
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
                case_type: caseTypeName, // MyRepData compatibility
                scheduledDate: scheduledDate, // Store date (assume CDT)
                scheduledTime: scheduledTime, // Store time (assume CDT)
                estimatedDuration: parseInt(document.getElementById('estimatedDuration').value) || 60,
                status: document.getElementById('caseStatus').value || DEFAULT_CASE_STATUS,
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
                console.log('Case saved successfully:', savedCase.id);
                
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
        if (this.viewMode === 'list') {
            this.renderCasesList(cases);
        } else if (this.viewMode === 'card') {
            this.renderCasesCards(cases);
        } else if (this.viewMode === 'calendar') {
            this.renderCasesCalendar(cases);
        }
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
                            <th>Patient</th>
                            <th>Surgeon</th>
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
        
        const surgeon = surgeons.find(s => s.id === caseItem.physician_id);
        const facility = facilities.find(f => f.id === caseItem.facility_id);
        const caseType = caseTypes.find(ct => ct.id === caseItem.caseTypeId);
        
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
                <td>${facility ? facility.account_name : (facilities.length === 0 ? 'Loading...' : 'Unknown')}</td>
                <td>
                    <div>${dateStr}</div>
                    <small class="text-muted">${timeStr}</small>
                </td>
                <td>${caseType ? caseType.name : (caseTypes.length === 0 ? 'Loading...' : 'Unknown')}</td>
                <td>
                    <span class="badge bg-${this.getStatusColor(caseItem.status)}">
                        ${this.capitalizeFirst(caseItem.status)}
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

    renderCasesCards(cases) {
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

        const cardsHTML = cases.map(caseItem => this.renderCaseCard(caseItem)).join('');
        container.innerHTML = `<div class="row g-3">${cardsHTML}</div>`;
    }


    renderCaseCard(caseItem) {
        const surgeons = this.dataManager.getSurgeons();
        const facilities = this.dataManager.getFacilities();
        const caseTypes = this.dataManager.getCaseTypes();
        
        const surgeon = surgeons.find(s => s.id === caseItem.physician_id);
        const facility = facilities.find(f => f.id === caseItem.facility_id);
        const caseType = caseTypes.find(ct => ct.id === caseItem.caseTypeId);
        
        // Display date/time assuming they're stored in CDT
        const scheduledDateTime = new Date(caseItem.scheduledDate + 'T' + (caseItem.scheduledTime || '08:00'));
        const dateStr = scheduledDateTime.toLocaleDateString();
        const timeStr = scheduledDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (CDT)';

        return `
            <div class="col-md-6 col-lg-4">
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
                            <span class="tray-detail-value">${surgeon ? surgeon.full_name : (surgeons.length === 0 ? 'Loading...' : 'Unknown Surgeon')}</span>
                        </div>
                        <div class="tray-detail">
                            <i class="fas fa-hospital"></i>
                            <span class="tray-detail-value">${facility ? facility.account_name : (facilities.length === 0 ? 'Loading...' : 'Unknown Facility')}</span>
                        </div>
                        <div class="tray-detail">
                            <i class="fas fa-calendar"></i>
                            <span class="tray-detail-value">${dateStr} at ${timeStr}</span>
                        </div>
                        <div class="tray-detail">
                            <i class="fas fa-stethoscope"></i>
                            <span class="tray-detail-value">${caseType ? caseType.name : (caseTypes.length === 0 ? 'Loading...' : 'Unknown Type')}</span>
                        </div>
                        <div class="tray-detail">
                            <i class="fas fa-cube"></i>
                            <span class="tray-detail-value">${this.getTrayRequirements(caseItem).length} Trays Required</span>
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
                        <button class="btn btn-sm btn-outline-danger" onclick="window.app.casesManager.deleteCase('${caseItem.id}')" title="Delete Case">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
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
                                                ${this.dataManager.getSurgeons().find(s => s.id === caseItem.physician_id)?.full_name || 'Unknown Surgeon'}
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
        const today = new Date().toISOString().split('T')[0];
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
                            hasTrayRequirements: !!(caseData.tray_requirements || caseData.trayRequirements),
                            trayRequirementsCount: (caseData.tray_requirements || caseData.trayRequirements || []).length
                        }
                    }, 'case-edit-flow');
                }
                this.populateEditForm(caseData);
                
                const modal = new bootstrap.Modal(document.getElementById('editCaseModal'));
                modal.show();
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
        document.getElementById('editCasePhysician').value = caseData.physician_id || '';
        document.getElementById('editCaseFacility').value = caseData.facility_id || '';
        document.getElementById('editCaseType').value = caseData.caseTypeId || '';
        document.getElementById('editScheduledDate').value = caseData.scheduledDate || '';
        document.getElementById('editScheduledTime').value = caseData.scheduledTime || '';
        document.getElementById('editEstimatedDuration').value = caseData.estimatedDuration || '';
        
        // Initialize and populate case status dropdown using central function
        const statusDropdown = document.getElementById('editCaseStatus');
        if (statusDropdown) {
            populateCaseStatusDropdown(statusDropdown, {
                includeAllOption: false,
                includeEmptyOption: false,
                selectedValue: caseData.status || DEFAULT_CASE_STATUS
            });
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
        const result = caseData.tray_requirements || caseData.trayRequirements || [];
        
        if (window.frontendLogger) {
            window.frontendLogger.info('CasesManager.getTrayRequirements() called', {
                caseId: caseData.id,
                tray_requirements: caseData.tray_requirements,
                trayRequirements: caseData.trayRequirements,
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
            
            const updates = {
                patientName: document.getElementById('editPatientName').value,
                physician_id: document.getElementById('editCasePhysician').value,
                facility_id: document.getElementById('editCaseFacility').value,
                caseTypeId: document.getElementById('editCaseType').value,
                scheduledDate: document.getElementById('editScheduledDate').value,
                scheduledTime: document.getElementById('editScheduledTime').value,
                estimatedDuration: parseInt(document.getElementById('editEstimatedDuration').value) || 60,
                status: document.getElementById('editCaseStatus').value,
                priority: document.getElementById('editCasePriority').value,
                notes: document.getElementById('editCaseNotes').value,
                tray_requirements: trayRequirements
            };

            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('About to save case with tray requirements', { 
                    caseId: caseId,
                    trayRequirements: trayRequirements,
                    trayRequirementsLength: trayRequirements?.length,
                    patientName: updates.patientName
                }, 'case-save-flow');
            }

            await this.dataManager.updateCase(caseId, updates);
            
            // Check if case status was changed to "Removed" - if so, move all checked-in trays to trunk
            if (updates.status === 'removed') {
                await this.handleCaseRemovedTrays(caseId);
            }
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('Case saved successfully', { 
                    caseId: caseId 
                }, 'case-save-flow');
            }
            
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

    showCaseDetailsModal(caseData) {
        const surgeon = this.dataManager.getSurgeons().find(s => s.id === caseData.physician_id);
        const facility = this.dataManager.getFacilities().find(f => f.id === caseData.facility_id);
        const caseType = this.dataManager.getCaseTypes().find(ct => ct.id === caseData.caseTypeId);

        const modalBody = document.getElementById('caseDetailsModalBody');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="case-details">
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Patient:</strong> ${caseData.patientName || 'N/A'}<br>
                            <strong>Surgeon:</strong> ${surgeon ? surgeon.full_name : 'Unknown'}<br>
                            <strong>Facility:</strong> ${facility ? facility.account_name : 'Unknown'}<br>
                            <strong>Case Type:</strong> ${caseType ? caseType.name : 'Unknown'}
                        </div>
                        <div class="col-md-6">
                            <strong>Date:</strong> ${new Date(caseData.scheduledDate).toLocaleDateString()}<br>
                            <strong>Time:</strong> ${caseData.scheduledTime || 'N/A'}<br>
                            <strong>Duration:</strong> ${caseData.estimatedDuration || 'N/A'} mins<br>
                            <strong>Status:</strong> <span class="badge bg-${this.getStatusColor(caseData.status)}">${this.capitalizeFirst(caseData.status)}</span>
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
            
            const modal = new bootstrap.Modal(document.getElementById('caseDetailsModal'));
            modal.show();
        }
    }

    getStatusColor(status) {
        const colors = {
            'scheduled': 'primary',
            'in-progress': 'warning',
            'completed': 'success',
            'cancelled': 'danger',
            'postponed': 'secondary'
        };
        return colors[status] || 'secondary';
    }

    getStatusClass(status) {
        const classes = {
            'scheduled': 'status-scheduled',
            'in-progress': 'status-in-progress', 
            'completed': 'status-completed',
            'cancelled': 'status-cancelled',
            'postponed': 'status-postponed'
        };
        return classes[status] || 'status-unknown';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Populate case status dropdown with valid statuses
    populateCaseStatusDropdown(selectElementId) {
        const select = document.getElementById(selectElementId);
        if (!select) {
            console.warn(`Status dropdown element ${selectElementId} not found`);
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
            console.log(`🔄 Case ${caseId} set to Removed - moving checked-in trays to trunk`);
            
            // Get all trays from the tray manager or data manager
            let allTrays = [];
            if (window.app?.trayManager?.currentTrays) {
                allTrays = window.app.trayManager.currentTrays;
            } else if (window.app?.dataManager) {
                // Fallback to get trays from data manager
                allTrays = await window.app.dataManager.getAllTrays() || [];
            }
            
            if (allTrays.length === 0) {
                console.log('No trays found to process');
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

    getFacilityName(facilityId) {
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            return facility ? facility.account_name : null;
        }
        return null;
    }

    getPhysicianName(physicianId) {
        if (window.app.dataManager && window.app.dataManager.physicians) {
            const physician = window.app.dataManager.physicians.find(p => p.id === physicianId);
            return physician ? physician.full_name : null;
        }
        return null;
    }
}