// js/TrayManager.js - Updated for Tray Tracker
import { TRAY_STATUS, normalizeStatus, isInUseStatus, isAvailableStatus, isCheckedInStatus, getStatusDisplayText, getStatusColor } from './constants/TrayStatus.js';
import { TRAY_LOCATIONS, getLocationDisplayText, getLocationIcon } from './constants/TrayLocations.js';
export class TrayManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentTrays = [];
        this.viewMode = this.getStoredViewMode();
        console.log('TrayManager constructor - facility debug version loaded');
    }

    getStoredViewMode() {
        return localStorage.getItem('trayViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('trayViewMode', mode);

        // Update button states
        const cardBtn = document.getElementById('cardViewBtn');
        const listBtn = document.getElementById('listViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        // Update view containers
        const cardView = document.getElementById('trayCardView');
        const listView = document.getElementById('trayListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        // Re-render trays in the new view mode
        this.renderTrays(this.currentTrays);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
    }

    async addTray() {
        try {
            const locationValue = document.getElementById('initialLocation').value;

            if (!locationValue) {
                this.showErrorNotification('Please select an initial location');
                return;
            }

            // Get selected case type compatibility (multiple values)
            const trayTypeSelect = document.getElementById('trayType');
            const selectedCaseTypes = Array.from(trayTypeSelect.selectedOptions).map(option => option.value);
            
            // Get assigned user from dropdown
            const assignedTo = document.getElementById('trayAssignedTo').value || '';
            
            const trayData = {
                name: document.getElementById('trayName').value,
                type: '', // Keep empty for legacy compatibility if no types selected
                case_type_compatibility: selectedCaseTypes, // MyRepData format
                status: document.getElementById('trayStatus').value || TRAY_STATUS.AVAILABLE, // Use selected status or default to available
                location: locationValue,
                facility: '',
                caseDate: '',
                surgeon: '',
                assignedTo: assignedTo,
                notes: ''
            };

            const savedTray = await this.dataManager.saveTray(trayData);
            if (savedTray && savedTray.id) {
                let historyMessage = `Tray created at ${this.getLocationText(trayData.location)}`;
                if (assignedTo) {
                    const assignedUserName = this.getUserName(assignedTo);
                    historyMessage += ` and assigned to ${assignedUserName}`;
                }
                await this.dataManager.addHistoryEntry(savedTray.id, 'created', historyMessage);
            }

            bootstrap.Modal.getInstance(document.getElementById('addTrayModal')).hide();
            document.getElementById('addTrayForm').reset();

            this.showSuccessNotification('Tray added successfully!');
        } catch (error) {
            console.error('Error adding tray:', error);
            this.showErrorNotification('Error adding tray: ' + error.message);
        }
    }

    async showEditTrayModal(trayId) {
        const tray = this.currentTrays.find(t => t.id === trayId);
        if (!tray) {
            this.showErrorNotification('Tray not found');
            return;
        }

        // Set modal to edit mode
        document.getElementById('addTrayModalTitle').textContent = 'Edit Tray';
        document.getElementById('addTrayModalButton').textContent = 'Update Tray';
        document.getElementById('editTrayId').value = trayId;

        // Populate dropdowns first
        await window.app.modalManager.populateInitialLocationDropdown();
        await window.app.modalManager.populateCaseTypeCompatibilityDropdown();
        await window.app.modalManager.populateTrayStatusDropdown();
        await this.populateUserDropdown();

        // Populate form with existing tray data
        document.getElementById('trayName').value = tray.name || '';
        
        // Set case type compatibility
        const trayTypeSelect = document.getElementById('trayType');
        if (tray.case_type_compatibility && Array.isArray(tray.case_type_compatibility)) {
            Array.from(trayTypeSelect.options).forEach(option => {
                option.selected = tray.case_type_compatibility.includes(option.value);
            });
        }
        
        // Set location
        document.getElementById('initialLocation').value = tray.location || '';
        
        // Set status
        document.getElementById('trayStatus').value = tray.status || 'available';
        
        // Set assigned user
        document.getElementById('trayAssignedTo').value = tray.assignedTo || '';

        // Show the modal
        new bootstrap.Modal(document.getElementById('addTrayModal')).show();
    }

    async saveTray() {
        const editTrayId = document.getElementById('editTrayId').value;
        
        if (editTrayId) {
            // Update existing tray
            await this.updateTray(editTrayId);
        } else {
            // Add new tray
            await this.addTray();
        }
    }

    async updateTray(trayId) {
        try {
            const locationValue = document.getElementById('initialLocation').value;

            if (!locationValue) {
                this.showErrorNotification('Please select a location');
                return;
            }

            // Get selected case type compatibility (multiple values)
            const trayTypeSelect = document.getElementById('trayType');
            const selectedCaseTypes = Array.from(trayTypeSelect.selectedOptions).map(option => option.value);
            
            // Get assigned user from dropdown
            const assignedTo = document.getElementById('trayAssignedTo').value || '';
            
            const updateData = {
                name: document.getElementById('trayName').value,
                case_type_compatibility: selectedCaseTypes,
                status: document.getElementById('trayStatus').value,
                location: locationValue,
                assignedTo: assignedTo,
                lastModified: new Date(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid || ''
            };

            // Check if assignment changed for history logging
            const tray = this.currentTrays.find(t => t.id === trayId);
            const oldAssignedTo = tray?.assignedTo || '';
            const assignmentChanged = oldAssignedTo !== assignedTo;

            await this.dataManager.updateTray(trayId, updateData);
            
            let historyMessage = 'Tray information updated';
            if (assignmentChanged) {
                if (assignedTo && oldAssignedTo) {
                    // Assignment changed from one user to another
                    const oldUserName = this.getUserName(oldAssignedTo);
                    const newUserName = this.getUserName(assignedTo);
                    historyMessage += ` - reassigned from ${oldUserName} to ${newUserName}`;
                } else if (assignedTo && !oldAssignedTo) {
                    // Tray was assigned to someone
                    const newUserName = this.getUserName(assignedTo);
                    historyMessage += ` - assigned to ${newUserName}`;
                } else if (!assignedTo && oldAssignedTo) {
                    // Tray was unassigned
                    const oldUserName = this.getUserName(oldAssignedTo);
                    historyMessage += ` - unassigned from ${oldUserName}`;
                }
            }
            
            await this.dataManager.addHistoryEntry(trayId, 'updated', historyMessage);

            bootstrap.Modal.getInstance(document.getElementById('addTrayModal')).hide();
            this.resetTrayModal();

            this.showSuccessNotification('Tray updated successfully!');
        } catch (error) {
            console.error('Error updating tray:', error);
            this.showErrorNotification('Error updating tray: ' + error.message);
        }
    }

    resetTrayModal() {
        // Reset modal to add mode
        document.getElementById('addTrayModalTitle').textContent = 'Add New Tray';
        document.getElementById('addTrayModalButton').textContent = 'Add Tray';
        document.getElementById('editTrayId').value = '';
        document.getElementById('addTrayForm').reset();
        
        // Set default status to available for new trays
        document.getElementById('trayStatus').value = 'available';
    }

    async checkinTray() {
        try {
            const trayId = document.getElementById('checkinTrayId').value;
            const facility = document.getElementById('checkinFacilityName').value;
            const surgeon = document.getElementById('physician').value;
            const notes = document.getElementById('checkinNotes').value;
            
            // Get selected case info if case method is selected
            const checkinMethod = document.querySelector('input[name="checkinMethod"]:checked').value;
            let caseDate = '';
            let selectedCaseId = null;
            
            if (checkinMethod === 'case') {
                selectedCaseId = document.getElementById('checkinCaseSelect').value;
                // Get case date from selected case
                if (selectedCaseId && window.app.casesManager) {
                    const caseData = window.app.casesManager.getCaseById(selectedCaseId);
                    if (caseData && caseData.scheduledDate) {
                        caseDate = caseData.scheduledTime ? `${caseData.scheduledDate}T${caseData.scheduledTime}` : caseData.scheduledDate;
                    }
                }
            } else {
                // For manual entry, use current date
                caseDate = new Date().toISOString().split('T')[0];
            }

            // Upload photo if captured
            let photoUrl = null;
            if (window.app.photoManager.hasPhoto('checkin')) {
                photoUrl = await window.app.photoManager.uploadPhoto('checkin', 'checkin-photos');
            }

            const updates = {
                status: TRAY_STATUS.IN_USE, // Use MyRepData compatible status
                location: facility, // Keep legacy location field for backward compatibility
                facility_id: facility, // Store facility ID for proper matching
                caseDate: caseDate, // Case date from selected case or current date
                next_case_id: selectedCaseId, // Store reference to selected case if applicable
                surgeon: surgeon, // Keep legacy surgeon field for backward compatibility  
                physician_id: surgeon, // Store physician ID for proper matching
                notes: notes,
                checkinPhotoUrl: photoUrl
            };

            await this.dataManager.updateTray(trayId, updates);
            await this.dataManager.addHistoryEntry(
                trayId,
                'checked-in',
                `Checked in to ${this.getFacilityName(facility)}${caseDate ? ` for case on ${caseDate}` : ''}${surgeon ? ` with ${this.getSurgeonName(surgeon)}` : ''}`,
                photoUrl
            );

            bootstrap.Modal.getInstance(document.getElementById('checkinModal')).hide();
            this.showSuccessNotification('Tray checked in successfully!');
            
            // Update any cases that require this tray for real-time sync
            await this.updateAffectedCasesTimestamp(trayId);
            
            // Refresh dashboard cards if currently viewing dashboard
            if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
                // Refresh activities card
                if (window.app.viewManager.loadRecentActivity) {
                    window.app.viewManager.loadRecentActivity();
                }
                // Refresh upcoming cases card
                if (window.app.dashboardManager && window.app.dashboardManager.initialize) {
                    window.app.dashboardManager.initialize();
                }
            }
        } catch (error) {
            console.error('Error checking in tray:', error);
            this.showErrorNotification('Error checking in tray: ' + error.message);
        }
    }

    async pickupTray() {
        try {
            const trayId = document.getElementById('pickupTrayId').value;
            const notes = document.getElementById('pickupNotes').value;

            // Get current tray data to get facility name before clearing it
            const currentTray = await this.dataManager.getTray(trayId);
            const facilityId = this.getTrayFacility(currentTray);
            const facilityName = facilityId ? this.getFacilityName(facilityId) : 'facility';

            // Upload photo if captured
            let photoUrl = null;
            if (window.app.photoManager.hasPhoto('pickup')) {
                photoUrl = await window.app.photoManager.uploadPhoto('pickup', 'pickup-photos');
            }

            const updates = {
                status: TRAY_STATUS.AVAILABLE,
                location: TRAY_LOCATIONS.TRUNK,
                facility: '',
                caseDate: '',
                surgeon: '',
                notes: notes,
                pickupPhotoUrl: photoUrl
            };

            await this.dataManager.updateTray(trayId, updates);
            await this.dataManager.addHistoryEntry(
                trayId,
                'picked-up',
                `Picked up from ${facilityName}. Notes: ${notes || 'None'}`,
                photoUrl
            );

            bootstrap.Modal.getInstance(document.getElementById('pickupModal')).hide();
            this.showSuccessNotification('Tray picked up successfully!');
            
            // Update any cases that require this tray for real-time sync
            await this.updateAffectedCasesTimestamp(trayId);
            
            // Refresh dashboard cards if currently viewing dashboard
            if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
                // Refresh activities card
                if (window.app.viewManager.loadRecentActivity) {
                    window.app.viewManager.loadRecentActivity();
                }
                // Refresh upcoming cases card
                if (window.app.dashboardManager && window.app.dashboardManager.initialize) {
                    window.app.dashboardManager.initialize();
                }
            }
        } catch (error) {
            console.error('Error picking up tray:', error);
            this.showErrorNotification('Error picking up tray: ' + error.message);
        }
    }

    async processTurnover() {
        try {
            const trayId = document.getElementById('turnoverTrayId').value;
            const action = document.querySelector('input[name="turnoverAction"]:checked').value;

            if (action === 'reassign') {
                const whoPickedUp = document.getElementById('whoPickedUp').value;
                const notes = document.getElementById('reassignNotes').value;
                const newDoctor = document.getElementById('newDoctor').value;

                const updates = {
                    assignedTo: whoPickedUp,
                    status: TRAY_STATUS.AVAILABLE,
                    location: TRAY_LOCATIONS.TRUNK
                };

                if (newDoctor) {
                    updates.surgeon = newDoctor;
                }

                await this.dataManager.updateTray(trayId, updates);

                const users = this.dataManager.getUsers();
                const assignedUser = users.get(whoPickedUp);

                await this.dataManager.addHistoryEntry(
                    trayId,
                    'reassigned',
                    `Reassigned to ${assignedUser?.name || 'Unknown User'}. Notes: ${notes || 'None'}`
                );
            } else {
                const newCaseDate = document.getElementById('newCaseDate').value;
                const checkinNotes = document.getElementById('turnoverCheckinNotes').value;
                const turnoverNotes = document.getElementById('turnoverNotes').value;

                // Upload photos if captured
                let checkinPhotoUrl = null;
                let turnoverPhotoUrl = null;

                if (window.app.photoManager.hasPhoto('turnoverCheckin')) {
                    checkinPhotoUrl = await window.app.photoManager.uploadPhoto('turnoverCheckin', 'turnover-photos');
                }

                if (window.app.photoManager.hasPhoto('turnover')) {
                    turnoverPhotoUrl = await window.app.photoManager.uploadPhoto('turnover', 'turnover-photos');
                }

                const updates = {
                    caseDate: newCaseDate, // Assume this is in CDT - will convert on display
                    status: TRAY_STATUS.IN_USE,
                    location: 'facility',
                    turnoverCheckinPhotoUrl: checkinPhotoUrl,
                    turnoverPhotoUrl: turnoverPhotoUrl
                };

                await this.dataManager.updateTray(trayId, updates);
                await this.dataManager.addHistoryEntry(
                    trayId,
                    'turnover',
                    `Turnover processed for new case on ${newCaseDate}. Checkin notes: ${checkinNotes || 'None'}. Turnover notes: ${turnoverNotes || 'None'}`,
                    turnoverPhotoUrl
                );
            }

            bootstrap.Modal.getInstance(document.getElementById('turnoverModal')).hide();
            this.showSuccessNotification('Turnover processed successfully!');
        } catch (error) {
            console.error('Error processing turnover:', error);
            this.showErrorNotification('Error processing turnover: ' + error.message);
        }
    }

    scheduleUserNameUpdate() {
        if (!this.userUpdateScheduled) {
            this.userUpdateScheduled = true;

            const checkForUsers = () => {
                if (window.app.dataManager && window.app.dataManager.users && window.app.dataManager.users.size > 0) {
                    console.log('Users loaded, re-rendering trays...');
                    this.userUpdateScheduled = false;
                    this.renderTrays(this.currentTrays);

                    // Also update dashboard if it's current view
                    if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
                        window.app.viewManager.renderDashboardTrays(this.currentTrays);
                    }
                } else {
                    setTimeout(checkForUsers, 1000);
                }
            };

            setTimeout(checkForUsers, 1000);
        }
    }

    scheduleFacilityUpdate() {
        if (!this.facilityUpdateScheduled) {
            this.facilityUpdateScheduled = true;
            this.facilityCheckAttempts = 0; // Reset counter

            const checkForFacilities = () => {
                const hasFacilityManagerData = window.app.facilityManager?.currentFacilities?.length > 0;
                const hasDataManagerData = this.dataManager.getFacilities()?.length > 0;
                
                if (hasFacilityManagerData || hasDataManagerData) {
                    this.facilityUpdateScheduled = false;
                    
                    // Force re-render of tray cards
                    this.renderTrays(this.currentTrays);

                    // Also update dashboard if it's current view
                    if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
                        window.app.viewManager.renderDashboardTrays(this.currentTrays);
                    }
                    
                    // Log successful re-render for debugging
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('Facility re-render completed', {
                            facilityManagerCount: window.app.facilityManager?.currentFacilities?.length || 0,
                            dataManagerCount: this.dataManager.getFacilities()?.length || 0,
                            trayCount: this.currentTrays.length
                        }, 'facility-re-render-success');
                    }
                } else {
                    // Keep checking every 200ms until facilities load (max 25 attempts = 5 seconds)
                    if ((this.facilityCheckAttempts || 0) < 25) {
                        this.facilityCheckAttempts = (this.facilityCheckAttempts || 0) + 1;
                        setTimeout(checkForFacilities, 200);
                    } else {
                        console.warn('Facility loading timeout after 5 seconds');
                        this.facilityUpdateScheduled = false;
                        this.facilityCheckAttempts = 0;
                    }
                }
            };

            setTimeout(checkForFacilities, 1000);
        }
    }

    // Called directly when facilities are loaded - much more reliable than polling
    onFacilitiesLoaded() {
        console.log('Facilities loaded callback triggered - re-rendering trays immediately');
        
        // Add specific debugging for SPA update issues
        if (window.is_enable_api_logging && window.frontendLogger) {
            // onFacilitiesLoaded callback debugging available if needed
        }
        
        // Add a small delay to ensure facilities are fully processed, then force complete re-render
        setTimeout(() => {
            
            // Force re-render of tray cards
            this.renderTrays(this.currentTrays);
        }, 100);

        // Also update dashboard if it's current view
        if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
            window.app.viewManager.renderDashboardTrays(this.currentTrays);
        }
        
        // Log successful re-render for debugging
        if (window.is_enable_api_logging && window.frontendLogger) {
            // Facility callback re-render debugging available if needed
        }
    }

    handleTraysUpdate(trays) {
        this.currentTrays = trays;
        this.renderTrays(trays);
        this.updateStats(trays);

        // Update dashboard if currently viewing dashboard
        if (window.app.viewManager && window.app.viewManager.currentView === 'dashboard') {
            window.app.viewManager.renderDashboardTrays(trays);
            window.app.viewManager.updateTrayStats(trays);
        }

        // Update map if available
        if (window.app.mapManager) {
            window.app.mapManager.updateMap(trays);
        }

        // If users are not loaded yet, schedule a re-render when they are
        if (window.app.dataManager && window.app.dataManager.users && window.app.dataManager.users.size === 0) {
            this.scheduleUserNameUpdate();
        }

        // If facilities are not loaded yet, schedule a re-render when they are
        const hasFacilityManagerData = window.app.facilityManager?.currentFacilities?.length > 0;
        const hasDataManagerData = this.dataManager.getFacilities()?.length > 0;
        if (!hasFacilityManagerData && !hasDataManagerData) {
            this.scheduleFacilityUpdate();
        }
    }

    renderTrays(trays) {
        
        // Apply trays page status filter
        const statusFilter = document.getElementById('traysStatusFilter')?.value || '';
        const filteredTrays = statusFilter ? 
            trays.filter(tray => tray.status === statusFilter) : 
            trays;
        
        // Log DOM element availability using API logging
        const trayCardView = document.getElementById('trayCardView');
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.debug('DOM elements check', {
                trayCardViewExists: !!trayCardView,
                trayCardViewDisplay: trayCardView?.style.display || 'default',
                viewMode: this.viewMode,
                filteredTraysCount: filteredTrays.length,
                statusFilter: statusFilter
            }, 'render-dom-check');
        }
            
        if (this.viewMode === 'card') {
            this.renderCardView(filteredTrays);
        } else {
            this.renderListView(filteredTrays);
        }
    }

    renderCardView(trays) {
        const trayCardView = document.getElementById('trayCardView');
        if (!trayCardView) return;

        if (trays.length === 0) {
            trayCardView.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-box fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No trays found. Add a new tray to get started.</p>
                </div>
            `;
            return;
        }

        trayCardView.innerHTML = '';
        
        
        trays.forEach((tray, index) => {
            
            const trayCard = this.createTrayCard(tray);
            trayCardView.appendChild(trayCard);
            
        });
    }

    renderListView(trays) {
        const trayHorizontalCards = document.getElementById('trayHorizontalCards');
        if (!trayHorizontalCards) return;

        if (trays.length === 0) {
            trayHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-box fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No trays found. Add a new tray to get started.</p>
                </div>
            `;
            return;
        }

        trayHorizontalCards.innerHTML = '';
        trays.forEach(tray => {
            const trayCard = this.createHorizontalTrayCard(tray);
            trayHorizontalCards.appendChild(trayCard);
        });
    }

    createTrayCard(tray) {
        const card = document.createElement('div');
        card.className = 'tray-card';

        const statusClass = this.getStatusClass(tray.status);
        const typeIcon = this.getTrayTypeIcon(tray);
        const locationText = this.getLocationText(tray.location);

        card.innerHTML = `
            <div class="tray-card-header">
                <div class="tray-card-title">
                    <div class="tray-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    ${tray.name}
                </div>
                <span class="tray-status-badge ${statusClass}">${tray.status}</span>
            </div>
            <div class="tray-card-content">
                <div class="tray-detail">
                    <i class="fas fa-layer-group"></i>
                    <span class="tray-detail-value">${this.getTrayTypeText(tray)}</span>
                </div>
                <div class="tray-detail">
                    ${this.isCheckedIn(tray) ? `
                        <i class="fas fa-hospital"></i>
                        <span class="tray-detail-value">${(() => {
                            const facilityId = this.getTrayFacility(tray);
                            const facilityName = this.getFacilityName(facilityId);
                            
                            
                            return facilityName;
                        })()}</span>
                    ` : `
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="tray-detail-value">${locationText}</span>
                    `}
                </div>
                ${this.getTrayDate(tray) ? `
                    <div class="tray-detail">
                        <i class="fas fa-calendar"></i>
                        <span class="tray-detail-value">${this.getTrayDate(tray)}</span>
                    </div>
                ` : `
                    <div class="tray-detail">
                        <i class="fas fa-calendar"></i>
                        <span class="tray-detail-empty">Not scheduled</span>
                    </div>
                `}
                ${this.getTrayPhysician(tray) ? `
                    <div class="tray-detail">
                        <i class="fas fa-user-md"></i>
                        <span class="tray-detail-value">${this.getSurgeonName(this.getTrayPhysician(tray))}</span>
                    </div>
                ` : `
                    <div class="tray-detail">
                        <i class="fas fa-user-md"></i>
                        <span class="tray-detail-empty">Not assigned</span>
                    </div>
                `}
                ${tray.assignedTo ? `
                    <div class="tray-detail">
                        <i class="fas fa-user"></i>
                        <span class="tray-detail-value">Assigned to: ${this.getUserName(tray.assignedTo)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="tray-card-actions">
                ${this.getTrayActions(tray)}
            </div>
        `;

        return card;
    }

    createHorizontalTrayCard(tray) {
        const card = document.createElement('div');
        card.className = 'tray-horizontal-card';

        const statusClass = this.getStatusClass(tray.status);
        const locationIcon = this.getLocationIcon(tray.location);
        const trayTypeIcon = this.getTrayTypeIcon(tray);

        card.innerHTML = `
            <div class="tray-horizontal-header">
                <div class="tray-horizontal-title">
                    <div class="tray-type-icon">
                        <i class="${trayTypeIcon}"></i>
                    </div>
                    <div>
                        <h6>${tray.name}</h6>
                        <small class="text-muted">${this.getTrayTypeText(tray)}</small>
                    </div>
                </div>
                <div class="tray-horizontal-status">
                    <span class="tray-status-badge ${statusClass}">${tray.status}</span>
                </div>
            </div>
            
            <div class="tray-horizontal-body">
                <div class="tray-horizontal-field">
                    <label>Location</label>
                    <span>
                        <i class="${locationIcon} me-2"></i>
                        ${this.getLocationText(tray.location)}
                    </span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Case Date</label>
                    <span class="${!this.getTrayDate(tray) ? 'empty-value' : ''}">${this.getTrayDate(tray) || 'Not scheduled'}</span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Physician</label>
                    <span class="${!this.getTrayPhysician(tray) ? 'empty-value' : ''}">${this.getTrayPhysician(tray) ? this.getSurgeonName(this.getTrayPhysician(tray)) : 'Not assigned'}</span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Assigned To</label>
                    <span class="${!tray.assignedTo ? 'empty-value' : ''}">${tray.assignedTo ? this.getUserName(tray.assignedTo) : 'Not assigned'}</span>
                </div>
            </div>
            
            <div class="tray-horizontal-actions">
                ${this.getTrayActions(tray)}
            </div>
        `;

        return card;
    }

    getStatusClass(status) {
        const normalized = normalizeStatus(status);
        const colorClass = getStatusColor(normalized);
        return `status-${colorClass}`;
    }

    getTrayTypeIcon(tray) {
        // Support both legacy type field and MyRepData case type compatibility
        let primaryType = '';
        
        if (tray.case_type_compatibility && Array.isArray(tray.case_type_compatibility) && tray.case_type_compatibility.length > 0) {
            // Map MyRepData case types to icons
            const caseType = tray.case_type_compatibility[0]; // Use first case type for icon
            const caseTypeIcons = {
                'SI fusion': 'fas fa-link',
                'Spine fusion': 'fas fa-link',
                'Minimally Invasive': 'fas fa-microscope',
                'Revision Surgery': 'fas fa-tools',
                'Complete System': 'fas fa-briefcase-medical'
            };
            return caseTypeIcons[caseType] || 'fas fa-medical-bag';
        }
        
        // Fallback to legacy type icons
        const typeIcons = {
            'fusion': 'fas fa-link',
            'revision': 'fas fa-tools',
            'mi': 'fas fa-microscope',
            'complete': 'fas fa-briefcase-medical'
        };
        return typeIcons[tray.type] || 'fas fa-medical-bag';
    }

    getTrayTypeText(tray) {
        // Support both MyRepData case type compatibility and legacy type
        if (tray.case_type_compatibility && Array.isArray(tray.case_type_compatibility) && tray.case_type_compatibility.length > 0) {
            return tray.case_type_compatibility.join(', ');
        }
        
        // Fallback to legacy type mapping
        const typeTexts = {
            'fusion': 'Fusion Set',
            'revision': 'Revision Kit',
            'mi': 'Minimally Invasive',
            'complete': 'Complete System'
        };
        return typeTexts[tray.type] || tray.type || 'General Purpose';
    }

    getLocationIcon(location) {
        // Use centralized location icon function
        return getLocationIcon(location);
    }

    getLocationText(locationId) {
        // Get location from Firebase collection using the ID
        if (window.app.locationManager && window.app.locationManager.currentLocations) {
            const location = window.app.locationManager.currentLocations.find(
                loc => loc.id === locationId
            );
            if (location) {
                return location.name || 'Unknown';
            }
        }

        // Use centralized location display function for static locations
        return getLocationDisplayText(locationId);
    }

    getUserName(userId) {
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const user = window.app.dataManager.users.get(userId);
            if (user) {
                return user.name || user.email || 'Unknown User';
            }
            return userId;
        }

        return 'Loading user...';
    }

    async populateUserDropdown() {
        const userSelect = document.getElementById('trayAssignedTo');
        if (!userSelect) return;

        // Clear existing options except the first "Not Assigned" option
        userSelect.innerHTML = '<option value="">Not Assigned</option>';

        try {
            // Get users from the data manager
            if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
                const users = Array.from(window.app.dataManager.users.values());
                
                // Sort users by name
                users.sort((a, b) => {
                    const nameA = a.name || a.email || 'Unknown';
                    const nameB = b.name || b.email || 'Unknown';
                    return nameA.localeCompare(nameB);
                });

                // Add user options
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.uid || user.id;
                    option.textContent = `${user.name || user.email || 'Unknown User'}${user.role ? ` (${user.role})` : ''}`;
                    userSelect.appendChild(option);
                });
            } else {
                console.log('No users available for dropdown');
            }
        } catch (error) {
            console.error('Error populating user dropdown:', error);
        }
    }

    getSurgeonName(surgeonId) {
        // If it's already a name (legacy data), return as is
        if (!surgeonId || typeof surgeonId !== 'string') return 'Unknown Physician';

        // Check if it looks like an ID (Firebase IDs are longer)
        if (surgeonId.length < 15) {
            // Probably a legacy name, return as is
            return surgeonId;
        }

        // Try to find surgeon by ID in physicians collection first (newer approach)
        if (window.app.dataManager && window.app.dataManager.physicians) {
            const physician = window.app.dataManager.physicians.find(p => p.id === surgeonId);
            if (physician) {
                return `${physician.title || 'Dr.'} ${physician.full_name}`;
            }
        }

        // Fallback to surgeonManager for backward compatibility
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);
            if (surgeon) {
                return `${surgeon.title || 'Dr.'} ${surgeon.full_name}`;
            }
        }

        // Final fallback: if surgeon not found, return the ID (shouldn't happen in normal use)
        return surgeonId;
    }

    getTrayDate(tray) {
        // Use caseDate field (assume it's stored in CDT)
        if (tray.caseDate) {
            const date = new Date(tray.caseDate);
            if (!isNaN(date.getTime())) {
                return window.timezoneConverter.formatForDisplay(date, true);
            }
            return tray.caseDate; // Return as-is if not a valid date
        }
        
        return '';
    }

    getTrayPhysician(tray) {
        // Check MyRepData compatible field first, then fallback to tray-tracker field
        return tray.physician_id || tray.surgeon || '';
    }

    getTrayFacility(tray) {
        return tray.facility_id || tray.facility || '';
    }

    isCheckedIn(tray) {
        return isCheckedInStatus(tray.status) || isInUseStatus(tray.status);
    }

    getFacilityName(facilityId) {
        if (!facilityId) {
            return 'No Facility Assigned';
        }
        
        
        // Try facilityManager first (like DashboardManager's working method)
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            if (facility) {
                return facility.name;
            } else {
            }
        }
        
        // Fallback to dataManager
        const facilities = this.dataManager.getFacilities();
        if (facilities && facilities.length > 0) {
            const facility = facilities.find(f => f.id === facilityId);
            if (facility) {
                return facility.name;
            }
        }
        
        // If no facilities loaded yet, schedule re-render
        if ((!window.app.facilityManager?.currentFacilities || window.app.facilityManager.currentFacilities.length === 0) &&
            (!facilities || facilities.length === 0)) {
            this.scheduleFacilityUpdate();
            return 'Loading facility...';
        }
        
        // If it looks like a name already (contains spaces, letters, etc.), return it as-is
        if (facilityId.includes(' ') || facilityId.length > 25) {
            return facilityId;
        }
        
        // For debugging: log when we can't find a facility (only if API logging is enabled)
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.debug('Facility ID not found in loaded facilities', {
                facilityId,
                availableFacilityIds: facilities.map(f => f.id),
                facilitiesCount: facilities.length
            }, 'facility-lookup-debug');
        }
        
        // Fallback to showing the ID with a note
        const result = `Unknown Facility (${facilityId})`;
        
        // Log what we're actually returning for HTML display
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.debug('getFacilityName final return value', {
                facilityId,
                returnValue: result,
                willDisplayInHTML: result
            }, 'facility-html-display-debug');
        }
        
        return result;
    }

    getTrayActions(tray) {
        let actions = '';

        if (isAvailableStatus(tray.status)) {
            actions += `
                <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                    <i class="fas fa-sign-in-alt"></i> Check-in
                </button>
            `;
        }

        if (isInUseStatus(tray.status)) {
            actions += `
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                    <i class="fas fa-hand-paper"></i> Pickup
                </button>
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showTurnoverModal('${tray.id}')">
                    <i class="fas fa-exchange-alt"></i> Turnover
                </button>
            `;
        }

        actions += `
            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showHistoryModal('${tray.id}')">
                <i class="fas fa-history"></i> History
            </button>
            <button class="btn-secondary-custom btn-sm" onclick="app.trayManager.showEditTrayModal('${tray.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
        `;

        return actions;
    }

    updateStats(trays) {
        const stats = {
            available: trays.filter(t => isAvailableStatus(t.status)).length,
            inUse: trays.filter(t => isInUseStatus(t.status)).length,
            cleaning: trays.filter(t => normalizeStatus(t.status) === TRAY_STATUS.CLEANING).length,
            maintenance: trays.filter(t => normalizeStatus(t.status) === TRAY_STATUS.MAINTENANCE).length,
            corporate: trays.filter(t => t.location === TRAY_LOCATIONS.CORPORATE).length,
            trunk: trays.filter(t => t.location === TRAY_LOCATIONS.TRUNK).length
        };

        // Update stats in the trays view if elements exist
        const availableElement = document.getElementById('availableCount');
        const inUseElement = document.getElementById('inUseCount');
        const corporateElement = document.getElementById('corporateCount');
        const trunkElement = document.getElementById('trunkCount');

        if (availableElement) availableElement.textContent = stats.available;
        if (inUseElement) inUseElement.textContent = stats.inUse;
        if (corporateElement) corporateElement.textContent = stats.corporate;
        if (trunkElement) trunkElement.textContent = stats.trunk;
    }

    showSuccessNotification(message) {
        this.showNotification(message, 'success');
    }

    showErrorNotification(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = 'var(--success-green)';
                break;
            case 'error':
                notification.style.background = 'var(--danger-red)';
                break;
            default:
                notification.style.background = 'var(--primary-blue)';
        }

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; margin-left: auto; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // Update timestamp of any cases that require this tray for real-time sync
    async updateAffectedCasesTimestamp(trayId) {
        try {
            // Get all cases
            const allCases = await this.dataManager.getAllCases();
            const affectedCases = [];
            
            // Find cases that have this tray in their requirements
            for (const caseItem of allCases) {
                if (caseItem.tray_requirements && Array.isArray(caseItem.tray_requirements)) {
                    const requiresTray = caseItem.tray_requirements.some(req => 
                        req.tray_id === trayId || req.tray_name === trayId
                    );
                    if (requiresTray) {
                        affectedCases.push(caseItem);
                    }
                }
            }
            
            // Update timestamp for each affected case
            for (const caseItem of affectedCases) {
                try {
                    await this.dataManager.updateCase(caseItem.id, {
                        lastTrayUpdate: new Date().toISOString()
                    });
                } catch (error) {
                    // Silent fail for non-critical timestamp updates
                }
            }
            
        } catch (error) {
            // Silent fail for non-critical timestamp updates
        }
    }
}