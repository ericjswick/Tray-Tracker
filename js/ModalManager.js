// js/ModalManager.js
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

    showAddTrayModal() {
        const modal = new bootstrap.Modal(document.getElementById('addTrayModal'));
        modal.show();
    }

    async showCheckinModal(trayId) {
        document.getElementById('checkinTrayId').value = trayId;

        // Populate facilities
        const facilities = this.dataManager.getFacilities();
        const facilitiesList = document.getElementById('facilitiesList');
        facilitiesList.innerHTML = '';
        facilities.forEach(facility => {
            const option = document.createElement('option');
            option.value = facility;
            facilitiesList.appendChild(option);
        });

        // Populate quick select buttons
        const quickSelectDiv = document.getElementById('quickSelectFacilities');
        quickSelectDiv.innerHTML = '';
        facilities.slice(0, 5).forEach(facility => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-outline-secondary btn-sm';
            btn.textContent = facility;
            btn.onclick = () => {
                document.getElementById('facilityName').value = facility;
            };
            quickSelectDiv.appendChild(btn);
        });

        // Populate surgeons
        const surgeonSelect = document.getElementById('surgeon');
        surgeonSelect.innerHTML = '<option value="">Select Surgeon...</option>';
        this.dataManager.getSurgeons().forEach(surgeon => {
            const option = document.createElement('option');
            option.value = surgeon;
            option.textContent = surgeon;
            surgeonSelect.appendChild(option);
        });

        // Set default date to today
        document.getElementById('caseDate').value = new Date().toISOString().split('T')[0];

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
        trayInfo.innerHTML = `
            <p><strong>Tray:</strong> ${tray.name}</p>
            <p><strong>Current Facility:</strong> ${tray.facility}</p>
            <p><strong>Case Date:</strong> ${tray.caseDate}</p>
            <p><strong>Surgeon:</strong> ${tray.surgeon}</p>
        `;

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
        this.dataManager.getSurgeons().forEach(surgeon => {
            const option = document.createElement('option');
            option.value = surgeon;
            option.textContent = surgeon;
            newDoctorSelect.appendChild(option);
        });

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
        historyContent.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';

        const history = await this.dataManager.getTrayHistory(trayId);

        if (history && history.length > 0) {
            historyContent.innerHTML = history.map(entry => {
                const timestamp = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
                return `
                    <div class="history-item">
                        <div class="d-flex justify-content-between">
                            <strong>${entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}</strong>
                            <small class="text-muted">${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}</small>
                        </div>
                        <p class="mb-1">${entry.details}</p>
                        <small class="text-muted">by ${entry.user}</small>
                        ${entry.photoUrl ? `<div class="mt-2"><img src="${entry.photoUrl}" class="photo-preview" alt="History photo"></div>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            historyContent.innerHTML = '<p class="text-muted">No history available for this tray.</p>';
        }

        const modal = new bootstrap.Modal(document.getElementById('historyModal'));
        modal.show();
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
                alert('User not found');
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
            alert('Error loading user data: ' + error.message);
        }
    }

    showAddLocationModal() {
        const modal = new bootstrap.Modal(document.getElementById('addLocationModal'));
        modal.show();
    }

    async showEditLocationModal(locationId) {
        try {
            const location = window.app.locationManager.currentLocations.find(l => l.id === locationId);

            if (!location) {
                alert('Location not found');
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
            alert('Error loading location data: ' + error.message);
        }
    }
}