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

        // Ensure implant types are loading if not already started
        if (window.app && window.app.implantTypeManager && window.app.implantTypeManager.currentImplantTypes.length === 0) {
            console.log('🔧 Triggering implant types load from tray modal');
            window.app.implantTypeManager.loadImplantTypes();
        }

        await this.populateInitialLocationDropdown();
        await this.populateCaseTypeCompatibilityDropdown();
        await this.populateImplantTypeDropdown();
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
                    option.value = caseType.id; // ✅ Use ID instead of name for compatibility matching
                    option.textContent = caseType.name; // Display name to user
                    trayTypeSelect.appendChild(option);
                });
                
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

    async populateImplantTypeDropdown() {
        try {
            console.log('🔧 [DEBUG] Starting populateImplantTypeDropdown for tray modal');

            const implantTypeSelect = document.getElementById('trayImplantType');
            if (!implantTypeSelect) {
                console.error('❌ [DEBUG] Implant type select element not found - ID: trayImplantType');
                console.log('🔍 [DEBUG] Available elements with similar IDs:');
                document.querySelectorAll('[id*="implant"]').forEach(el => {
                    console.log(`  - Found element: ${el.id} (${el.tagName})`);
                });
                return;
            }

            console.log('✅ [DEBUG] Found tray implant type select element:', implantTypeSelect.id);

            // Clear existing options
            implantTypeSelect.innerHTML = '<option value="">Select Implant Type (Optional)</option>';

            // Get active implant types
            let implantTypes = [];
            console.log('🔍 [DEBUG] Checking ImplantTypeManager availability:');
            console.log(`  - window.app exists: ${!!window.app}`);
            console.log(`  - window.app.implantTypeManager exists: ${!!(window.app && window.app.implantTypeManager)}`);

            if (window.app && window.app.implantTypeManager) {
                console.log('🔧 [DEBUG] Using window.app.implantTypeManager');
                implantTypes = window.app.implantTypeManager.getActiveImplantTypes();
                console.log(`🔧 [DEBUG] Current implant types in manager: ${window.app.implantTypeManager.currentImplantTypes.length}`);
                console.log(`🔧 [DEBUG] getActiveImplantTypes() returned: ${implantTypes ? implantTypes.length : 'null/undefined'} items`);

                // If no data found, trigger loading
                if ((!implantTypes || implantTypes.length === 0) && window.app.implantTypeManager.currentImplantTypes.length === 0) {
                    console.log('🔧 [DEBUG] No data found, triggering loadImplantTypes()');
                    window.app.implantTypeManager.loadImplantTypes();
                }
            } else {
                console.error('❌ [DEBUG] No ImplantTypeManager found!');
            }

            console.log(`🔧 Initial implant types check for tray: ${implantTypes ? implantTypes.length : 'null/undefined'} implant types found`);

            // If implant types aren't loaded yet, wait and retry
            let retryCount = 0;
            const maxRetries = 20;
            const retryDelay = 300;

            while ((!implantTypes || implantTypes.length === 0) && retryCount < maxRetries) {
                console.log(`⏳ Waiting for implant types to load for tray... attempt ${retryCount + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));

                if (window.app && window.app.implantTypeManager) {
                    implantTypes = window.app.implantTypeManager.getActiveImplantTypes();
                    console.log(`🔧 [DEBUG] Retry ${retryCount + 1}: getActiveImplantTypes() returned ${implantTypes ? implantTypes.length : 'null/undefined'} items`);
                    console.log(`🔧 [DEBUG] Retry ${retryCount + 1}: currentImplantTypes has ${window.app.implantTypeManager.currentImplantTypes.length} items`);
                }
                retryCount++;
            }

            console.log(`🔧 Final implant types check for tray after ${retryCount} retries: ${implantTypes ? implantTypes.length : 'null/undefined'} implant types`);

            if (implantTypes && implantTypes.length > 0) {
                // Filter and sort implant types
                console.log('🔍 First implant type structure:', implantTypes[0]);
                console.log('🔍 Implant type fields:', Object.keys(implantTypes[0]));

                const activeImplantTypes = implantTypes
                    .filter(implantType => {
                        const hasId = implantType && implantType.id;
                        const hasName = implantType && implantType.name;
                        console.log(`🔍 Tray modal - Filtering implant type ${implantType?.id}: hasId=${hasId}, hasName=${hasName}, name=${implantType?.name}, description=${implantType?.description}`);
                        return hasId && hasName;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));

                console.log(`✅ Valid implant types for tray dropdown: ${activeImplantTypes.length}`);

                // Populate dropdown
                activeImplantTypes.forEach(implantType => {
                    const option = document.createElement('option');
                    option.value = implantType.id;
                    option.textContent = implantType.name;
                    implantTypeSelect.appendChild(option);
                });

                console.log(`✅ Populated ${activeImplantTypes.length} implant types in tray dropdown`);
            } else {
                console.log('❌ No implant types available for tray dropdown after waiting');
                implantTypeSelect.innerHTML = '<option value="">No Implant Types Available (loading...)</option>';
            }
        } catch (error) {
            console.error('Error populating implant type dropdown:', error);
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
            // Always get fresh cases from dataManager to avoid duplicates and stale data
            let cases = await window.app.dataManager.getAllCases();

            if (cases && cases.length > 0) {
                // Get today's and future cases
                const today = new Date().toISOString().split('T')[0];

                // Deduplicate cases by ID to prevent duplicate entries
                const uniqueCases = [];
                const seenIds = new Set();
                cases.forEach(caseItem => {
                    if (caseItem.id && !seenIds.has(caseItem.id)) {
                        seenIds.add(caseItem.id);
                        uniqueCases.push(caseItem);
                    }
                });

                const upcomingCases = uniqueCases
                    .filter(caseItem => {
                        // More robust comparison to ensure today's cases are included
                        const caseDate = caseItem.scheduledDate;

                        // Try multiple comparison methods to ensure today's cases are included
                        const stringComparison = caseDate >= today;
                        const exactMatch = caseDate === today;

                        // Also try converting to Date objects for comparison
                        const caseDateObj = new Date(caseDate + 'T00:00:00');
                        const todayDateObj = new Date(today + 'T00:00:00');
                        const dateComparison = caseDateObj >= todayDateObj;

                        const include = stringComparison || exactMatch || dateComparison;

                        return include;
                    })
                    .sort((a, b) => {
                        // Sort by date first, then by time
                        const dateA = new Date(a.scheduledDate + 'T' + (a.scheduledTime || '08:00'));
                        const dateB = new Date(b.scheduledDate + 'T' + (b.scheduledTime || '08:00'));
                        return dateA - dateB;
                    });

                upcomingCases.forEach(caseItem => {
                    const option = document.createElement('option');
                    option.value = caseItem.id;
                    // Format case display: date, case type, doctor, facility
                    const facilityName = this.getFacilityName(caseItem.facility_id);
                    const physicianName = this.getSurgeonName(caseItem.physician_id);
                    const caseTypeName = this.getCaseTypeName(caseItem.caseTypeId);

                    // Display date as-is without timezone conversion
                    const dateStr = caseItem.scheduledDate;

                    const timeStr = caseItem.scheduledTime ? ` ${caseItem.scheduledTime}` : '';
                    option.textContent = `${dateStr}${timeStr} - ${caseTypeName} - ${physicianName} - ${facilityName}`;
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

    showImageModal(imageUrl) {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'image-modal-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;

        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            cursor: default;
        `;

        // Create image
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            border-radius: 0.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        `;

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<i class="fas fa-times"></i>';
        closeButton.style.cssText = `
            position: absolute;
            top: -15px;
            right: -15px;
            background: #fff;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            color: #666;
        `;

        // Close modal function
        const closeModal = () => {
            backdrop.remove();
        };

        // Event listeners
        backdrop.addEventListener('click', closeModal);
        closeButton.addEventListener('click', closeModal);
        imageContainer.addEventListener('click', (e) => e.stopPropagation());

        // Escape key to close
        const handleKeypress = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeypress);
            }
        };
        document.addEventListener('keydown', handleKeypress);

        // Assemble and show modal
        imageContainer.appendChild(img);
        imageContainer.appendChild(closeButton);
        backdrop.appendChild(imageContainer);
        document.body.appendChild(backdrop);
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
                <p class="history-details">${this.formatHistoryDetails(entry.details)}</p>
                <div class="history-meta">
                    <small class="text-muted">
                        <i class="fas fa-user"></i> ${this.getUserName(entry.userId) || entry.user || 'Unknown User'}
                    </small>
                </div>
                ${entry.photoUrl ? `
                    <div class="history-photo">
                        <img src="${entry.photoUrl}" alt="History photo" onclick="window.app.modalManager.showImageModal('${entry.photoUrl}')">
                    </div>
                ` : ''}
            </div>
        `;

        return item;
    }

    formatHistoryDetails(details) {
        if (!details) return '';
        // Convert \n\n to <br><br> for proper HTML display
        return details.replace(/\n\n/g, '<br><br>');
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
        // Populate facility dropdown
        this.populateFacilityDropdown('userLocationFacility');
        
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

            // Populate facility dropdown first
            this.populateFacilityDropdown('editUserLocationFacility');
            
            // Populate form fields
            document.getElementById('editUserId').value = userId;
            document.getElementById('editUserName').value = user.name || '';
            document.getElementById('editUserEmail').value = user.email || '';
            document.getElementById('editUserRole').value = user.role || '';
            document.getElementById('editUserPhone').value = user.phone || '';
            document.getElementById('editUserRegion').value = user.region || '';
            // Handle null, empty, or string "null" values
            const locationFacilityValue = (user.location_facility_id === null || user.location_facility_id === 'null' || !user.location_facility_id) ? '' : user.location_facility_id;
            document.getElementById('editUserLocationFacility').value = locationFacilityValue;
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
            
            // Update modal footer to include delete button on the left
            const modalFooter = document.querySelector('#editFacilityModal .modal-footer');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-danger me-auto" onclick="window.app.facilityManager.deleteFacility('${facility.id}', '${facility.account_name}')" data-bs-dismiss="modal">
                        <i class="fas fa-trash"></i> Delete Facility
                    </button>
                    <button type="button" class="btn-secondary-custom" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn-primary-custom" onclick="app.facilityManager.updateFacility()">Update Facility</button>
                `;
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
                        document.getElementById('editFacilityCorporateHQ').checked = facility.is_corporate_headquarters === true;
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

            // Populate and select preferred facilities
            this.populatePreferredFacilitiesDropdown(surgeon.preferred_facilities || []);

            // Populate case types dropdown for last case type
            this.populatePhysicianCaseTypesDropdown(surgeon.last_case_type_id);

            // Update modal footer to include delete button on the left
            const modalFooter = document.querySelector('#editPhysicianModal .modal-footer');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-danger me-auto" onclick="window.app.surgeonManager.deleteSurgeon('${surgeon.id}', '${surgeon.full_name}')" data-bs-dismiss="modal">
                        <i class="fas fa-trash"></i> Delete Physician
                    </button>
                    <button type="button" class="btn-secondary-custom" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn-primary-custom" onclick="app.surgeonManager.updateSurgeon()">Update Physician</button>
                `;
            }

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
        
        // Populate tray dropdown
        this.populateAddCaseTypeTrayDropdown();
        
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

            // Update modal footer to include delete button on the left
            const modalFooter = document.querySelector('#editCaseTypeModal .modal-footer');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button type="button" class="btn btn-danger me-auto" onclick="window.app.caseTypeManager.deleteCaseType('${caseType.id}', '${caseType.name}')" data-bs-dismiss="modal">
                        <i class="fas fa-trash"></i> Delete Case Type
                    </button>
                    <button type="button" class="btn-secondary-custom" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn-primary-custom" onclick="app.caseTypeManager.updateCaseType()">Update Case Type</button>
                `;
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

                // Ensure implant types are loading if not already started
                if (window.app && window.app.implantTypeManager && window.app.implantTypeManager.currentImplantTypes.length === 0) {
                    console.log('🔧 Triggering implant types load from case modal');
                    window.app.implantTypeManager.loadImplantTypes();
                }

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
            // Populate surgeons with improved retry logic for timing issues
            const surgeonSelect = document.getElementById('addCasePhysician');
            const editSurgeonSelect = document.getElementById('editCasePhysician');
            if (surgeonSelect || editSurgeonSelect) {
                let surgeons = this.dataManager.getSurgeons();
                console.log(`🔍 Initial surgeons check: ${surgeons ? surgeons.length : 'null/undefined'} surgeons found`);

                // If surgeons aren't loaded yet, wait a bit and retry with longer timeout
                let retryCount = 0;
                const maxRetries = 20; // Increased from 10
                const retryDelay = 300; // Increased from 200ms

                while ((!surgeons || surgeons.length === 0) && retryCount < maxRetries) {
                    console.log(`⏳ Waiting for surgeons to load... attempt ${retryCount + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    surgeons = this.dataManager.getSurgeons();
                    retryCount++;
                }

                console.log(`👨‍⚕️ Final surgeons check after ${retryCount} retries: ${surgeons ? surgeons.length : 'null/undefined'} surgeons`);

                if (surgeons && surgeons.length > 0) {
                    const validSurgeons = surgeons.filter(surgeon => surgeon && surgeon.id && surgeon.full_name);
                    console.log(`✅ Valid surgeons for dropdown: ${validSurgeons.length}`);

                    const surgeonOptions = '<option value="">Select Physician</option>' +
                        validSurgeons.map(surgeon => `<option value="${surgeon.id}">${surgeon.full_name}</option>`).join('');

                    // Populate add modal dropdown if it exists
                    if (surgeonSelect) {
                        surgeonSelect.innerHTML = surgeonOptions;
                    }

                    // Populate edit modal dropdown if it exists
                    if (editSurgeonSelect) {
                        editSurgeonSelect.innerHTML = surgeonOptions;

                        // Check for pending value to set after population
                        const pendingValue = editSurgeonSelect.getAttribute('data-pending-value');
                        if (pendingValue) {
                            editSurgeonSelect.value = pendingValue;
                            editSurgeonSelect.removeAttribute('data-pending-value');
                            console.log(`✅ Set pending physician value: ${pendingValue}`);

                            // Trigger change event to handle case type auto-selection and facility reordering
                            const changeEvent = new Event('change', { bubbles: true });
                            editSurgeonSelect.dispatchEvent(changeEvent);
                        }
                    }

                    // Add event listener for physician changes to auto-select case type
                    this.setupPhysicianChangeHandlers();
                } else {
                    console.error('❌ No surgeons available after waiting - DataManager surgeons:', this.dataManager.surgeons);
                    surgeonSelect.innerHTML = '<option value="">No physicians available (loading...)</option>';
                    if (editSurgeonSelect) editSurgeonSelect.innerHTML = '<option value="">No physicians available (loading...)</option>';
                }
            }

            // Populate facilities with retry logic for timing issues
            const facilitySelect = document.getElementById('addCaseFacility');
            const editFacilitySelect = document.getElementById('editCaseFacility');
            if (facilitySelect) {
                let facilities = this.dataManager.getFacilities();

                // If facilities aren't loaded yet, wait a bit and retry
                let retryCount = 0;
                while ((!facilities || facilities.length === 0) && retryCount < 10) {
                    console.log(`⏳ Waiting for facilities to load... attempt ${retryCount + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 200));
                    facilities = this.dataManager.getFacilities();
                    retryCount++;
                }

                if (facilities && facilities.length > 0) {
                    const facilityOptions = '<option value="">Select Facility</option>' +
                        facilities.filter(facility => facility && facility.id && facility.account_name)
                                  .map(facility => `<option value="${facility.id}">${facility.account_name}</option>`).join('');
                    facilitySelect.innerHTML = facilityOptions;
                    if (editFacilitySelect) editFacilitySelect.innerHTML = facilityOptions;
                } else {
                    console.warn('⚠️ No facilities available after waiting');
                    facilitySelect.innerHTML = '<option value="">No facilities available (loading...)</option>';
                    if (editFacilitySelect) editFacilitySelect.innerHTML = '<option value="">No facilities available (loading...)</option>';
                }
            }

            // Populate case types
            const caseTypeSelect = document.getElementById('addCaseCaseType');
            const editCaseTypeSelect = document.getElementById('editCaseType');
            if (caseTypeSelect) {
                const caseTypes = this.dataManager.getCaseTypes();
                
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
                        caseTypes.filter(caseType => caseType && caseType.id && caseType.name)
                                 .map(caseType => `<option value="${caseType.id}">${caseType.name}</option>`).join('');
                    
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

                    // Add case type change warning event listeners
                    this.setupCaseTypeChangeWarning();

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
                            caseTypeNames: caseTypes.filter(ct => ct && ct.name).map(ct => ct.name),
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
            
            
            if (caseStatusSelect) {
                populateCaseStatusDropdown(caseStatusSelect, {
                    includeAllOption: false,
                    includeEmptyOption: false,
                    selectedValue: DEFAULT_CASE_STATUS
                });
            } else {
                console.warn('⚠️ Case status dropdown (caseStatus) not found for add modal');
            }
            
            if (editCaseStatusSelect) {
                populateCaseStatusDropdown(editCaseStatusSelect, {
                    includeAllOption: false,
                    includeEmptyOption: false,
                    selectedValue: DEFAULT_CASE_STATUS
                });
            } else {
                console.warn('⚠️ Case status dropdown (editCaseStatus) not found for edit modal');
            }

            // Populate implant types with retry logic for timing issues
            const implantTypeSelect = document.getElementById('addCaseImplantType');
            const editImplantTypeSelect = document.getElementById('editCaseImplantType');
            if (implantTypeSelect || editImplantTypeSelect) {
                let implantTypes = [];
                if (window.app && window.app.implantTypeManager) {
                    implantTypes = window.app.implantTypeManager.getActiveImplantTypes();
                }

                console.log(`🔧 Initial implant types check for case: ${implantTypes ? implantTypes.length : 'null/undefined'} implant types found`);

                // If implant types aren't loaded yet, wait and retry
                let retryCount = 0;
                const maxRetries = 20;
                const retryDelay = 300;

                while ((!implantTypes || implantTypes.length === 0) && retryCount < maxRetries) {
                    console.log(`⏳ Waiting for implant types to load for case... attempt ${retryCount + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));

                    if (window.app && window.app.implantTypeManager) {
                        implantTypes = window.app.implantTypeManager.getActiveImplantTypes();
                    }
                    retryCount++;
                }

                console.log(`🔧 Final implant types check after ${retryCount} retries: ${implantTypes ? implantTypes.length : 'null/undefined'} implant types`);

                if (implantTypes && implantTypes.length > 0) {
                    console.log('🔍 Case modal - First implant type structure:', implantTypes[0]);
                    console.log('🔍 Case modal - Implant type fields:', Object.keys(implantTypes[0]));

                    const validImplantTypes = implantTypes.filter(implantType => {
                        const hasId = implantType && implantType.id;
                        const hasName = implantType && implantType.name;
                        console.log(`🔍 Case modal - Filtering implant type ${implantType?.id}: hasId=${hasId}, hasName=${hasName}, name=${implantType?.name}, description=${implantType?.description}`);
                        return hasId && hasName;
                    });
                    console.log(`✅ Valid implant types for case dropdown: ${validImplantTypes.length}`);

                    const implantTypeOptions = '<option value="">Select Implant Type (Optional)</option>' +
                        validImplantTypes.map(implantType => `<option value="${implantType.id}">${implantType.name}</option>`).join('');

                    if (implantTypeSelect) {
                        implantTypeSelect.innerHTML = implantTypeOptions;
                    }
                    if (editImplantTypeSelect) {
                        editImplantTypeSelect.innerHTML = implantTypeOptions;
                    }
                } else {
                    console.log('❌ No implant types available after waiting');
                    const emptyOptions = '<option value="">No Implant Types Available (loading...)</option>';
                    if (implantTypeSelect) implantTypeSelect.innerHTML = emptyOptions;
                    if (editImplantTypeSelect) editImplantTypeSelect.innerHTML = emptyOptions;
                }
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
            // Convert IDs to names using DataManager.caseTypes
            const caseTypeNames = tray.case_type_compatibility.map(id => {
                const caseType = this.dataManager.caseTypes.find(ct => ct.id === id);
                return caseType ? caseType.name : id;
            });
            return caseTypeNames.join(', ');
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

    async addTrayRequirement(buttonElement, skipDuplicateFiltering = false) {
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
            let trays = await this.dataManager.getAllTrays();

            // Deduplicate trays by ID (in case there are duplicate tray records)
            const uniqueTrays = [];
            const seenTrayIds = new Set();
            trays.forEach(tray => {
                if (tray.id && !seenTrayIds.has(tray.id)) {
                    seenTrayIds.add(tray.id);
                    uniqueTrays.push(tray);
                } else if (tray.id) {
                    console.warn(`🔄 Skipping duplicate tray in addTrayRequirement: ${tray.tray_name} (${tray.id})`);
                }
            });
            trays = uniqueTrays;

            // Apply case type compatibility filtering
            let currentCaseTypeId = null;
            const isInCaseTypeModal = document.getElementById('editCaseTypeModal') &&
                                    document.getElementById('editCaseTypeModal').classList.contains('show');

            if (isInCaseTypeModal) {
                // In case type modal - get the case type being edited
                currentCaseTypeId = document.getElementById('editCaseTypeId')?.value;
                console.log(`🔍 In case type modal, filtering for case type: ${currentCaseTypeId}`);
            } else {
                // In regular case modal - get the selected case type
                if (modal === 'add') {
                    currentCaseTypeId = document.getElementById('addCaseCaseType')?.value;
                } else if (modal === 'edit') {
                    currentCaseTypeId = document.getElementById('editCaseType')?.value;
                }
                console.log(`🔍 In ${modal} case modal, filtering for case type: ${currentCaseTypeId}`);
            }

            // Apply compatibility filtering if we have a case type selected
            if (currentCaseTypeId && this.dataManager.filterForTrayCompatibilityType) {
                console.log(`📊 Before compatibility filtering: ${trays.length} trays`);
                trays = this.dataManager.filterForTrayCompatibilityType(currentCaseTypeId, trays);
                console.log(`📊 After compatibility filtering: ${trays.length} trays`);
            } else {
                console.log(`⏭️ No case type selected for filtering (${currentCaseTypeId})`);
            }

            // Remove duplicates: Filter out trays that are already selected in existing requirements
            let availableTrays = trays;
            if (!skipDuplicateFiltering) {
                const alreadySelectedTrayIds = this.getAlreadySelectedTrayIds(modal);
                availableTrays = trays.filter(tray => !alreadySelectedTrayIds.includes(tray.id));
                console.log(`🚫 Filtered out ${alreadySelectedTrayIds.length} already selected trays, ${availableTrays.length} remaining`);
            } else {
                console.log(`⏭️ Skipping duplicate filtering, showing all ${trays.length} trays`);
            }

            // Sort available trays alphabetically by name
            availableTrays.sort((a, b) => (a.tray_name || '').localeCompare(b.tray_name || ''));

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
                                ${availableTrays.map(tray => `
                                    <option value="${tray.id}" data-tray-name="${tray.tray_name}" data-tray-type="${tray.type}">
                                        ${tray.tray_name}
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

    async updateTrayRequirement(selectElement) {
        const selectedOption = selectElement.selectedOptions[0];
        const item = selectElement.closest('.tray-requirement-item');
        const previousValue = item.getAttribute('data-tray-id');
        const newValue = selectElement.value;

        // Update item attributes
        if (selectedOption && newValue) {
            item.setAttribute('data-tray-id', newValue);
            item.setAttribute('data-tray-name', selectedOption.getAttribute('data-tray-name'));
            item.setAttribute('data-tray-type', selectedOption.getAttribute('data-tray-type'));

            // Determine if we're in add or edit mode
            const container = selectElement.closest('[data-modal]');
            const isAddMode = container && container.getAttribute('data-modal') === 'add';

            if (isAddMode && newValue) {
                // For add mode: Store selected trays for later compatibility update when case type is saved
                console.log(`📋 Noted tray selection for new case type: ${selectedOption.getAttribute('data-tray-name')}`);
                // The actual compatibility update will happen when the case type is saved
            }
        } else {
            // Clear attributes if no selection
            item.removeAttribute('data-tray-id');
            item.removeAttribute('data-tray-name');
            item.removeAttribute('data-tray-type');
        }

        // Only refresh dropdowns if the value actually changed
        if (previousValue !== newValue) {
            const container = selectElement.closest('[data-modal]');
            const modal = container ? container.getAttribute('data-modal') : 'add';
            await this.refreshTrayDropdowns(modal);
        }
    }

    async addCaseTypeCompatibilityToTray(trayId, caseTypeId) {
        try {
            // Get the current tray data
            const tray = await this.dataManager.getTray(trayId);
            if (!tray) {
                console.warn(`Tray ${trayId} not found`);
                return;
            }

            // Initialize or update case_type_compatibility array
            let compatibility = tray.case_type_compatibility || [];

            // Add the new case type ID if it's not already present
            if (!compatibility.includes(caseTypeId)) {
                compatibility.push(caseTypeId);

                // Update the tray in the database
                await this.dataManager.updateTray(trayId, {
                    case_type_compatibility: compatibility
                });

                console.log(`🔄 Updated tray ${tray.tray_name} compatibility:`, compatibility);
            } else {
                console.log(`ℹ️ Tray ${tray.tray_name} already compatible with case type ${caseTypeId}`);
            }
        } catch (error) {
            console.error('Error adding case type compatibility to tray:', error);
            throw error;
        }
    }

    async updateTraysWithNewCaseTypeCompatibility(caseTypeId) {
        try {
            // Get all selected tray IDs from the add case type modal
            const trayRequirements = this.getTrayRequirementsFromUI('add');

            if (trayRequirements.length > 0) {
                console.log(`🔄 Updating ${trayRequirements.length} trays with case type compatibility: ${caseTypeId}`);

                // Update each selected tray with the new case type compatibility
                for (const req of trayRequirements) {
                    if (req.tray_id) {
                        await this.addCaseTypeCompatibilityToTray(req.tray_id, caseTypeId);
                    }
                }

                console.log(`✅ Finished updating tray compatibility for case type: ${caseTypeId}`);
            }
        } catch (error) {
            console.error('Error updating trays with new case type compatibility:', error);
        }
    }

    getAlreadySelectedTrayIds(modal) {
        try {
            // Get all existing tray requirement items in the current modal
            const selector = `[data-modal="${modal}"] .tray-requirement-item .tray-select`;
            const traySelects = document.querySelectorAll(selector);

            const selectedTrayIds = [];
            traySelects.forEach(select => {
                if (select.value) {
                    selectedTrayIds.push(select.value);
                }
            });

            return selectedTrayIds;
        } catch (error) {
            console.error('Error getting already selected tray IDs:', error);
            return [];
        }
    }

    async removeTrayRequirement(buttonElement) {
        const item = buttonElement.closest('.tray-requirement-item');
        const container = item.parentElement;

        // Determine modal type
        const modalContainer = container.closest('[data-modal]');
        const modal = modalContainer ? modalContainer.getAttribute('data-modal') : 'add';

        item.remove();

        // Show placeholder text if no requirements left
        if (container.children.length === 0) {
            container.innerHTML = '<div class="text-muted small">Click "Add Tray Requirement" to specify required trays for this case</div>';
        } else {
            // Refresh dropdowns in remaining requirements to show the newly available tray
            await this.refreshTrayDropdowns(modal);
        }
    }

    async refreshTrayDropdowns(modal) {
        try {
            // Get all tray select elements in the current modal
            const traySelects = document.querySelectorAll(`[data-modal="${modal}"] .tray-requirement-item .tray-select`);
            if (traySelects.length === 0) return;

            // Get available trays (with same filtering logic as addTrayRequirement)
            let trays = await this.dataManager.getAllTrays();

            // Deduplicate trays by ID (in case there are duplicate tray records)
            const uniqueTrays = [];
            const seenTrayIds = new Set();
            trays.forEach(tray => {
                if (tray.id && !seenTrayIds.has(tray.id)) {
                    seenTrayIds.add(tray.id);
                    uniqueTrays.push(tray);
                } else if (tray.id) {
                    console.warn(`🔄 Skipping duplicate tray in dropdown: ${tray.tray_name} (${tray.id})`);
                }
            });
            trays = uniqueTrays;

            // Apply case type compatibility filtering for both case type modals and regular case modals
            const isInCaseTypeModal = document.getElementById('editCaseTypeModal') &&
                                    document.getElementById('editCaseTypeModal').classList.contains('show');

            let currentCaseTypeId = null;

            if (isInCaseTypeModal) {
                // In case type modal - get the case type being edited
                currentCaseTypeId = document.getElementById('editCaseTypeId')?.value;
                console.log(`🔍 In case type modal, filtering for case type: ${currentCaseTypeId}`);
            } else {
                // In regular case modal - get the selected case type
                if (modal === 'add') {
                    currentCaseTypeId = document.getElementById('addCaseCaseType')?.value;
                } else if (modal === 'edit') {
                    currentCaseTypeId = document.getElementById('editCaseType')?.value;
                }
                console.log(`🔍 In ${modal} case modal, filtering for case type: ${currentCaseTypeId}`);
            }

            // Apply compatibility filtering if we have a case type selected
            if (currentCaseTypeId && this.dataManager.filterForTrayCompatibilityType) {
                console.log(`📊 Before compatibility filtering: ${trays.length} trays`);
                trays = this.dataManager.filterForTrayCompatibilityType(currentCaseTypeId, trays);
                console.log(`📊 After compatibility filtering: ${trays.length} trays`);
            } else {
                console.log(`⏭️ Skipping case type compatibility filtering (no case type selected or filter function not available)`);
            }

            // Sort trays alphabetically
            trays.sort((a, b) => (a.tray_name || '').localeCompare(b.tray_name || ''));

            // Update each dropdown individually
            traySelects.forEach(select => {
                const currentValue = select.value;

                // Get selected trays from OTHER dropdowns (exclude current one)
                const otherTrayIds = [];
                traySelects.forEach(otherSelect => {
                    if (otherSelect !== select && otherSelect.value) {
                        otherTrayIds.push(otherSelect.value);
                    }
                });

                // Filter out trays selected in other dropdowns, but keep current selection available
                const availableTrays = trays.filter(tray =>
                    !otherTrayIds.includes(tray.id)
                );

                // Debug: Check for duplicates before building options
                const trayIds = availableTrays.map(tray => tray.id);
                const duplicateIds = trayIds.filter((id, index) => trayIds.indexOf(id) !== index);
                if (duplicateIds.length > 0) {
                    console.error(`❌ Found duplicate tray IDs in availableTrays:`, duplicateIds);
                    console.log(`Available trays:`, availableTrays.map(t => ({ id: t.id, name: t.tray_name })));
                }

                // Rebuild options
                const options = availableTrays.map(tray => {
                    const optionHtml = `<option value="${tray.id}" data-tray-name="${tray.tray_name}" data-tray-type="${tray.type}" ${tray.id === currentValue ? 'selected' : ''}>
                        ${tray.tray_name}
                    </option>`;
                    return optionHtml;
                });

                select.innerHTML = '<option value="">Select Tray...</option>' + options.join('');

                console.log(`🔄 Rebuilt dropdown with ${availableTrays.length} options for select element`);
                console.log(`Available tray names:`, availableTrays.map(t => t.tray_name));
            });

            console.log(`🔄 Refreshed ${traySelects.length} tray dropdowns in ${modal} modal`);
        } catch (error) {
            console.error('Error refreshing tray dropdowns:', error);
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

            // Step 1: Add empty requirement items first (without duplicate filtering)
            const button = container.parentElement.querySelector('button');
            for (let index = 0; index < requirements.length; index++) {
                await this.addTrayRequirement(button, true); // Skip duplicate filtering initially
            }

            // Step 2: Set values for all requirements
            const updatedContainer = document.querySelector(`[data-modal="${modal}"].tray-requirements-list`);
            const requirementItems = updatedContainer.querySelectorAll('.tray-requirement-item');

            for (let index = 0; index < requirements.length; index++) {
                const req = requirements[index];
                const item = requirementItems[index];

                if (window.is_enable_api_logging && window.frontendLogger) {
                    window.frontendLogger.info(`Setting values for requirement ${index + 1}`, {
                        requirement: req,
                        index: index,
                        tray_id: req.tray_id,
                        tray_name: req.tray_name,
                        requirement_type: req.requirement_type,
                        quantity: req.quantity,
                        priority: req.priority
                    }, 'tray-requirements-debug');
                }

                if (!item) continue;

                const traySelect = item.querySelector('.tray-select');
                const requirementType = item.querySelector('.requirement-type');
                const quantity = item.querySelector('.quantity');
                const priority = item.querySelector('.priority');

                // Set values without triggering refreshes
                if (traySelect && req.tray_id) {
                    console.log(`📋 Setting tray value for requirement ${index}:`, {
                        trayId: req.tray_id,
                        trayName: req.tray_name,
                        availableOptions: Array.from(traySelect.options).map(opt => ({ value: opt.value, text: opt.text }))
                    });

                    traySelect.value = req.tray_id;

                    // Verify the value was set correctly
                    if (traySelect.value !== req.tray_id) {
                        console.warn(`❌ Failed to set tray value! Expected: ${req.tray_id}, Got: ${traySelect.value}`);
                        console.log(`Available options:`, Array.from(traySelect.options).map(opt => opt.value));
                    }

                    // Set attributes directly (no updateTrayRequirement call to avoid premature refresh)
                    item.setAttribute('data-tray-id', req.tray_id);
                    item.setAttribute('data-tray-name', req.tray_name || '');
                    item.setAttribute('data-tray-type', req.tray_type || '');
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

            // Step 3: After all values are set, refresh dropdowns to remove duplicates
            await this.refreshTrayDropdowns(modal);
            console.log(`✅ Loaded ${requirements.length} tray requirements and refreshed dropdowns`);
        } else {
            container.innerHTML = '<div class="text-muted small">Click "Add Tray Requirement" to specify required trays for this case</div>';
        }
    }

    getFacilityName(facilityId) {
        if (!facilityId) return null;
        
        // Debug logging for ModalManager facility lookup
        console.log('🔍 ModalManager.getFacilityName called with:', facilityId);
        
        // If it's already a name (not an ID), return it
        if (facilityId.length > 20 && !facilityId.match(/^[a-zA-Z0-9]{20}$/)) {
            console.log('🔍 Modal: Facility appears to be a name, returning:', facilityId);
            return facilityId;
        }
        
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facilities = window.app.facilityManager.currentFacilities;
            console.log('🔍 Modal: Searching in facilities:', facilities.length, 'facilities loaded');
            const facility = facilities.find(f => f.id === facilityId);
            
            if (facility) {
                console.log('🔍 Modal: Found facility:', facility.account_name, 'for ID:', facilityId);
                return facility.account_name || facility.name || facilityId;
            } else {
                console.log('🔍 Modal: Facility not found for ID:', facilityId, 'Available IDs:', facilities.map(f => f.id));
                
                // Try to find by partial match
                const partialMatch = facilities.find(f => 
                    f.account_name?.includes(facilityId) || 
                    f.name?.includes(facilityId) ||
                    facilityId.includes(f.id)
                );
                
                if (partialMatch) {
                    console.log('🔍 Modal: Found partial match:', partialMatch.account_name || partialMatch.name);
                    return `${partialMatch.account_name || partialMatch.name} (matched)`;
                }
                
                return `Unknown Facility (${facilityId.substring(0, 8)}...)`; // Shortened ID for display
            }
        }
        return `Unknown Facility (${facilityId.substring(0, 8)}...)`;
    }

    populateFacilityDropdown(selectElementId) {
        const selectElement = document.getElementById(selectElementId);
        if (!selectElement) return;
        
        // Clear existing options except the first one
        selectElement.innerHTML = '<option value="">Select Facility Location...</option>';
        
        // Get facilities from dataManager or facilityManager
        let facilities = [];
        if (this.dataManager && this.dataManager.getFacilities) {
            facilities = this.dataManager.getFacilities();
        } else if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            facilities = window.app.facilityManager.currentFacilities;
        }
        
        if (facilities && facilities.length > 0) {
            facilities.forEach(facility => {
                const option = document.createElement('option');
                option.value = facility.id;
                option.textContent = facility.account_name || facility.name || facility.id;
                selectElement.appendChild(option);
            });
        }
    }

    getPhysicianName(physicianId) {
        if (window.app.dataManager && window.app.dataManager.physicians) {
            const physician = window.app.dataManager.physicians.find(p => p.id === physicianId);
            return physician ? physician.full_name : 'Unknown Physician';
        }
        return 'Unknown Physician';
    }

    /**
     * Populate tray dropdown in Add Case Type modal
     */
    async populateAddCaseTypeTrayDropdown() {
        const dropdown = document.getElementById('newTrayDropdown');
        if (!dropdown) {
            console.error('newTrayDropdown element not found');
            return;
        }

        try {
            // Get trays from tray manager
            let trays = window.app.trayManager?.currentTrays || [];
            
            // If no trays loaded yet, try to load them
            if (trays.length === 0 && window.app.trayManager) {
                dropdown.innerHTML = '<option value="">Loading trays...</option>';
                try {
                    await window.app.trayManager.loadTrays();
                    trays = window.app.trayManager.currentTrays || [];
                } catch (error) {
                    console.error('Error loading trays for dropdown:', error);
                }
            }
            
            // Clear existing options
            dropdown.innerHTML = '<option value="">Select Tray...</option>';
            
            if (trays.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No trays available';
                option.disabled = true;
                dropdown.appendChild(option);
                return;
            }

            // Sort trays by name for better UX
            const sortedTrays = trays.sort((a, b) => {
                const nameA = a.tray_name || a.name || a.id || '';
                const nameB = b.tray_name || b.name || b.id || '';
                return nameA.localeCompare(nameB);
            });

            // Add tray options
            sortedTrays.forEach(tray => {
                const option = document.createElement('option');
                option.value = tray.id;
                option.textContent = tray.tray_name || tray.name || tray.id;
                dropdown.appendChild(option);
            });

        } catch (error) {
            console.error('Error populating tray dropdown:', error);

            // Add error option
            dropdown.innerHTML = '<option value="">Select Tray...</option>';
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = 'Error loading trays';
            errorOption.disabled = true;
            dropdown.appendChild(errorOption);
        }
    }

    setupCaseTypeChangeWarning() {
        // Add a small delay to ensure DOM elements are ready
        setTimeout(() => {
            const addCaseTypeSelect = document.getElementById('addCaseCaseType');
            const editCaseTypeSelect = document.getElementById('editCaseType');

            console.log('🔧 Setting up case type change warnings...', {
                addCaseTypeSelect: !!addCaseTypeSelect,
                editCaseTypeSelect: !!editCaseTypeSelect,
                addValue: addCaseTypeSelect?.value,
                editValue: editCaseTypeSelect?.value
            });

        const handleCaseTypeChange = async (event, modal) => {
            const selectElement = event.target;
            const newCaseTypeId = selectElement.value;
            const previousCaseTypeId = selectElement.getAttribute('data-previous-value');

            // Skip if same value selected (no actual change)
            if (previousCaseTypeId === newCaseTypeId) {
                return;
            }

            // On initial load (no previous value), just store the value and refresh if needed
            if (!previousCaseTypeId) {
                selectElement.setAttribute('data-previous-value', newCaseTypeId);
                console.log(`🔄 Initial case type selected: "${this.getCaseTypeName(newCaseTypeId)}" - refreshing dropdowns`);
                // Still refresh existing dropdowns in case there are any
                await this.refreshTrayDropdowns(modal);

                // Auto-populate tray requirements for case type if no existing requirements
                if (newCaseTypeId) {
                    await this.autoPopulateTrayRequirementsForCaseType(modal, newCaseTypeId);
                }
                return;
            }

            // Check if there are existing tray requirements
            const trayRequirements = this.getTrayRequirementsFromUI(modal);
            const previousCaseTypeName = this.getCaseTypeName(previousCaseTypeId);
            const newCaseTypeName = this.getCaseTypeName(newCaseTypeId);

            // Show warning only if there are existing requirements
            if (trayRequirements.length > 0) {
                const warningMessage =
                    `⚠️ Changing the case type will affect tray compatibility!\n\n` +
                    `Current case type: "${previousCaseTypeName}"\n` +
                    `New case type: "${newCaseTypeName}"\n\n` +
                    `You currently have ${trayRequirements.length} tray requirement(s). ` +
                    `Some trays may no longer be compatible with the new case type and will be filtered out.\n\n` +
                    `Do you want to continue?`;

                if (!confirm(warningMessage)) {
                    // User cancelled - revert to previous value
                    selectElement.value = previousCaseTypeId;
                    return;
                }

                console.log(`🔄 Case type changed from "${previousCaseTypeName}" to "${newCaseTypeName}" with existing requirements - refreshing tray dropdowns`);
            } else {
                console.log(`🔄 Case type changed from "${previousCaseTypeName}" to "${newCaseTypeName}" - refreshing tray dropdowns for future requirements`);

                // Auto-populate tray requirements for case type since no existing requirements
                if (newCaseTypeId) {
                    await this.autoPopulateTrayRequirementsForCaseType(modal, newCaseTypeId);
                }
            }

            // Update the stored previous value
            selectElement.setAttribute('data-previous-value', newCaseTypeId);

            // ALWAYS refresh tray dropdowns to apply new compatibility filtering
            // This ensures that when users add new requirements, they only see compatible trays
            await this.refreshTrayDropdowns(modal);
        };

        // Add event listeners to both dropdowns
        if (addCaseTypeSelect) {
            // Remove any existing listeners first
            addCaseTypeSelect.removeEventListener('change', addCaseTypeSelect._caseTypeChangeHandler);

            // Create new handler and store reference for removal
            addCaseTypeSelect._caseTypeChangeHandler = (event) => handleCaseTypeChange(event, 'add');
            addCaseTypeSelect.addEventListener('change', addCaseTypeSelect._caseTypeChangeHandler);

            // Store initial value
            addCaseTypeSelect.setAttribute('data-previous-value', addCaseTypeSelect.value || '');
        }

        if (editCaseTypeSelect) {
            // Remove any existing listeners first
            editCaseTypeSelect.removeEventListener('change', editCaseTypeSelect._caseTypeChangeHandler);

            // Create new handler and store reference for removal
            editCaseTypeSelect._caseTypeChangeHandler = (event) => handleCaseTypeChange(event, 'edit');
            editCaseTypeSelect.addEventListener('change', editCaseTypeSelect._caseTypeChangeHandler);

            // Store initial value
            editCaseTypeSelect.setAttribute('data-previous-value', editCaseTypeSelect.value || '');
        }

            console.log('✅ Case type change warning listeners setup complete');
        }, 100); // Small delay to ensure DOM is ready
    }

    getCaseTypeName(caseTypeId) {
        if (!caseTypeId) return 'None';

        const caseTypes = this.dataManager.getCaseTypes();
        const caseType = caseTypes.find(ct => ct.id === caseTypeId);
        return caseType?.name || `Unknown (${caseTypeId})`;
    }

    populatePreferredFacilitiesDropdown(selectedFacilities = []) {
        const dropdown = document.getElementById('editPhysicianPreferredFacilities');
        if (!dropdown) return;

        // Clear existing options
        dropdown.innerHTML = '';

        // Get facilities from FacilityManager
        if (window.app?.facilityManager?.currentFacilities) {
            const facilities = window.app.facilityManager.currentFacilities
                .filter(facility => facility.active !== false)
                .sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));

            facilities.forEach(facility => {
                const option = document.createElement('option');
                option.value = facility.id;
                option.textContent = facility.account_name || `Facility ${facility.id}`;

                // Select if this facility is in the preferred list
                if (selectedFacilities.includes(facility.id)) {
                    option.selected = true;
                }

                dropdown.appendChild(option);
            });
        } else {
            // Fallback if no facilities available
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No facilities available';
            option.disabled = true;
            dropdown.appendChild(option);
        }
    }

    // Method to refresh physician dropdowns if they failed to load initially
    async refreshPhysicianDropdowns() {
        const surgeonSelect = document.getElementById('addCasePhysician');
        const editSurgeonSelect = document.getElementById('editCasePhysician');

        if (surgeonSelect || editSurgeonSelect) {
            // Ensure surgeons are loaded before trying to refresh
            const surgeons = await this.dataManager.ensureSurgeonsLoaded();

            if (surgeons && surgeons.length > 0) {
                const validSurgeons = surgeons.filter(surgeon => surgeon && surgeon.id && surgeon.full_name);
                const surgeonOptions = '<option value="">Select Physician</option>' +
                    validSurgeons.map(surgeon => `<option value="${surgeon.id}">${surgeon.full_name}</option>`).join('');

                if (surgeonSelect) {
                    surgeonSelect.innerHTML = surgeonOptions;
                }
                if (editSurgeonSelect) {
                    editSurgeonSelect.innerHTML = surgeonOptions;

                    // Check for pending value to set after refresh
                    const pendingValue = editSurgeonSelect.getAttribute('data-pending-value');
                    if (pendingValue) {
                        editSurgeonSelect.value = pendingValue;
                        editSurgeonSelect.removeAttribute('data-pending-value');
                        console.log(`✅ Set pending physician value after refresh: ${pendingValue}`);

                        // Trigger change event to handle case type auto-selection and facility reordering
                        const changeEvent = new Event('change', { bubbles: true });
                        editSurgeonSelect.dispatchEvent(changeEvent);
                    }
                }

                // Re-setup event handlers after refresh
                this.setupPhysicianChangeHandlers();
            } else {
                console.warn('⚠️ Still no surgeons available for refresh');
            }
        }
    }

    setupPhysicianChangeHandlers() {
        const addPhysicianSelect = document.getElementById('addCasePhysician');
        const editPhysicianSelect = document.getElementById('editCasePhysician');

        // Remove existing listeners to prevent duplicates
        if (addPhysicianSelect) {
            const newAddPhysicianSelect = addPhysicianSelect.cloneNode(true);
            addPhysicianSelect.parentNode.replaceChild(newAddPhysicianSelect, addPhysicianSelect);
            newAddPhysicianSelect.addEventListener('change', (e) => this.handlePhysicianChange(e, 'add'));
        }

        if (editPhysicianSelect) {
            const newEditPhysicianSelect = editPhysicianSelect.cloneNode(true);
            editPhysicianSelect.parentNode.replaceChild(newEditPhysicianSelect, editPhysicianSelect);
            newEditPhysicianSelect.addEventListener('change', (e) => this.handlePhysicianChange(e, 'edit'));
        }
    }

    async handlePhysicianChange(event, modalType) {
        const physicianId = event.target.value;
        console.log(`👨‍⚕️ Physician changed: ${physicianId} in ${modalType} modal`);

        if (!physicianId) return;

        // Get physician data
        const physicians = this.dataManager.getSurgeons();
        const selectedPhysician = physicians.find(p => p.id === physicianId);

        if (selectedPhysician) {
            // Auto-select case type if physician has last_case_type_id and current case type is empty
            const caseTypeSelectId = modalType === 'add' ? 'addCaseCaseType' : 'editCaseType';
            const caseTypeSelect = document.getElementById(caseTypeSelectId);

            if (caseTypeSelect && !caseTypeSelect.value && selectedPhysician.last_case_type_id) {
                caseTypeSelect.value = selectedPhysician.last_case_type_id;
                console.log(`🎯 Auto-selected case type: ${selectedPhysician.last_case_type_id}`);
            }

            // Reorder facility dropdown to show preferred facilities first
            await this.reorderFacilityDropdown(modalType, selectedPhysician.preferred_facilities || []);

            // Auto-populate tray requirements if case type is valid and no existing requirements
            const currentCaseType = caseTypeSelect?.value;
            if (currentCaseType && physicianId) {
                await this.autoPopulateTrayRequirementsForPhysician(modalType, physicianId, currentCaseType);
            }
        }
    }

    async reorderFacilityDropdown(modalType, preferredFacilityIds) {
        const facilitySelectId = modalType === 'add' ? 'addCaseFacility' : 'editCaseFacility';
        const facilitySelect = document.getElementById(facilitySelectId);

        if (!facilitySelect) return;

        // Store the current selected value to maintain it
        const currentValue = facilitySelect.value;

        // Get all facilities
        const facilities = window.app?.facilityManager?.currentFacilities;
        if (!facilities || facilities.length === 0) return;

        const activeFacilities = facilities.filter(facility => facility.active !== false);

        // Separate preferred and non-preferred facilities
        const preferredFacilities = [];
        const otherFacilities = [];

        activeFacilities.forEach(facility => {
            if (preferredFacilityIds.includes(facility.id)) {
                preferredFacilities.push(facility);
            } else {
                otherFacilities.push(facility);
            }
        });

        // Sort both groups alphabetically
        preferredFacilities.sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));
        otherFacilities.sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));

        // Build the options HTML
        let facilityOptions = '<option value="">Select Facility</option>';

        // Add preferred facilities with asterisk
        preferredFacilities.forEach(facility => {
            facilityOptions += `<option value="${facility.id}">* ${facility.account_name || `Facility ${facility.id}`}</option>`;
        });

        // Add other facilities
        otherFacilities.forEach(facility => {
            facilityOptions += `<option value="${facility.id}">${facility.account_name || `Facility ${facility.id}`}</option>`;
        });

        // Update the dropdown
        facilitySelect.innerHTML = facilityOptions;

        // Restore the selected value
        if (currentValue) {
            facilitySelect.value = currentValue;
        }

        console.log(`🏥 Reordered facilities: ${preferredFacilities.length} preferred, ${otherFacilities.length} others`);
    }

    async autoPopulateTrayRequirementsForPhysician(modalType, physicianId, caseTypeId) {
        try {
            // Check if tray requirements already exist
            const currentTrayRequirements = this.getTrayRequirementsFromUI(modalType);
            if (currentTrayRequirements.length > 0) {
                console.log('🚫 Tray requirements already exist, skipping auto-population');
                return;
            }

            // Get physician preferences for this case type
            const physicianPreferences = await this.getPhysicianTrayPreferences(physicianId, caseTypeId);

            if (physicianPreferences.length > 0) {
                console.log(`🧑‍⚕️ Auto-populating ${physicianPreferences.length} tray requirements from physician preferences`);
                await this.populateTrayRequirementsFromPreferences(modalType, physicianPreferences);
            } else {
                console.log('ℹ️ No physician preferences found, physician tray requirements not auto-populated');
            }
        } catch (error) {
            console.error('Error auto-populating tray requirements for physician:', error);
        }
    }

    async getPhysicianTrayPreferences(physicianId, caseTypeId) {
        try {
            // Query physician_preferences collection
            const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');

            const q = query(
                collection(this.dataManager.db, 'physician_preferences'),
                where('physician_id', '==', physicianId),
                where('case_type', '==', caseTypeId)
            );

            const querySnapshot = await getDocs(q);
            const preferences = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                preferences.push({
                    tray_id: data.tray_id,
                    requirement_type: data.requirement_type || 'required',
                    quantity: data.quantity || 1,
                    priority: data.priority || 1
                });
            });

            return preferences;
        } catch (error) {
            console.error('Error fetching physician tray preferences:', error);
            return [];
        }
    }

    async populateTrayRequirementsFromPreferences(modalType, preferences) {
        try {
            const container = document.querySelector(`[data-modal="${modalType}"].tray-requirements-list`);
            if (!container) {
                console.error('Tray requirements container not found');
                return;
            }

            // Add tray requirements based on preferences
            for (const preference of preferences) {
                const button = container.parentElement.querySelector('.btn-primary');
                if (button) {
                    await this.addTrayRequirement(button);

                    // Set the tray selection and other values
                    const lastRequirement = container.lastElementChild;
                    if (lastRequirement) {
                        const traySelect = lastRequirement.querySelector('.tray-select');
                        const requirementType = lastRequirement.querySelector('.requirement-type');
                        const quantity = lastRequirement.querySelector('.quantity');
                        const priority = lastRequirement.querySelector('.priority');

                        if (traySelect) traySelect.value = preference.tray_id;
                        if (requirementType) requirementType.value = preference.requirement_type;
                        if (quantity) quantity.value = preference.quantity;
                        if (priority) priority.value = preference.priority;
                    }
                }
            }
        } catch (error) {
            console.error('Error populating tray requirements from preferences:', error);
        }
    }

    async autoPopulateTrayRequirementsForCaseType(modalType, caseTypeId) {
        try {
            // Check if tray requirements already exist
            const currentTrayRequirements = this.getTrayRequirementsFromUI(modalType);
            if (currentTrayRequirements.length > 0) {
                console.log('🚫 Tray requirements already exist, skipping case type auto-population');
                return;
            }

            // Get case type name
            const caseTypes = this.dataManager.getCaseTypes();
            const caseType = caseTypes.find(ct => ct.id === caseTypeId);
            const caseTypeName = caseType?.name;

            if (!caseTypeName) {
                console.log('⚠️ Case type name not found, skipping case type auto-population');
                return;
            }

            // Get tray requirements for this case type (passing both ID and name for better matching)
            const caseTypeTrayRequirements = await this.getCaseTypeTrayRequirements(caseTypeName, caseTypeId);

            if (caseTypeTrayRequirements.length > 0) {
                console.log(`📋 Auto-populating ${caseTypeTrayRequirements.length} tray requirements from case type`);
                await this.populateTrayRequirementsFromPreferences(modalType, caseTypeTrayRequirements);
            } else {
                console.log('ℹ️ No case type tray requirements found, case type auto-population skipped');
            }
        } catch (error) {
            console.error('Error auto-populating tray requirements for case type:', error);
        }
    }

    async getCaseTypeTrayRequirements(caseTypeName, caseTypeId = null) {
        try {
            // Use the central function from DataManager
            const rawRequirements = await window.app.dataManager.getTrayRequirementsByCaseType(caseTypeId, caseTypeName);

            // Transform to the expected format for this function
            const requirements = rawRequirements.map(data => ({
                tray_id: data.tray_id,
                requirement_type: data.requirement_type || 'required',
                quantity: data.quantity || 1,
                priority: data.priority || 1
            }));

            return requirements;
        } catch (error) {
            console.error('Error fetching case type tray requirements:', error);
            return [];
        }
    }

    populatePhysicianCaseTypesDropdown(selectedCaseTypeId = null) {
        const dropdown = document.getElementById('editPhysicianLastCaseType');
        if (!dropdown) return;

        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select Case Type...</option>';

        // Get case types from DataManager
        if (window.app?.dataManager?.caseTypes) {
            const caseTypes = window.app.dataManager.caseTypes
                .filter(caseType => caseType.active !== false)
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            caseTypes.forEach(caseType => {
                const option = document.createElement('option');
                option.value = caseType.id;
                option.textContent = caseType.name || `Case Type ${caseType.id}`;

                // Select if this is the last case type
                if (selectedCaseTypeId && caseType.id === selectedCaseTypeId) {
                    option.selected = true;
                }

                dropdown.appendChild(option);
            });
        } else {
            // Fallback if no case types available
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No case types available';
            option.disabled = true;
            dropdown.appendChild(option);
        }
    }

    // Implant Type Modal Methods
    showAddImplantTypeModal() {
        // Clear form
        const form = document.getElementById('addImplantTypeForm');
        if (form) form.reset();

        const modal = new bootstrap.Modal(document.getElementById('addImplantTypeModal'));
        modal.show();
    }

    async showEditImplantTypeModal(implantTypeId) {
        try {
            const implantType = window.app.implantTypeManager?.getImplantTypeById(implantTypeId);

            if (!implantType) {
                this.showErrorNotification('Implant type not found');
                return;
            }

            // Populate form fields
            document.getElementById('editImplantTypeId').value = implantTypeId;
            document.getElementById('editImplantTypeName').value = implantType.name || '';
            document.getElementById('editImplantTypeDescription').value = implantType.description || '';
            document.getElementById('editImplantTypeStatus').value = implantType.status || 'active';

            const modal = new bootstrap.Modal(document.getElementById('editImplantTypeModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing edit implant type modal:', error);
            this.showErrorNotification('Error loading implant type data: ' + error.message);
        }
    }

    getImplantTypeFormData(isEdit = false) {
        const prefix = isEdit ? 'editImplantType' : 'implantType';

        return {
            name: document.getElementById(`${prefix}Name`).value,
            description: document.getElementById(`${prefix}Description`).value,
            status: document.getElementById(`${prefix}Status`).value
        };
    }

    async handleImplantTypeUpdate() {
        try {
            const implantTypeId = document.getElementById('editImplantTypeId').value;
            const implantTypeData = this.getImplantTypeFormData(true);

            console.log('Handling implant type update:', { implantTypeId, implantTypeData });

            await window.app.implantTypeManager.updateImplantType(implantTypeId, implantTypeData);
        } catch (error) {
            console.error('Error in handleImplantTypeUpdate:', error);
        }
    }
}