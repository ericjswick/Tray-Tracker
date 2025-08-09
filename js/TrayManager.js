// js/TrayManager.js
export class TrayManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentTrays = [];
        this.viewMode = this.getStoredViewMode(); // Load user preference
    }

    getStoredViewMode() {
        // Get stored view preference, default to 'list'
        return localStorage.getItem('trayViewMode') || 'list';
    }

    setViewMode(mode) {
        this.viewMode = mode;

        // Store user preference
        localStorage.setItem('trayViewMode', mode);

        // Update button states
        const cardBtn = document.getElementById('cardViewBtn');
        const listBtn = document.getElementById('listViewBtn');

        if (mode === 'card') {
            cardBtn.classList.add('active');
            listBtn.classList.remove('active');
            document.getElementById('trayCardView').classList.remove('d-none');
            document.getElementById('trayListView').classList.add('d-none');
        } else {
            listBtn.classList.add('active');
            cardBtn.classList.remove('active');
            document.getElementById('trayCardView').classList.add('d-none');
            document.getElementById('trayListView').classList.remove('d-none');
        }

        // Re-render trays in the new view mode
        this.renderTrays(this.currentTrays);
    }

    initializeViewMode() {
        // Set initial view mode based on stored preference
        this.setViewMode(this.viewMode);
    }

    async addTray() {
        try {
            const form = document.getElementById('addTrayForm');

            const tray = {
                name: document.getElementById('trayName').value,
                type: document.getElementById('trayType').value,
                status: 'available',
                location: document.getElementById('initialLocation').value,
                facility: '',
                caseDate: '',
                surgeon: '',
                assignedTo: window.app.authManager.getCurrentUser().uid,
                notes: ''
            };

            await this.dataManager.saveTray(tray);
            await this.dataManager.addHistoryEntry(tray.id, 'created', `Tray created at ${tray.location}`);

            bootstrap.Modal.getInstance(document.getElementById('addTrayModal')).hide();
            form.reset();

            alert('Tray added successfully!');
        } catch (error) {
            console.error('Error adding tray:', error);
            alert('Error adding tray: ' + error.message);
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
                location: 'facility',
                facility: facility,
                caseDate: caseDate,
                surgeon: surgeon,
                notes: notes,
                checkinPhotoUrl: photoUrl
            };

            await this.dataManager.updateTray(trayId, updates);
            await this.dataManager.addHistoryEntry(
                trayId,
                'checked-in',
                `Checked in to ${facility} for case on ${caseDate}${surgeon ? ` with ${surgeon}` : ''}`,
                photoUrl
            );

            bootstrap.Modal.getInstance(document.getElementById('checkinModal')).hide();
            alert('Tray checked in successfully!');
        } catch (error) {
            console.error('Error checking in tray:', error);
            alert('Error checking in tray: ' + error.message);
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
            alert('Tray picked up successfully!');
        } catch (error) {
            console.error('Error picking up tray:', error);
            alert('Error picking up tray: ' + error.message);
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
            alert('Turnover processed successfully!');
        } catch (error) {
            console.error('Error processing turnover:', error);
            alert('Error processing turnover: ' + error.message);
        }
    }

    handleTraysUpdate(trays) {
        this.currentTrays = trays;
        this.renderTrays(trays);
        this.updateStats(trays);
        if (window.app.mapManager) {
            window.app.mapManager.updateMap(trays);
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

        if (trays.length === 0) {
            trayCardView.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No trays found. Add a new tray to get started.</p>
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

        if (trays.length === 0) {
            trayHorizontalCards.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-medical-bag fa-3x mb-3 opacity-50"></i>
                    <p class="mb-0">No trays found. Add a new tray to get started.</p>
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

    createHorizontalTrayCard(tray) {
        const card = document.createElement('div');
        card.className = 'tray-horizontal-card';

        const statusClass = `status-${tray.status === 'in-use' ? 'in-use' : tray.status}`;
        const locationIcon = this.getLocationIcon(tray.location);
        const trayTypeIcon = this.getTrayTypeIcon(tray.type);

        card.innerHTML = `
            <div class="tray-horizontal-header">
                <div class="tray-horizontal-title">
                    <div class="tray-icon">
                        <i class="${trayTypeIcon}"></i>
                    </div>
                    <div>
                        <h6>${tray.name}</h6>
                        <small class="text-muted">${this.getTrayTypeText(tray.type)}</small>
                    </div>
                </div>
                <div class="tray-horizontal-status">
                    <span class="badge ${statusClass} status-badge">${tray.status}</span>
                </div>
            </div>
            
            <div class="tray-horizontal-body">
                <div class="tray-horizontal-field">
                    <label>Location</label>
                    <span>
                        <i class="${locationIcon} me-2"></i>
                        ${this.getLocationText(tray)}
                    </span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Facility</label>
                    <span class="${!tray.facility ? 'empty-value' : ''}">${tray.facility || 'Not assigned'}</span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Case Date</label>
                    <span class="${!tray.caseDate ? 'empty-value' : ''}">${tray.caseDate || 'Not scheduled'}</span>
                </div>
                <div class="tray-horizontal-field">
                    <label>Surgeon</label>
                    <span class="${!tray.surgeon ? 'empty-value' : ''}">${tray.surgeon || 'Not assigned'}</span>
                </div>
            </div>
            
            <div class="tray-horizontal-actions">
                ${this.getTrayActions(tray)}
            </div>
        `;

        return card;
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

    createTrayCard(tray) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-3';

        const statusClass = `status-${tray.status === 'in-use' ? 'in-use' : tray.status}`;
        const locationIcon = this.getLocationIcon(tray.location);

        col.innerHTML = `
            <div class="card tray-card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title">${tray.name}</h6>
                        <span class="badge ${statusClass} status-badge">${tray.status}</span>
                    </div>
                    <p class="card-text">
                        <small class="text-muted">
                            <i class="${locationIcon}"></i> ${this.getLocationText(tray)}
                        </small>
                    </p>
                    ${tray.facility ? `<p class="card-text"><small><strong>Facility:</strong> ${tray.facility}</small></p>` : ''}
                    ${tray.caseDate ? `<p class="card-text"><small><strong>Case Date:</strong> ${tray.caseDate}</small></p>` : ''}
                    ${tray.surgeon ? `<p class="card-text"><small><strong>Surgeon:</strong> ${tray.surgeon}</small></p>` : ''}
                    <div class="mt-auto">
                        <div class="btn-group w-100" role="group">
                            ${this.getTrayActions(tray)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        return col;
    }

    getLocationIcon(location) {
        const icons = {
            'trunk': 'fas fa-car',
            'facility': 'fas fa-hospital',
            'corporate': 'fas fa-building'
        };
        return icons[location] || 'fas fa-map-marker-alt';
    }

    getLocationText(tray) {
        if (tray.location === 'facility' && tray.facility) {
            return tray.facility;
        }
        const locationTexts = {
            'trunk': 'Rep Trunk',
            'facility': 'Medical Facility',
            'corporate': 'SI-BONE Corporate'
        };
        return locationTexts[tray.location] || 'Unknown';
    }

    getTrayActions(tray) {
        let actions = '';

        //if (tray.status === 'available' && tray.location === 'trunk') {
        if (tray.status === 'available') {
            actions += `<button class="btn btn-sm btn-primary" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                <i class="fas fa-sign-in-alt"></i> Check-in
            </button>`;
        }

        if (tray.status === 'in-use' && tray.location === 'facility') {
            actions += `<button class="btn btn-sm btn-warning" onclick="app.modalManager.showPickupModal('${tray.id}')">
                <i class="fas fa-hand-paper"></i> Pickup
            </button>`;
            actions += `<button class="btn btn-sm btn-info" onclick="app.modalManager.showTurnoverModal('${tray.id}')">
                <i class="fas fa-exchange-alt"></i> Turnover
            </button>`;
        }

        actions += `<button class="btn btn-sm btn-outline-secondary" onclick="app.modalManager.showHistoryModal('${tray.id}')">
            <i class="fas fa-history"></i> History
        </button>`;

        return actions;
    }

    updateStats(trays) {
        const stats = {
            available: trays.filter(t => t.status === 'available').length,
            inUse: trays.filter(t => t.status === 'in-use').length,
            corporate: trays.filter(t => t.location === 'corporate').length,
            trunk: trays.filter(t => t.location === 'trunk').length
        };

        document.getElementById('availableCount').textContent = stats.available;
        document.getElementById('inUseCount').textContent = stats.inUse;
        document.getElementById('corporateCount').textContent = stats.corporate;
        document.getElementById('trunkCount').textContent = stats.trunk;
    }
}