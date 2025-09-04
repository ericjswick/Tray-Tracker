// js/ModalManager.js - Updated for Tray Tracker
export class ModalManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.initializeModalEvents();
    }

    initializeModalEvents() {
        // Turnover action radio buttons
        document.querySelectorAll('input[name="turnoverAction"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const reassignSection = document.getElementById('reassignSection');
                const turnoverSection = document.getElementById('turnoverSection');

                if (radio.value === 'reassign') {
                    reassignSection.classList.remove('d-none');
                    turnoverSection.classList.add('d-none');
                } else {
                    reassignSection.classList.add('d-none');
                    turnoverSection.classList.remove('d-none');
                }
            });
        });

        // Modal cleanup on hide
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('hidden.bs.modal', () => {
                if (window.app && window.app.photoManager) {
                    window.app.photoManager.stopCamera();
                }
            });
        });
    }

    async showAddTrayModal() {
        await this.populateInitialLocationDropdown();
        const modal = new bootstrap.Modal(document.getElementById('addTrayModal'));
        modal.show();
    }

    async populateInitialLocationDropdown() {
        try {
            const initialLocationSelect = document.getElementById('initialLocation');
            if (!initialLocationSelect) {
                console.error('Initial location select element not found');
                return;
            }

            initialLocationSelect.innerHTML = '<option value="">Select Location...</option>';

            // Add static options
            initialLocationSelect.innerHTML += `
                <option value="corporate">SI-BONE Corporate</option>
                <option value="trunk">Rep Trunk</option>
            `;

            // Add locations from Firebase if available
            if (window.app.locationManager && window.app.locationManager.currentLocations) {
                const activeLocations = window.app.locationManager.currentLocations
                    .filter(location => location.active)
                    .sort((a, b) => a.name.localeCompare(b.name));

                if (activeLocations.length > 0) {
                    // Add facility locations
                    activeLocations.forEach(location => {
                        const option = document.createElement('option');
                        option.value = location.id;
                        option.textContent = location.name;
                        initialLocationSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error populating initial location dropdown:', error);
        }
    }

    async showCheckinModal(trayId) {
        document.getElementById('checkinTrayId').value = trayId;

        // Populate facilities dropdown
        const facilitiesList = document.getElementById('facilityName');
        facilitiesList.innerHTML = '<option value="">Select Location...</option>';

        // Add locations from Firebase
        if (window.app.locationManager && window.app.locationManager.currentLocations) {
            const activeLocations = window.app.locationManager.currentLocations
                .filter(location => location.active)
                .sort((a, b) => a.name.localeCompare(b.name));

            activeLocations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.name;
                facilitiesList.appendChild(option);
            });
        }

        // Populate surgeons
        const surgeonSelect = document.getElementById('surgeon');
        surgeonSelect.innerHTML = '<option value="">Select Surgeon...</option>';

        // Get surgeons from SurgeonManager if available, otherwise use DataManager fallback
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            window.app.surgeonManager.currentSurgeons
                .filter(surgeon => surgeon.active)
                .forEach(surgeon => {
                    const option = document.createElement('option');
                    option.value = surgeon.id; // Store surgeon ID
                    option.textContent = `${surgeon.title || 'Dr.'} ${surgeon.name}`;
                    surgeonSelect.appendChild(option);
                });
        } else {
            // Fallback to old system for backward compatibility
            this.dataManager.getSurgeons().forEach(surgeon => {
                const option = document.createElement('option');
                option.value = surgeon;
                option.textContent = surgeon;
                surgeonSelect.appendChild(option);
            });
        }

        // Pre-populate form if editing existing tray
        if (trayId) {
            try {
                const tray = await this.dataManager.getTray(trayId);
                if (tray) {
                    // Pre-select facility if available
                    if (tray.facility || tray.location) {
                        facilitiesList.value = tray.facility || tray.location;
                    }

                    // Pre-select surgeon if available
                    if (tray.surgeon) {
                        surgeonSelect.value = tray.surgeon;
                    }

                    // Pre-fill case date if available
                    if (tray.caseDate) {
                        document.getElementById('caseDate').value = tray.caseDate;
                    }
                }
            } catch (error) {
                console.error('Error loading tray data for modal:', error);
            }
        }

        // Set default date to today if not pre-filled
        if (!document.getElementById('caseDate').value) {
            document.getElementById('caseDate').value = new Date().toISOString().split('T')[0];
        }

        // Clear photo preview
        document.getElementById('checkinPhotoPreview').innerHTML = '';
        if (window.app.photoManager) {
            window.app.photoManager.clearPhoto('checkin');
        }

        const modal = new bootstrap.Modal(document.getElementById('checkinModal'));
        modal.show();
    }

    showPickupModal(trayId) {
        document.getElementById('pickupTrayId').value = trayId;
        document.getElementById('pickupPhotoPreview').innerHTML = '';
        if (window.app.photoManager) {
            window.app.photoManager.clearPhoto('pickup');
        }
        const modal = new bootstrap.Modal(document.getElementById('pickupModal'));
        modal.show();
    }

    async showTurnoverModal(trayId) {
        document.getElementById('turnoverTrayId').value = trayId;

        // Get tray info
        const tray = await this.dataManager.getTray(trayId);
        const trayInfo = document.getElementById('turnoverTrayInfo');
        if (tray) {
            trayInfo.innerHTML = `
                <div class="tray-info-card">
                    <div class="tray-info-header">
                        <h6><i class="fas fa-box"></i> ${tray.name}</h6>
                        <span class="tray-status-badge status-${tray.status}">${tray.status}</span>
                    </div>
                    <div class="tray-info-details">
                        <div class="info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span><strong>Location:</strong> ${this.getLocationText(tray.location)}</span>
                        </div>
                        ${tray.caseDate ? `
                            <div class="info-item">
                                <i class="fas fa-calendar"></i>
                                <span><strong>Case Date:</strong> ${tray.caseDate}</span>
                            </div>
                        ` : ''}
                        ${tray.surgeon ? `
                            <div class="info-item">
                                <i class="fas fa-user-md"></i>
                                <span><strong>Surgeon:</strong> ${this.getSurgeonName(tray.surgeon)}</span>
                            </div>
                        ` : ''}
                        ${tray.assignedTo ? `
                            <div class="info-item">
                                <i class="fas fa-user"></i>
                                <span><strong>Assigned To:</strong> ${this.getUserName(tray.assignedTo)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Populate team members
        const whoPickedUpSelect = document.getElementById('whoPickedUp');
        whoPickedUpSelect.innerHTML = '<option value="">Select team member...</option>';
        const users = this.dataManager.getUsers();
        users.forEach((user, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = user.name;
            whoPickedUpSelect.appendChild(option);
        });

        // Populate doctors
        const newDoctorSelect = document.getElementById('newDoctor');
        newDoctorSelect.innerHTML = '<option value="">Keep current doctor</option>';

        // Get surgeons from SurgeonManager if available, otherwise use DataManager fallback
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            window.app.surgeonManager.currentSurgeons
                .filter(surgeon => surgeon.active)
                .forEach(surgeon => {
                    const option = document.createElement('option');
                    option.value = surgeon.id; // Store surgeon ID
                    option.textContent = `${surgeon.title || 'Dr.'} ${surgeon.name}`;
                    newDoctorSelect.appendChild(option);
                });
        } else {
            // Fallback to old system for backward compatibility
            this.dataManager.getSurgeons().forEach(surgeon => {
                const option = document.createElement('option');
                option.value = surgeon;
                option.textContent = surgeon;
                newDoctorSelect.appendChild(option);
            });
        }

        // Clear photo previews
        document.getElementById('turnoverCheckinPhotoPreview').innerHTML = '';
        document.getElementById('turnoverPhotoPreview').innerHTML = '';
        if (window.app.photoManager) {
            window.app.photoManager.clearPhoto('turnoverCheckin');
            window.app.photoManager.clearPhoto('turnover');
        }

        const modal = new bootstrap.Modal(document.getElementById('turnoverModal'));
        modal.show();
    }

    async showHistoryModal(trayId) {
        const historyContent = document.getElementById('trayHistoryContent');
        historyContent.innerHTML = `
            <div class="loading-state">
                <div class="spinner-border" role="status"></div>
                <p class="mt-2">Loading history...</p>
            </div>
        `;

        const history = await this.dataManager.getTrayHistory(trayId);

        if (history && history.length > 0) {
            historyContent.innerHTML = '';
            history.forEach(entry => {
                const historyItem = this.createHistoryItem(entry);
                historyContent.appendChild(historyItem);
            });
        } else {
            historyContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p class="text-muted">No history available for this tray.</p>
                </div>
            `;
        }

        const modal = new bootstrap.Modal(document.getElementById('historyModal'));
        modal.show();
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

    createHistoryItem(entry) {
        const item = document.createElement('div');
        item.className = 'history-entry';

        const timestamp = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
        const actionIcon = this.getActionIcon(entry.action);
        const actionClass = this.getActionClass(entry.action);

        item.innerHTML = `
            <div class="history-timeline">
                <div class="history-icon ${actionClass}">
                    <i class="${actionIcon}"></i>
                </div>
                <div class="history-line"></div>
            </div>
            <div class="history-content">
                <div class="history-header">
                    <h6 class="history-action">${this.getActionText(entry.action)}</h6>
                    <span class="history-time">${this.formatDateTime(timestamp)}</span>
                </div>
                <p class="history-details">${entry.details}</p>
                <div class="history-meta">
                    <small class="text-muted">
                        <i class="fas fa-user"></i> ${this.getUserName(entry.userId) || entry.user || 'Unknown User'}
                    </small>
                </div>
                ${entry.photoUrl ? `
                    <div class="history-photo">
                        <img src="${entry.photoUrl}" alt="History photo" onclick="this.classList.toggle('expanded')">
                    </div>
                ` : ''}
            </div>
        `;

        return item;
    }

    getActionIcon(action) {
        const icons = {
            'created': 'fas fa-plus',
            'checked-in': 'fas fa-sign-in-alt',
            'picked-up': 'fas fa-hand-paper',
            'reassigned': 'fas fa-user-tag',
            'turnover': 'fas fa-exchange-alt',
            'updated': 'fas fa-edit'
        };
        return icons[action] || 'fas fa-info';
    }

    getActionClass(action) {
        const classes = {
            'created': 'action-created',
            'checked-in': 'action-checkin',
            'picked-up': 'action-pickup',
            'reassigned': 'action-reassign',
            'turnover': 'action-turnover',
            'updated': 'action-update'
        };
        return classes[action] || 'action-default';
    }

    getActionText(action) {
        const texts = {
            'created': 'Tray Created',
            'checked-in': 'Checked In',
            'picked-up': 'Picked Up',
            'reassigned': 'Reassigned',
            'turnover': 'Turnover',
            'updated': 'Updated'
        };
        return texts[action] || action.charAt(0).toUpperCase() + action.slice(1);
    }

    formatDateTime(date) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    getLocationText(locationId) {
        if (window.app.locationManager && window.app.locationManager.currentLocations) {
            const location = window.app.locationManager.currentLocations.find(
                loc => loc.id === locationId
            );
            if (location) {
                return location.name || 'Unknown';
            }
        }

        const staticLocations = {
            'trunk': 'Rep Trunk',
            'facility': 'Medical Facility',
            'corporate': 'SI-BONE Corporate'
        };

        return staticLocations[locationId] || 'Unknown Location';
    }

    showAddUserModal() {
        const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
        modal.show();
    }

    async showEditUserModal(userId) {
        try {
            const users = window.app.dataManager.getUsers();
            const user = users.get(userId);

            if (!user) {
                this.showErrorNotification('User not found');
                return;
            }

            // Populate form fields
            document.getElementById('editUserId').value = userId;
            document.getElementById('editUserName').value = user.name || '';
            document.getElementById('editUserEmail').value = user.email || '';
            document.getElementById('editUserRole').value = user.role || '';
            document.getElementById('editUserPhone').value = user.phone || '';
            document.getElementById('editUserRegion').value = user.region || '';
            document.getElementById('editUserActive').checked = user.active !== false;

            const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing edit user modal:', error);
            this.showErrorNotification('Error loading user data: ' + error.message);
        }
    }

    showAddLocationModal() {
        const modal = new bootstrap.Modal(document.getElementById('addLocationModal'));
        modal.show();
    }

    showAddSurgeonModal() {
        this.populateCaseTypesDropdown('surgeonPreferredCases');

        const select = document.getElementById('surgeonPreferredCases');
        if (select) {
            Array.from(select.options).forEach(option => {
                option.selected = false;
            });
        }

        const modal = new bootstrap.Modal(document.getElementById('addSurgeonModal'));
        modal.show();
    }

    async populateCaseTypesDropdown(selectElementId) {
        const selectElement = document.getElementById(selectElementId);
        if (!selectElement) return;

        selectElement.innerHTML = '<option value="">Select case types...</option>';

        if (window.app.dataManager && window.app.dataManager.caseTypes) {
            const activeCaseTypes = window.app.dataManager.caseTypes
                .filter(ct => ct.active !== false)
                .sort((a, b) => a.name.localeCompare(b.name));

            activeCaseTypes.forEach(caseType => {
                const option = document.createElement('option');
                option.value = caseType.id;
                option.textContent = caseType.name;
                selectElement.appendChild(option);
            });
        }
    }

    async showEditSurgeonModal(surgeonId) {
        try {
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);

            if (!surgeon) {
                this.showErrorNotification('Surgeon not found');
                return;
            }

            // Populate case types dropdown first
            await this.populateCaseTypesDropdown('editSurgeonPreferredCases');

            // Populate form fields
            document.getElementById('editSurgeonId').value = surgeonId;
            document.getElementById('editSurgeonTitle').value = surgeon.title || 'Dr.';
            document.getElementById('editSurgeonName').value = surgeon.name || '';
            document.getElementById('editSurgeonSpecialty').value = surgeon.specialty || '';
            document.getElementById('editSurgeonHospital').value = surgeon.hospital || '';
            document.getElementById('editSurgeonEmail').value = surgeon.email || '';
            document.getElementById('editSurgeonPhone').value = surgeon.phone || '';
            document.getElementById('editSurgeonNotes').value = surgeon.notes || '';
            document.getElementById('editSurgeonActive').checked = surgeon.active !== false;

            // Handle preferred cases - convert from comma-separated IDs to selection
            if (surgeon.preferredCases) {
                const caseTypeIds = surgeon.preferredCases.split(',').map(id => id.trim()).filter(id => id);
                const select = document.getElementById('editSurgeonPreferredCases');

                // Clear all selections first
                Array.from(select.options).forEach(option => {
                    option.selected = false;
                });

                // Select matching options
                Array.from(select.options).forEach(option => {
                    if (caseTypeIds.includes(option.value)) {
                        option.selected = true;
                    }
                });
            }

            const modal = new bootstrap.Modal(document.getElementById('editSurgeonModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing edit surgeon modal:', error);
            this.showErrorNotification('Error loading surgeon data: ' + error.message);
        }
    }

    async showEditLocationModal(locationId) {
        try {
            const location = window.app.locationManager.currentLocations.find(l => l.id === locationId);

            if (!location) {
                this.showErrorNotification('Location not found');
                return;
            }

            // Populate form fields
            document.getElementById('editLocationId').value = locationId;
            document.getElementById('editLocationName').value = location.name || '';
            document.getElementById('editLocationType').value = location.type || '';
            document.getElementById('editLocationAddress').value = location.address || '';
            document.getElementById('editLocationCity').value = location.city || '';
            document.getElementById('editLocationState').value = location.state || '';
            document.getElementById('editLocationZip').value = location.zip || '';
            document.getElementById('editLocationPhone').value = location.phone || '';
            document.getElementById('editLocationContact').value = location.contact || '';
            document.getElementById('editLocationRegion').value = location.region || '';
            document.getElementById('editLocationLatitude').value = location.latitude || '';
            document.getElementById('editLocationLongitude').value = location.longitude || '';
            document.getElementById('editLocationNotes').value = location.notes || '';
            document.getElementById('editLocationActive').checked = location.active !== false;

            const modal = new bootstrap.Modal(document.getElementById('editLocationModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing edit location modal:', error);
            this.showErrorNotification('Error loading location data: ' + error.message);
        }
    }

    showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-error';
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
            background: var(--danger-red);
            box-shadow: var(--shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; margin-left: auto; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

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

    showAddCaseTypeModal() {
        const modal = new bootstrap.Modal(document.getElementById('addCaseTypeModal'));
        modal.show();
    }

    async showEditCaseTypeModal(caseTypeId) {
        try {
            const caseType = window.app.caseTypeManager.currentCaseTypes.find(ct => ct.id === caseTypeId);

            if (!caseType) {
                this.showErrorNotification('Case type not found');
                return;
            }

            // Populate form fields
            document.getElementById('editCaseTypeId').value = caseTypeId;
            document.getElementById('editCaseTypeName').value = caseType.name || '';
            document.getElementById('editCaseTypeDescription').value = caseType.description || '';
            document.getElementById('editCaseTypeActive').checked = caseType.active !== false;

            const modal = new bootstrap.Modal(document.getElementById('editCaseTypeModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing edit case type modal:', error);
            this.showErrorNotification('Error loading case type data: ' + error.message);
        }
    }
}