// js/ModalManager.js - Updated for Tray Tracker
import { populateCaseStatusDropdown, DEFAULT_CASE_STATUS } from './constants/CaseStatus.js';
import { populateFacilityTypeDropdown, DEFAULT_FACILITY_TYPE } from './constants/FacilityTypes.js';
import { populateTrayStatusDropdown } from './constants/TrayStatus.js';
import { populateTrayLocationDropdown, TRAY_LOCATIONS, getLocationDisplayText } from './constants/TrayLocations.js';
import { googlePlacesAutocomplete } from './utils/GooglePlacesAutocomplete.js';

export class ModalManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.initializeModalEvents();
    }

    async logToAPI(message, data = null, context = 'modal-debug') {
        // Check global API logging toggle
        if (!window.is_enable_api_logging) {
            return; // Skip logging if disabled
        }
        
        try {
            await fetch('https://traytracker-dev.serverdatahost.com/api/debug/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'info',
                    message: `🔥 ${message}`,
                    data: data,
                    context: context
                })
            });
        } catch (error) {
            console.log('Failed to log to API:', error);
            // Fallback to console.log if API endpoint fails
            console.log(`🔥 ${message}`, data);
        }
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
                
                // Clean up Google Places autocomplete for facility modals
                // Now using smart cleanup that preserves address fields
                if (modal.id === 'addFacilityModal') {
                    googlePlacesAutocomplete.removeAutocomplete('facilityAddress');
                } else if (modal.id === 'editFacilityModal') {
                    googlePlacesAutocomplete.removeAutocomplete('editFacilityAddress');
                }
            });
        });
    }

    async showAddTrayModal() {
        // Reset modal to add mode
        window.app.trayManager.resetTrayModal();
        
        await this.populateInitialLocationDropdown();
        await this.populateCaseTypeCompatibilityDropdown();
        await this.populateTrayStatusDropdown();
        await window.app.trayManager.populateUserDropdown();
        const modal = new bootstrap.Modal(document.getElementById('addTrayModal'));
        modal.show();
    }

    async populateCaseTypeCompatibilityDropdown() {
        try {
            const trayTypeSelect = document.getElementById('trayType');
            if (!trayTypeSelect) {
                console.error('Tray type select element not found');
                return;
            }

            // Clear existing options
            trayTypeSelect.innerHTML = '';

            // Get case types from Firestore
            const caseTypes = await this.dataManager.getAllCaseTypes();
            
            if (caseTypes && caseTypes.length > 0) {
                // Filter active case types and sort alphabetically
                const activeCaseTypes = caseTypes
                    .filter(caseType => caseType.active !== false && !caseType.deletedAt)
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                // Populate dropdown with case types from Firestore
                activeCaseTypes.forEach(caseType => {
                    const option = document.createElement('option');
                    option.value = caseType.name;
                    option.textContent = caseType.name;
                    trayTypeSelect.appendChild(option);
                });
                
                console.log(`✅ Populated case type compatibility dropdown with ${activeCaseTypes.length} case types:`, activeCaseTypes.map(ct => ct.name));
            } else {
                // Fallback to hardcoded case types if Firestore collection is empty
                console.warn('No case types found in Firestore, using fallback options');
                const fallbackCaseTypes = [
                    'SI fusion – lateral',
                    'SI fusion – Intra–articular',
                    'Spine fusion – Long Construct',
                    'Spine fusion – Short construct',
                    'Minimally Invasive Spine fusion'
                ];
                
                fallbackCaseTypes.forEach(caseTypeName => {
                    const option = document.createElement('option');
                    option.value = caseTypeName;
                    option.textContent = caseTypeName;
                    trayTypeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating case type compatibility dropdown:', error);
            // Show a user-friendly message or fallback options
        }
    }

    async populateInitialLocationDropdown() {
        try {
            const initialLocationSelect = document.getElementById('initialLocation');
            if (!initialLocationSelect) {
                console.error('Initial location select element not found');
                return;
            }

            // Use the centralized location dropdown function
            populateTrayLocationDropdown(initialLocationSelect, {
                includeAllOption: false,
                includeEmptyOption: true,
                emptyOptionText: 'Select Location...',
                includeFacilities: true,
                staticLocationsOnly: false
            });
        } catch (error) {
            console.error('Error populating initial location dropdown:', error);
        }
    }

    async populateTrayStatusDropdown() {
        try {
            const trayStatusSelect = document.getElementById('trayStatus');
            if (!trayStatusSelect) {
                console.error('Tray status select element not found');
                return;
            }

            // Use the centralized TrayStatus function
            populateTrayStatusDropdown(trayStatusSelect, {
                includeAllOption: false,
                includeEmptyOption: false,
                selectedValue: 'available' // Default to available for new trays
            });
        } catch (error) {
            console.error('Error populating tray status dropdown:', error);
        }
    }

    async showCheckinModal(trayId) {
        document.getElementById('checkinTrayId').value = trayId;

        // Populate facilities dropdown
        const facilitiesList = document.getElementById('checkinFacilityName');
        facilitiesList.innerHTML = '<option value="">Select Facility...</option>';

        // Add facilities from Firebase facilities collection
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const activeFacilities = window.app.facilityManager.currentFacilities
                .filter(facility => facility.active !== false && !facility.deletedAt)
                .sort((a, b) => a.account_name.localeCompare(b.account_name));

            activeFacilities.forEach(facility => {
                const option = document.createElement('option');
                option.value = facility.id;
                option.textContent = facility.account_name;
                facilitiesList.appendChild(option);
            });

            this.logToAPI('🔥 [CHECK-IN MODAL] Populated facilities dropdown', {
                facilitiesCount: activeFacilities.length,
                facilities: activeFacilities.map(f => ({ id: f.id, name: f.account_name }))
            });
        } else {
            this.logToAPI('🔥 [CHECK-IN MODAL] No facilities available', {
                hasFacilityManager: !!window.app.facilityManager,
                hasCurrentFacilities: !!(window.app.facilityManager && window.app.facilityManager.currentFacilities),
                facilitiesCount: window.app.facilityManager?.currentFacilities?.length || 0
            });
        }

        // Populate surgeons
        const surgeonSelect = document.getElementById('physician');
        surgeonSelect.innerHTML = '<option value="">Select Physician...</option>';

        // Get surgeons from SurgeonManager if available, otherwise use DataManager fallback
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            window.app.surgeonManager.currentSurgeons
                .filter(surgeon => surgeon.active)
                .forEach(surgeon => {
                    const option = document.createElement('option');
                    option.value = surgeon.id; // Store surgeon ID
                    option.textContent = `${surgeon.title || 'Dr.'} ${surgeon.full_name}`;
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

        // Populate cases dropdown
        const casesSelect = document.getElementById('checkinCaseSelect');
        casesSelect.innerHTML = '<option value="">Choose a scheduled case...</option>';
        
        try {
            // Get cases directly from dataManager if casesManager doesn't have them loaded
            let cases = [];
            if (window.app.casesManager && window.app.casesManager.currentCases && window.app.casesManager.currentCases.length > 0) {
                cases = window.app.casesManager.currentCases;
            } else if (window.app.dataManager) {
                // Load cases directly from dataManager
                cases = await window.app.dataManager.getAllCases();
            }

            if (cases && cases.length > 0) {
                // Get any future cases
                const today = new Date().toISOString().split('T')[0];
                const upcomingCases = cases
                    .filter(caseItem => caseItem.scheduledDate >= today)
                    .sort((a, b) => {
                        // Sort by date first, then by time
                        const dateA = new Date(a.scheduledDate + 'T' + (a.scheduledTime || '08:00'));
                        const dateB = new Date(b.scheduledDate + 'T' + (b.scheduledTime || '08:00'));
                        return dateA - dateB;
                    });

                upcomingCases.forEach(caseItem => {
                    const option = document.createElement('option');
                    option.value = caseItem.id;
                    // Format case display with patient, facility, and date
                    const facilityName = this.getFacilityName(caseItem.facility_id);
                    const physicianName = this.getPhysicianName(caseItem.physician_id);
                    const dateStr = new Date(caseItem.scheduledDate).toLocaleDateString();
                    const timeStr = caseItem.scheduledTime ? caseItem.scheduledTime : '';
                    option.textContent = `${caseItem.patientName} - ${facilityName} - ${dateStr} ${timeStr}`;
                    casesSelect.appendChild(option);
                });
                
                console.log(`Loaded ${upcomingCases.length} upcoming cases for check-in dropdown`);
            } else {
                console.log('No cases found for check-in dropdown');
            }
        } catch (error) {
            console.error('Error loading cases for check-in dropdown:', error);
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
                        <h6><i class="fas fa-box"></i> ${tray.tray_name}</h6>
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
                                <span><strong>Physician:</strong> ${this.getSurgeonName(tray.surgeon)}</span>
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
                    option.textContent = `${surgeon.title || 'Dr.'} ${surgeon.full_name}`;
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
        if (!surgeonId || typeof surgeonId !== 'string') return 'Unknown Physician';

        // Check if it looks like an ID (Firebase IDs are longer)
        if (surgeonId.length < 15) {
            // Probably a legacy name, return as is
            return surgeonId;
        }

        // Try to find surgeon by ID
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);
            if (surgeon) {
                return `${surgeon.title || 'Dr.'} ${surgeon.full_name}`;
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

        // Use centralized location display text
        return getLocationDisplayText(locationId);
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

    showAddFacilityModal() {
        // Reset form
        const form = document.getElementById('addFacilityForm');
        if (form) form.reset();
        
        // Set default values
        const activeCheckbox = document.getElementById('facilityActive');
        if (activeCheckbox) activeCheckbox.checked = true;
        
        const prioritySelect = document.getElementById('facilityPriority');
        if (prioritySelect) prioritySelect.value = '3';
        
        // Populate facility type dropdown
        const facilityTypeSelect = document.getElementById('facilityType');
        if (facilityTypeSelect) {
            populateFacilityTypeDropdown(facilityTypeSelect, {
                includeAllOption: false,
                includeEmptyOption: true,
                emptyOptionText: 'Select Type...',
                selectedValue: DEFAULT_FACILITY_TYPE,
                useShortLabels: false
            });
        }
        
        // Initialize Google Places autocomplete for address field
        setTimeout(() => {
            googlePlacesAutocomplete.initializeFacilityAutocomplete(
                'facilityAddress',    // address field
                'facilityCity',       // city field
                'facilityState',      // state field
                'facilityZip'         // zip field
            );
        }, 100);
        
        const modal = new bootstrap.Modal(document.getElementById('addFacilityModal'));
        modal.show();
    }

    async showEditFacilityModal(facilityId) {
        try {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            if (!facility) {
                this.showErrorNotification('Facility not found');
                return;
            }

            // Populate form fields
            document.getElementById('editFacilityId').value = facilityId;
            document.getElementById('editFacilityName').value = facility.account_name || '';
            
            // Populate facility type dropdown with current selection
            const editFacilityTypeSelect = document.getElementById('editFacilityType');
            if (editFacilityTypeSelect) {
                populateFacilityTypeDropdown(editFacilityTypeSelect, {
                    includeAllOption: false,
                    includeEmptyOption: true,
                    emptyOptionText: 'Select Type...',
                    selectedValue: facility.account_record_type,
                    useShortLabels: false
                });
            }
            
            // Show modal first, then initialize after DOM is ready
            const modal = new bootstrap.Modal(document.getElementById('editFacilityModal'));
            modal.show();
            
            // Wait for modal to be fully shown, then initialize
            document.getElementById('editFacilityModal').addEventListener('shown.bs.modal', () => {
                console.log('🔍 Modal shown, checking for editFacilityAddress field...');
                
                // Debug: List all input fields in the modal
                const modal = document.getElementById('editFacilityModal');
                const allInputs = modal.querySelectorAll('input, select, textarea');
                console.log('🔍 All form fields in modal:');
                allInputs.forEach(input => {
                    console.log(`  - ${input.id || 'no-id'} (${input.tagName})`);
                });
                
                const addressField = document.getElementById('editFacilityAddress');
                console.log('🔍 editFacilityAddress field found:', !!addressField);
                
                if (addressField) {
                    console.log('🔧 Initializing Google Places autocomplete...');
                    // Initialize Google Places autocomplete
                    googlePlacesAutocomplete.initializeFacilityAutocomplete(
                        'editFacilityAddress',    // address field
                        'editFacilityCity',       // city field
                        'editFacilityState',      // state field
                        'editFacilityZip'         // zip field
                    );
                    
                    // Set form values after a brief delay
                    setTimeout(() => {
                        const specialtyField = document.getElementById('editFacilitySpecialty');
                        const cityField = document.getElementById('editFacilityCity');
                        const stateField = document.getElementById('editFacilityState');
                        const zipField = document.getElementById('editFacilityZip');
                        
                        if (specialtyField) specialtyField.value = facility.specialty || '';
                        if (addressField) {
                            addressField.value = facility.address?.street || '';
                            console.log('✅ Set editFacilityAddress value:', facility.address?.street);
                        }
                        if (cityField) cityField.value = facility.address?.city || '';
                        if (stateField) stateField.value = facility.address?.state || '';
                        if (zipField) zipField.value = facility.address?.zip || '';
                        
                        document.getElementById('editFacilityPhone').value = facility.phone || '';
                        document.getElementById('editFacilityTerritory').value = facility.territory || '';
                        document.getElementById('editFacilityPriority').value = facility.priority || '3';
                        document.getElementById('editFacilityContact').value = facility.contact?.primary || '';
                        document.getElementById('editFacilityContactEmail').value = facility.contact?.email || '';
                        document.getElementById('editFacilityNPI').value = facility.npi || '';
                        document.getElementById('editFacilityNotes').value = facility.notes || '';
                        document.getElementById('editFacilityActive').checked = facility.active !== false;
                        document.getElementById('editFacilityLatitude').value = facility.latitude || '';
                        document.getElementById('editFacilityLongitude').value = facility.longitude || '';
                    }, 100);
                } else {
                    console.error('❌ editFacilityAddress field still not found after modal shown');
                }
            }, { once: true }); // Only run once
        } catch (error) {
            console.error('Error showing edit facility modal:', error);
            this.showErrorNotification('Error loading facility data: ' + error.message);
        }
    }

    showAddSurgeonModal() {
        // Show add physician modal
        const modal = new bootstrap.Modal(document.getElementById('addPhysicianModal'));
        modal.show();
    }

    async populateCaseTypesDropdown(selectElementId) {
        const selectElement = document.getElementById(selectElementId);
        if (!selectElement) return;

        selectElement.innerHTML = '<option value="">Select case types...</option>';

        if (window.app.dataManager && window.app.dataManager.caseTypes) {
            const activeCaseTypes = window.app.dataManager.caseTypes
                .filter(ct => ct.active !== false)
                .sort((a, b) => a.account_name.localeCompare(b.account_name));

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
            await this.logToAPI('showEditSurgeonModal called', { surgeonId }, 'surgeon-modal');
            
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);

            if (!surgeon) {
                await this.logToAPI('ERROR: Surgeon not found', { surgeonId }, 'surgeon-modal');
                this.showErrorNotification('Physician not found');
                return;
            }

            await this.logToAPI('Found surgeon', { surgeonId, surgeonName: surgeon.full_name }, 'surgeon-modal');

            // Populate form fields with correct physician modal IDs
            await this.logToAPI('Populating form fields...', null, 'surgeon-modal');
            document.getElementById('editPhysicianId').value = surgeonId;
            document.getElementById('editPhysicianTitle').value = surgeon.title || 'Dr.';
            document.getElementById('editPhysicianName').value = surgeon.full_name || '';
            document.getElementById('editPhysicianSpecialty').value = surgeon.specialty || '';
            document.getElementById('editPhysicianHospital').value = surgeon.hospital || '';
            document.getElementById('editPhysicianEmail').value = surgeon.email || '';
            document.getElementById('editPhysicianPhone').value = surgeon.phone || '';
            document.getElementById('editPhysicianNotes').value = surgeon.notes || '';
            document.getElementById('editPhysicianActive').checked = surgeon.active !== false;

            await this.logToAPI('Showing modal...', null, 'surgeon-modal');
            const modal = new bootstrap.Modal(document.getElementById('editPhysicianModal'));
            modal.show();

            // Load surgeon's tray preferences after modal is shown
            await this.logToAPI('Setting up tray preferences loading with 500ms delay...', null, 'surgeon-modal');
            setTimeout(async () => {
                await this.logToAPI('Timeout triggered - about to load tray preferences', null, 'surgeon-modal-timeout');
                await this.logToAPI('Checking surgeon manager availability', { 
                    surgeonManagerExists: !!window.app.surgeonManager,
                    methodExists: !!window.app.surgeonManager?.loadSurgeonTrayPreferences
                }, 'surgeon-modal-timeout');
                
                if (window.app.surgeonManager && window.app.surgeonManager.loadSurgeonTrayPreferences) {
                    await this.logToAPI('Calling loadSurgeonTrayPreferences', { surgeonId }, 'surgeon-modal-timeout');
                    try {
                        await window.app.surgeonManager.loadSurgeonTrayPreferences(surgeonId);
                        await this.logToAPI('loadSurgeonTrayPreferences completed successfully', null, 'surgeon-modal-timeout');
                    } catch (error) {
                        await this.logToAPI('ERROR in loadSurgeonTrayPreferences', { error: error.message, stack: error.stack }, 'surgeon-modal-timeout');
                    }
                } else {
                    await this.logToAPI('ERROR: surgeonManager or loadSurgeonTrayPreferences method not available', null, 'surgeon-modal-timeout');
                }
            }, 500); // Wait for modal to be fully rendered
        } catch (error) {
            console.error('🔥 ERROR in showEditSurgeonModal:', error);
            this.showErrorNotification('Error loading physician data: ' + error.message);
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
        // Reset tray requirements for new case type
        if (window.app.caseTypeManager) {
            window.app.caseTypeManager.resetTrayRequirementsForAdd();
        }
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
            
            // Load existing tray requirements
            if (window.app.caseTypeManager) {
                await window.app.caseTypeManager.loadTrayRequirementsForEdit(caseType);
            }

            const modal = new bootstrap.Modal(document.getElementById('editCaseTypeModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing edit case type modal:', error);
            this.showErrorNotification('Error loading case type data: ' + error.message);
        }
    }

    async showAddCaseModal() {
        try {
            console.log('🔍 DEBUG: Opening Add Case Modal');
            console.log('🔍 DEBUG: DataManager exists?', !!this.dataManager);
            console.log('🔍 DEBUG: DataManager getCaseTypes method exists?', typeof this.dataManager.getCaseTypes);
            
            // Log to API debug endpoint
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.logCaseAction('Add case modal opened', {
                    hasDataManager: !!this.dataManager,
                    hasCaseTypesMethod: typeof this.dataManager?.getCaseTypes === 'function',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Show modal first
            const modalElement = document.getElementById('addCaseModal');
            const modal = new bootstrap.Modal(modalElement);
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.debug('About to show add case modal', {
                    modalExists: !!modalElement,
                    modalId: modalElement?.id,
                    modalDisplay: modalElement ? window.getComputedStyle(modalElement).display : 'N/A'
                }, 'modal-show');
            }
            
            modal.show();
            
            // Log when modal is actually shown
            modalElement.addEventListener('shown.bs.modal', () => {
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.debug('Add case modal is now visible', {
                        modalDisplay: window.getComputedStyle(modalElement).display,
                        modalClass: modalElement.className
                    }, 'modal-shown');
                }
                
                // Ensure case status dropdown is populated (backup)
                const caseStatusSelect = document.getElementById('caseStatus');
                if (caseStatusSelect && caseStatusSelect.options.length === 0) {
                    console.log('🔍 DEBUG: Case status dropdown empty, repopulating...');
                    populateCaseStatusDropdown(caseStatusSelect, {
                        includeAllOption: false,
                        includeEmptyOption: false,
                        selectedValue: DEFAULT_CASE_STATUS
                    });
                }
            }, { once: true });
            
            // Then populate dropdowns - sometimes Firebase data takes time to load
            setTimeout(async () => {
                console.log('🔍 DEBUG: About to populate dropdowns...');
                
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.debug('Starting dropdown population', {
                        modalIsVisible: modalElement.style.display !== 'none' && window.getComputedStyle(modalElement).display !== 'none',
                        timeout: '100ms'
                    }, 'dropdown-populate-start');
                }
                
                await this.populateCaseModalDropdowns();
                await this.populateTrayRequirements();
            }, 100);
            
            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('scheduledDate').value = today;
            
        } catch (error) {
            console.error('Error showing add case modal:', error);
            this.showErrorNotification('Error loading case modal data: ' + error.message);
        }
    }

    async populateCaseModalDropdowns() {
        try {
            // Populate surgeons
            const surgeonSelect = document.getElementById('addCasePhysician');
            const editSurgeonSelect = document.getElementById('editCasePhysician');
            if (surgeonSelect) {
                const surgeons = this.dataManager.getSurgeons();
                console.log('Loading surgeons for dropdown:', surgeons.length);
                const surgeonOptions = '<option value="">Select Physician</option>' + 
                    surgeons.map(surgeon => `<option value="${surgeon.id}">${surgeon.full_name}</option>`).join('');
                surgeonSelect.innerHTML = surgeonOptions;
                if (editSurgeonSelect) editSurgeonSelect.innerHTML = surgeonOptions;
            }

            // Populate facilities
            const facilitySelect = document.getElementById('addCaseFacility');
            const editFacilitySelect = document.getElementById('editCaseFacility');
            if (facilitySelect) {
                const facilities = this.dataManager.getFacilities();
                console.log('Loading facilities for dropdown:', facilities.length);
                const facilityOptions = '<option value="">Select Facility</option>' + 
                    facilities.map(facility => `<option value="${facility.id}">${facility.account_name}</option>`).join('');
                facilitySelect.innerHTML = facilityOptions;
                if (editFacilitySelect) editFacilitySelect.innerHTML = facilityOptions;
            }

            // Populate case types
            const caseTypeSelect = document.getElementById('addCaseCaseType');
            const editCaseTypeSelect = document.getElementById('editCaseType');
            if (caseTypeSelect) {
                const caseTypes = this.dataManager.getCaseTypes();
                console.log('🔍 DEBUG: Loading case types for dropdown');
                console.log('🔍 DEBUG: Case types data:', caseTypes);
                console.log('🔍 DEBUG: Case types length:', caseTypes.length);
                console.log('🔍 DEBUG: Case types type:', typeof caseTypes);
                console.log('🔍 DEBUG: Is array?', Array.isArray(caseTypes));
                
                // Log to API debug endpoint
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.logDropdownPopulation('case-types', caseTypes.length, {
                        isArray: Array.isArray(caseTypes),
                        dataType: typeof caseTypes,
                        caseTypes: caseTypes.slice(0, 5).map(ct => ({ id: ct.id, name: ct.name })), // First 5 for debugging
                        hasSelectElement: !!caseTypeSelect,
                        selectElementId: caseTypeSelect?.id
                    });
                }
                
                if (caseTypes.length === 0) {
                    console.warn('No case types found. Make sure case types are created in Firebase.');
                    caseTypeSelect.innerHTML = '<option value="">No Case Types Available - Create Some First</option>';
                    
                    // Log to API debug endpoint
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.warn('No case types available in dropdown', {
                            dataManagerHasCaseTypes: !!this.dataManager.caseTypes,
                            dataManagerCaseTypesLength: this.dataManager.caseTypes?.length || 0,
                            firebaseConnection: !!this.dataManager.db
                        }, 'case-types-empty');
                    }
                    
                    // Add a helpful message to user
                    setTimeout(() => {
                        if (confirm('No case types found! Would you like to initialize demo data which includes case types?')) {
                            if (window.app && window.app.demoManager) {
                                window.app.demoManager.initializeDemoData();
                            }
                        }
                    }, 1000);
                } else {
                    const caseTypeOptions = '<option value="">Select Case Type</option>' + 
                        caseTypes.map(caseType => `<option value="${caseType.id}">${caseType.name}</option>`).join('');
                    
                    // Log before setting innerHTML
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('About to set case type dropdown innerHTML', {
                            elementId: caseTypeSelect.id,
                            elementTagName: caseTypeSelect.tagName,
                            expectedId: 'addCaseCaseType',
                            currentInnerHTML: caseTypeSelect.innerHTML,
                            currentOptionCount: caseTypeSelect.options?.length || 0,
                            newOptionsHTML: caseTypeOptions,
                            newOptionsLength: caseTypeOptions.length
                        }, 'dropdown-before-set');
                    }
                    
                    caseTypeSelect.innerHTML = caseTypeOptions;
                    if (editCaseTypeSelect) editCaseTypeSelect.innerHTML = caseTypeOptions;
                    
                    // Log immediately after setting innerHTML
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('Case type dropdown innerHTML set', {
                            elementId: caseTypeSelect.id,
                            newInnerHTML: caseTypeSelect.innerHTML,
                            newOptionCount: caseTypeSelect.options?.length || 0,
                            firstOption: caseTypeSelect.options?.[0]?.text || 'N/A',
                            lastOption: caseTypeSelect.options?.[caseTypeSelect.options.length - 1]?.text || 'N/A'
                        }, 'dropdown-after-set');
                    }
                    
                    // Log successful population to API debug endpoint
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Case types dropdown populated successfully', {
                            count: caseTypes.length,
                            optionsGenerated: caseTypeOptions.length,
                            caseTypeNames: caseTypes.map(ct => ct.name),
                            hasEditSelect: !!editCaseTypeSelect,
                            generatedHTML: caseTypeOptions,
                            selectElementInfo: {
                                id: caseTypeSelect.id,
                                tagName: caseTypeSelect.tagName,
                                className: caseTypeSelect.className,
                                style: caseTypeSelect.style.cssText,
                                disabled: caseTypeSelect.disabled,
                                hidden: caseTypeSelect.hidden,
                                offsetWidth: caseTypeSelect.offsetWidth,
                                offsetHeight: caseTypeSelect.offsetHeight,
                                childElementCount: caseTypeSelect.childElementCount
                            }
                        }, 'case-types-success');
                        
                        // Additional DOM debugging
                        setTimeout(() => {
                            try {
                                const actualHTML = caseTypeSelect.innerHTML || '';
                                const options = caseTypeSelect.options || [];
                                const optionCount = options.length;
                                const isVisible = caseTypeSelect.offsetWidth > 0 && caseTypeSelect.offsetHeight > 0;
                                const computedStyle = window.getComputedStyle(caseTypeSelect);
                                
                                window.frontendLogger.debug('Case types dropdown DOM state after population', {
                                    actualHTML: actualHTML.substring(0, 500), // First 500 chars
                                    optionCount: optionCount,
                                    hasOptions: optionCount > 0,
                                    isVisible: isVisible,
                                    computedDisplay: computedStyle.display,
                                    computedVisibility: computedStyle.visibility,
                                    computedOpacity: computedStyle.opacity,
                                    zIndex: computedStyle.zIndex,
                                    position: computedStyle.position,
                                    parentElement: caseTypeSelect.parentElement?.tagName || 'N/A',
                                    selectValue: caseTypeSelect.value || '',
                                    selectedIndex: caseTypeSelect.selectedIndex || -1,
                                    boundingRect: caseTypeSelect.getBoundingClientRect(),
                                    elementType: caseTypeSelect.tagName,
                                    optionsExists: !!caseTypeSelect.options
                                }, 'dropdown-dom-debug');
                                
                                // Add click listener to track user interaction
                                caseTypeSelect.addEventListener('click', (event) => {
                                    const currentOptions = caseTypeSelect.options || [];
                                    window.frontendLogger.debug('User clicked case type dropdown', {
                                        optionCount: currentOptions.length,
                                        currentValue: caseTypeSelect.value || '',
                                        clickX: event.clientX,
                                        clickY: event.clientY,
                                        elementRect: caseTypeSelect.getBoundingClientRect()
                                    }, 'dropdown-interaction');
                                }, { once: true });
                                
                                // Add focus listener
                                caseTypeSelect.addEventListener('focus', () => {
                                    const currentOptions = caseTypeSelect.options || [];
                                    window.frontendLogger.debug('Case type dropdown focused', {
                                        optionCount: currentOptions.length,
                                        hasOptions: currentOptions.length > 0,
                                        firstOptionText: currentOptions.length > 0 ? currentOptions[0].text : 'N/A',
                                        lastOptionText: currentOptions.length > 1 ? currentOptions[currentOptions.length - 1].text : 'N/A'
                                    }, 'dropdown-interaction');
                                }, { once: true });
                                
                                // Set up MutationObserver to watch for changes to the dropdown
                                const observer = new MutationObserver((mutations) => {
                                    mutations.forEach((mutation) => {
                                        if (mutation.type === 'childList' || mutation.type === 'attributes') {
                                            window.frontendLogger.warn('Case type dropdown was modified after population', {
                                                mutationType: mutation.type,
                                                addedNodes: mutation.addedNodes.length,
                                                removedNodes: mutation.removedNodes.length,
                                                attributeName: mutation.attributeName,
                                                newOptionCount: caseTypeSelect.options?.length || 0,
                                                newInnerHTML: caseTypeSelect.innerHTML?.substring(0, 200) || ''
                                            }, 'dropdown-mutation');
                                        }
                                    });
                                });
                                
                                observer.observe(caseTypeSelect, {
                                    childList: true,
                                    attributes: true,
                                    subtree: true
                                });
                                
                                // Stop observing after 10 seconds
                                setTimeout(() => observer.disconnect(), 10000);
                                
                            } catch (debugError) {
                                window.frontendLogger.error('Error in dropdown DOM debugging', {
                                    error: debugError.message,
                                    elementExists: !!caseTypeSelect,
                                    elementId: caseTypeSelect?.id,
                                    elementTagName: caseTypeSelect?.tagName
                                }, 'dropdown-debug-error');
                            }
                        }, 100);
                    }
                }
            }
            
            // Populate case status dropdowns
            const caseStatusSelect = document.getElementById('caseStatus');
            const editCaseStatusSelect = document.getElementById('editCaseStatus');
            
            console.log('🔍 DEBUG: Case status dropdown elements:', {
                caseStatusSelect: !!caseStatusSelect,
                editCaseStatusSelect: !!editCaseStatusSelect,
                caseStatusId: caseStatusSelect?.id,
                editCaseStatusId: editCaseStatusSelect?.id
            });
            
            if (caseStatusSelect) {
                console.log('🔍 DEBUG: Populating case status dropdown for add modal');
                populateCaseStatusDropdown(caseStatusSelect, {
                    includeAllOption: false,
                    includeEmptyOption: false,
                    selectedValue: DEFAULT_CASE_STATUS
                });
                console.log('🔍 DEBUG: Case status dropdown populated, options count:', caseStatusSelect.options.length);
            } else {
                console.warn('⚠️ Case status dropdown (caseStatus) not found for add modal');
            }
            
            if (editCaseStatusSelect) {
                console.log('🔍 DEBUG: Populating case status dropdown for edit modal');
                populateCaseStatusDropdown(editCaseStatusSelect, {
                    includeAllOption: false,
                    includeEmptyOption: false,
                    selectedValue: DEFAULT_CASE_STATUS
                });
                console.log('🔍 DEBUG: Edit case status dropdown populated, options count:', editCaseStatusSelect.options.length);
            } else {
                console.warn('⚠️ Case status dropdown (editCaseStatus) not found for edit modal');
            }
            
        } catch (error) {
            console.error('Error populating case modal dropdowns:', error);
        }
    }

    async populateTrayRequirements() {
        try {
            const addTrayContainer = document.getElementById('trayRequirements');
            const editTrayContainer = document.getElementById('editTrayRequirements');
            
            // Only proceed if at least one container exists
            if (!addTrayContainer && !editTrayContainer) return;

            const trays = await this.dataManager.getAllTrays();
            if (trays.length === 0) {
                const noTraysMessage = '<small class="text-muted">No trays available</small>';
                if (addTrayContainer) addTrayContainer.innerHTML = noTraysMessage;
                if (editTrayContainer) editTrayContainer.innerHTML = noTraysMessage;
                return;
            }

            // Generate tray requirement builder interface
            const trayRequirementBuilder = `
                <div class="tray-requirements-builder">
                    <div class="mb-3">
                        <button type="button" class="btn btn-sm btn-primary" onclick="app.modalManager.addTrayRequirement(this)">
                            <i class="fas fa-plus"></i> Add Tray Requirement
                        </button>
                    </div>
                    <div class="tray-requirements-list" data-modal="add">
                        <div class="text-muted small">Click "Add Tray Requirement" to specify required trays for this case</div>
                    </div>
                </div>
            `;

            const editTrayRequirementBuilder = `
                <div class="tray-requirements-builder">
                    <div class="mb-3">
                        <button type="button" class="btn btn-sm btn-primary" onclick="app.modalManager.addTrayRequirement(this)">
                            <i class="fas fa-plus"></i> Add Tray Requirement
                        </button>
                    </div>
                    <div class="tray-requirements-list" data-modal="edit">
                        <div class="text-muted small">Click "Add Tray Requirement" to specify required trays for this case</div>
                    </div>
                </div>
            `;

            // Populate both containers
            if (addTrayContainer) addTrayContainer.innerHTML = trayRequirementBuilder;
            if (editTrayContainer) editTrayContainer.innerHTML = editTrayRequirementBuilder;
            
        } catch (error) {
            console.error('Error populating tray requirements:', error);
            const errorMessage = '<small class="text-danger">Error loading trays</small>';
            const addTrayContainer = document.getElementById('trayRequirements');
            const editTrayContainer = document.getElementById('editTrayRequirements');
            if (addTrayContainer) addTrayContainer.innerHTML = errorMessage;
            if (editTrayContainer) editTrayContainer.innerHTML = errorMessage;
        }
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

    async addTrayRequirement(buttonElement) {
        try {
            const modal = buttonElement.closest('.modal').id.includes('edit') ? 'edit' : 'add';
            const container = buttonElement.parentElement.nextElementSibling;
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.debug('addTrayRequirement called', {
                    modal: modal,
                    hasButton: !!buttonElement,
                    hasContainer: !!container,
                    containerClasses: container ? Array.from(container.classList) : 'no container',
                    containerHTML: container ? container.innerHTML.substring(0, 100) : 'no container',
                    expectedSelector: `[data-modal="${modal}"].tray-requirements-list`
                }, 'tray-requirements-debug');
            }
            const trays = await this.dataManager.getAllTrays();
            
            // Clear placeholder text if this is the first requirement
            if (container.children.length === 1 && container.children[0].classList.contains('text-muted')) {
                container.innerHTML = '';
            }

            const requirementId = Date.now();
            const requirementHTML = `
                <div class="tray-requirement-item border rounded p-3 mb-3" data-requirement-id="${requirementId}">
                    <div class="row">
                        <div class="col-md-4">
                            <label class="form-label small">Tray</label>
                            <select class="form-select form-select-sm tray-select" onchange="app.modalManager.updateTrayRequirement(this)" required>
                                <option value="">Select Tray...</option>
                                ${trays.map(tray => `
                                    <option value="${tray.id}" data-tray-name="${tray.tray_name}" data-tray-type="${tray.type}">
                                        ${tray.tray_name} (${this.getTrayTypeDisplayName(tray)})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small">Type</label>
                            <select class="form-select form-select-sm requirement-type" required>
                                <option value="required">Required</option>
                                <option value="preferred">Preferred</option>
                                <option value="optional">Optional</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small">Quantity</label>
                            <input type="number" class="form-control form-control-sm quantity" value="1" min="1" max="10" required>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small">Priority</label>
                            <input type="number" class="form-control form-control-sm priority" value="1" min="1" max="10" required>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small">&nbsp;</label>
                            <button type="button" class="btn btn-sm btn-outline-danger d-block" onclick="app.modalManager.removeTrayRequirement(this)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            container.insertAdjacentHTML('beforeend', requirementHTML);
            
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.debug('HTML inserted into container', {
                    modal: modal,
                    containerChildrenAfterInsert: container.children.length,
                    containerClasses: Array.from(container.classList),
                    isExpectedContainer: container.classList.contains('tray-requirements-list') && container.getAttribute('data-modal') === modal
                }, 'tray-requirements-debug');
            }
        } catch (error) {
            console.error('Error adding tray requirement:', error);
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('addTrayRequirement failed', { error: error.message }, 'tray-requirements-debug');
            }
        }
    }

    updateTrayRequirement(selectElement) {
        const selectedOption = selectElement.selectedOptions[0];
        if (selectedOption) {
            const item = selectElement.closest('.tray-requirement-item');
            item.setAttribute('data-tray-id', selectElement.value);
            item.setAttribute('data-tray-name', selectedOption.getAttribute('data-tray-name'));
            item.setAttribute('data-tray-type', selectedOption.getAttribute('data-tray-type'));
        }
    }

    removeTrayRequirement(buttonElement) {
        const item = buttonElement.closest('.tray-requirement-item');
        const container = item.parentElement;
        item.remove();

        // Show placeholder text if no requirements left
        if (container.children.length === 0) {
            container.innerHTML = '<div class="text-muted small">Click "Add Tray Requirement" to specify required trays for this case</div>';
        }
    }

    getTrayRequirementsFromUI(modal = 'add') {
        const selector = modal === 'edit' ? '[data-modal="edit"] .tray-requirement-item' : '[data-modal="add"] .tray-requirement-item';
        const items = document.querySelectorAll(selector);
        
        return Array.from(items).map(item => {
            const traySelect = item.querySelector('.tray-select');
            const requirementType = item.querySelector('.requirement-type');
            const quantity = item.querySelector('.quantity');
            const priority = item.querySelector('.priority');
            
            return {
                tray_id: traySelect.value,
                tray_name: traySelect.selectedOptions[0]?.getAttribute('data-tray-name') || '',
                tray_type: traySelect.selectedOptions[0]?.getAttribute('data-tray-type') || '',
                requirement_type: requirementType.value,
                quantity: parseInt(quantity.value) || 1,
                priority: parseInt(priority.value) || 1
            };
        }).filter(req => req.tray_id); // Only return requirements with a selected tray
    }

    async setTrayRequirementsInUI(requirements, modal = 'edit') {
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.info('ModalManager.setTrayRequirementsInUI called', {
                requirements: requirements,
                modal: modal,
                requirementsLength: requirements?.length,
                isArray: Array.isArray(requirements)
            }, 'tray-requirements-debug');
        }
        
        const container = document.querySelector(`[data-modal="${modal}"].tray-requirements-list`);
        if (!container) {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.error('Tray requirements container not found', { 
                    modal: modal,
                    selector: `[data-modal="${modal}"] .tray-requirements-list`
                }, 'tray-requirements-debug');
            }
            return;
        }

        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.info('Container found, processing requirements', {
                modal: modal,
                requirements: requirements,
                containerFound: true
            }, 'tray-requirements-debug');
        }
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.info('Setting tray requirements in UI', {
                modal: modal,
                requirements: requirements,
                requirementsLength: requirements?.length,
                isArray: Array.isArray(requirements),
                containerFound: !!container
            }, 'tray-requirements-debug');
        }

        // Clear existing content
        container.innerHTML = '';

        if (requirements && requirements.length > 0) {
            if (window.is_enable_api_logging && window.frontendLogger) {
                window.frontendLogger.info('Starting to process requirements', {
                    requirementsCount: requirements.length
                }, 'tray-requirements-debug');
            }
            
            for (let index = 0; index < requirements.length; index++) {
                const req = requirements[index];
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.info(`Processing requirement ${index + 1}`, {
                        requirement: req,
                        index: index,
                        tray_id: req.tray_id,
                        tray_name: req.tray_name,
                        requirement_type: req.requirement_type,
                        quantity: req.quantity,
                        priority: req.priority
                    }, 'tray-requirements-debug');
                }
                
                const button = container.parentElement.querySelector('button');
                await this.addTrayRequirement(button);
                
                // Re-query the container to get the updated DOM after addTrayRequirement
                const updatedContainer = document.querySelector(`[data-modal="${modal}"].tray-requirements-list`);
                const lastItem = updatedContainer ? updatedContainer.lastElementChild : null;
                
                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.debug('Added tray requirement item to DOM', {
                        index: index,
                        hasLastItem: !!lastItem,
                        originalContainerChildren: container.children.length,
                        updatedContainerChildren: updatedContainer ? updatedContainer.children.length : 0,
                        containerHTML: updatedContainer ? updatedContainer.innerHTML.substring(0, 200) : 'no container',
                        containerSelector: `[data-modal="${modal}"].tray-requirements-list`
                    }, 'tray-requirements-debug');
                }
                
                // Set the values
                const traySelect = lastItem.querySelector('.tray-select');
                const requirementType = lastItem.querySelector('.requirement-type');
                const quantity = lastItem.querySelector('.quantity');
                const priority = lastItem.querySelector('.priority');
                
                if (traySelect && req.tray_id) {
                    traySelect.value = req.tray_id;
                    
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.info('Set tray select value', {
                            expectedValue: req.tray_id,
                            actualValue: traySelect.value,
                            success: traySelect.value === req.tray_id,
                            optionsCount: traySelect.options.length
                        }, 'tray-requirements-debug');
                    }
                    
                    // Trigger the change event to update item attributes
                    this.updateTrayRequirement(traySelect);
                }
                
                if (requirementType) {
                    requirementType.value = req.requirement_type || 'required';
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('Set requirement type', {
                            value: req.requirement_type || 'required'
                        }, 'tray-requirements-debug');
                    }
                }
                
                if (quantity) {
                    quantity.value = req.quantity || 1;
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('Set quantity', {
                            value: req.quantity || 1
                        }, 'tray-requirements-debug');
                    }
                }
                
                if (priority) {
                    priority.value = req.priority || 1;
                    if (window.is_enable_api_logging && window.frontendLogger) {
                        window.frontendLogger.debug('Set priority', {
                            value: req.priority || 1
                        }, 'tray-requirements-debug');
                    }
                }
            }
        } else {
            container.innerHTML = '<div class="text-muted small">Click "Add Tray Requirement" to specify required trays for this case</div>';
        }
    }

    getFacilityName(facilityId) {
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            return facility ? facility.account_name : 'Unknown Facility';
        }
        return 'Unknown Facility';
    }

    getPhysicianName(physicianId) {
        if (window.app.dataManager && window.app.dataManager.physicians) {
            const physician = window.app.dataManager.physicians.find(p => p.id === physicianId);
            return physician ? physician.full_name : 'Unknown Physician';
        }
        return 'Unknown Physician';
    }
}