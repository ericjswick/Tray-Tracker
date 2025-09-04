// js/TrayManager.js - Updated for Tray Tracker
export class TrayManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentTrays = [];
        this.viewMode = this.getStoredViewMode();
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

            const trayData = {
                name: document.getElementById('trayName').value,
                type: document.getElementById('trayType').value,
                status: locationValue === 'facility' ? 'in-use' : 'available',
                location: locationValue,
                facility: '',
                caseDate: '',
                surgeon: '',
                assignedTo: window.app.authManager.getCurrentUser()?.uid || '',
                notes: ''
            };

            const savedTray = await this.dataManager.saveTray(trayData);
            if (savedTray && savedTray.id) {
                await this.dataManager.addHistoryEntry(savedTray.id, 'created', `Tray created at ${this.getLocationText(trayData.location)}`);
            }

            bootstrap.Modal.getInstance(document.getElementById('addTrayModal')).hide();
            document.getElementById('addTrayForm').reset();

            this.showSuccessNotification('Tray added successfully!');
        } catch (error) {
            console.error('Error adding tray:', error);
            this.showErrorNotification('Error adding tray: ' + error.message);
        }
    }

    async checkinTray() {
        try {
            const trayId = document.getElementById('checkinTrayId').value;
            const facility = document.getElementById('facilityName').value;
            const caseDate = document.getElementById('caseDate').value;
            const surgeon = document.getElementById('surgeon').value;
            const notes = document.getElementById('checkinNotes').value;

            // Upload photo if captured
            let photoUrl = null;
            if (window.app.photoManager.hasPhoto('checkin')) {
                photoUrl = await window.app.photoManager.uploadPhoto('checkin', 'checkin-photos');
            }

            const updates = {
                status: 'in-use',
                location: facility,
                caseDate: caseDate,
                surgeon: surgeon,
                notes: notes,
                checkinPhotoUrl: photoUrl
            };

            await this.dataManager.updateTray(trayId, updates);
            await this.dataManager.addHistoryEntry(
                trayId,
                'checked-in',
                `Checked in to ${this.getLocationText(facility)} for case on ${caseDate}${surgeon ? ` with ${surgeon}` : ''}`,
                photoUrl
            );

            bootstrap.Modal.getInstance(document.getElementById('checkinModal')).hide();
            this.showSuccessNotification('Tray checked in successfully!');
        } catch (error) {
            console.error('Error checking in tray:', error);
            this.showErrorNotification('Error checking in tray: ' + error.message);
        }
    }

    async pickupTray() {
        try {
            const trayId = document.getElementById('pickupTrayId').value;
            const notes = document.getElementById('pickupNotes').value;

            // Upload photo if captured
            let photoUrl = null;
            if (window.app.photoManager.hasPhoto('pickup')) {
                photoUrl = await window.app.photoManager.uploadPhoto('pickup', 'pickup-photos');
            }

            const updates = {
                status: 'available',
                location: 'trunk',
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
                `Picked up from facility. Notes: ${notes || 'None'}`,
                photoUrl
            );

            bootstrap.Modal.getInstance(document.getElementById('pickupModal')).hide();
            this.showSuccessNotification('Tray picked up successfully!');
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
                    status: 'available',
                    location: 'trunk'
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
                    caseDate: newCaseDate,
                    status: 'in-use',
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
    }

    renderTrays(trays) {
        if (this.viewMode === 'card') {
            this.renderCardView(trays);
        } else {
            this.renderListView(trays);
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
        trays.forEach(tray => {
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
        const typeIcon = this.getTrayTypeIcon(tray.type);
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
                    <span class="tray-detail-value">${this.getTrayTypeText(tray.type)}</span>
                </div>
                <div class="tray-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="tray-detail-value">${locationText}</span>
                </div>
                ${tray.caseDate ? `
                    <div class="tray-detail">
                        <i class="fas fa-calendar"></i>
                        <span class="tray-detail-value">${tray.caseDate}</span>
                    </div>
                ` : `
                    <div class="tray-detail">
                        <i class="fas fa-calendar"></i>
                        <span class="tray-detail-empty">Not scheduled</span>
                    </div>
                `}
                ${tray.surgeon ? `
                    <div class="tray-detail">
                        <i class="fas fa-user-md"></i>
                        <span class="tray-detail-value">${this.getSurgeonName(tray.surgeon)}</span>
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
        const trayTypeIcon = this.getTrayTypeIcon(tray.type);

        card.innerHTML = `
            <div class="tray-horizontal-header">
                <div class="tray-horizontal-title">
                    <div class="tray-type-icon">
                        <i class="${trayTypeIcon}"></i>
                    </div>
                    <div>
                        <h6>${tray.name}</h6>
                        <small class="text-muted">${this.getTrayTypeText(tray.type)}</small>
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
                    <span class="${!tray.caseDate ? 'empty-value' : ''}">${tray.caseDate || 'Not scheduled'}</span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Surgeon</label>
                    <span class="${!tray.surgeon ? 'empty-value' : ''}">${tray.surgeon ? this.getSurgeonName(tray.surgeon) : 'Not assigned'}</span>
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
        switch (status) {
            case 'available': return 'status-available';
            case 'in-use': return 'status-in-use';
            case 'corporate': return 'status-corporate';
            case 'trunk': return 'status-trunk';
            default: return 'status-available';
        }
    }

    getTrayTypeIcon(type) {
        const typeIcons = {
            'fusion': 'fas fa-link',
            'revision': 'fas fa-tools',
            'mi': 'fas fa-microscope',
            'complete': 'fas fa-briefcase-medical'
        };
        return typeIcons[type] || 'fas fa-medical-bag';
    }

    getTrayTypeText(type) {
        const typeTexts = {
            'fusion': 'Fusion Set',
            'revision': 'Revision Kit',
            'mi': 'Minimally Invasive',
            'complete': 'Complete System'
        };
        return typeTexts[type] || type;
    }

    getLocationIcon(location) {
        const icons = {
            'trunk': 'fas fa-car',
            'facility': 'fas fa-hospital',
            'corporate': 'fas fa-building'
        };
        return icons[location] || 'fas fa-map-marker-alt';
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

        // Fallback for old static locations
        const staticLocations = {
            'trunk': 'Rep Trunk',
            'facility': 'Medical Facility',
            'corporate': 'SI-BONE Corporate'
        };

        return staticLocations[locationId] || locationId || 'Unknown Location';
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

    getSurgeonName(surgeonId) {
        // If it's already a name (legacy data), return as is
        if (!surgeonId || typeof surgeonId !== 'string') return 'Unknown Surgeon';

        // Check if it looks like an ID (Firebase IDs are longer)
        if (surgeonId.length < 15) {
            // Probably a legacy name, return as is
            return surgeonId;
        }

        // Try to find surgeon by ID
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);
            if (surgeon) {
                return `${surgeon.title || 'Dr.'} ${surgeon.name}`;
            }
        }

        // Fallback: if surgeon not found, return the ID (shouldn't happen in normal use)
        return surgeonId;
    }

    getTrayActions(tray) {
        let actions = '';

        if (tray.status === 'available') {
            actions += `
                <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                    <i class="fas fa-sign-in-alt"></i> Check-in
                </button>
            `;
        }

        if (tray.status === 'in-use') {
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
        `;

        return actions;
    }

    updateStats(trays) {
        const stats = {
            available: trays.filter(t => t.status === 'available').length,
            inUse: trays.filter(t => t.status === 'in-use').length,
            corporate: trays.filter(t => t.location === 'corporate').length,
            trunk: trays.filter(t => t.location === 'trunk').length
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
}