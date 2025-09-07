// js/SurgeonManager.js - Surgeon Management for Tray Tracker
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class SurgeonManager {
    constructor(db) {
        this.db = db;
        this.currentSurgeons = [];
        this.viewMode = this.getStoredViewMode();
        this.surgeonsUnsubscribe = null;
        
        // Initialize PhysicianPreferenceService for managing tray preferences
        // Note: Using direct Firestore operations due to CommonJS/ES6 module compatibility issues
        this.physicianPreferenceService = null;
        
        // Storage for current surgeon's preferences during editing
        this.currentSurgeonPreferences = [];
        
        // Store collection name for consistent usage
        this.collectionName = 'physicians'; // Will be updated by determineCollectionName
        
        // Log initialization immediately
        this.logToAPI('SurgeonManager initialized', { 
            timestamp: new Date().toISOString(),
            hasDb: !!db
        }, 'surgeon-init');
    }

    async initializePreferenceService() {
        try {
            console.log('Attempting to initialize PhysicianPreferenceService...');
            const { PhysicianPreferenceService } = await import('../shared_backend/services/PhysicianPreferenceService.js');
            console.log('PhysicianPreferenceService imported successfully:', PhysicianPreferenceService);
            this.physicianPreferenceService = new PhysicianPreferenceService(this.db);
            console.log('PhysicianPreferenceService initialized successfully:', this.physicianPreferenceService);
        } catch (error) {
            console.error('Error initializing PhysicianPreferenceService:', error);
            console.error('Error stack:', error.stack);
        }
    }

    getStoredViewMode() {
        return localStorage.getItem('surgeonViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('surgeonViewMode', mode);

        const cardBtn = document.getElementById('surgeonCardViewBtn');
        const listBtn = document.getElementById('surgeonListViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        const cardView = document.getElementById('surgeonCardView');
        const listView = document.getElementById('surgeonListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        this.renderSurgeons(this.currentSurgeons);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        this.setupRealtimeListeners();
        this.showLoadingState();
    }

    showLoadingState() {
        const surgeonCardView = document.getElementById('surgeonCardView');
        const surgeonListView = document.getElementById('surgeonListView');

        if (surgeonCardView) {
            surgeonCardView.innerHTML = `
                <div class="loading-state">
                    <div class="spinner-border" role="status"></div>
                    <p class="mt-2">Loading surgeons...</p>
                </div>
            `;
        }

        if (surgeonListView) {
            const surgeonHorizontalCards = document.getElementById('surgeonHorizontalCards');
            if (surgeonHorizontalCards) {
                surgeonHorizontalCards.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner-border" role="status"></div>
                        <p class="mt-2">Loading surgeons...</p>
                    </div>
                `;
            }
        }
    }

    async determineCollectionName() {
        try {
            // First try physicians collection
            const physiciansSnapshot = await getDocs(collection(this.db, 'physicians'));
            if (physiciansSnapshot.size > 0) {
                console.log('Using physicians collection');
                return 'physicians';
            }
            
            // Fallback to surgeons collection
            console.log('Physicians collection empty, using surgeons collection');
            return 'surgeons';
        } catch (error) {
            console.error('Error determining collection name:', error);
            return 'surgeons'; // Default fallback
        }
    }

    setupRealtimeListeners() {
        console.log('Setting up realtime listeners for physicians...');
        
        if (!this.db) {
            console.error('Database not initialized in SurgeonManager');
            this.handleSurgeonsUpdate([]);
            return;
        }

        try {
            console.log('Creating physicians query...');
            // Check if physicians collection exists, fallback to surgeons
            this.collectionName = await this.determineCollectionName();
            const surgeonsQuery = query(collection(this.db, this.collectionName), orderBy('createdAt', 'desc'));
            
            console.log('Setting up onSnapshot listener...');
            this.surgeonsUnsubscribe = onSnapshot(surgeonsQuery, (snapshot) => {
                console.log('Received snapshot update, document count:', snapshot.size);
                const surgeons = [];
                snapshot.forEach((doc) => {
                    surgeons.push({ id: doc.id, ...doc.data() });
                });

                this.handleSurgeonsUpdate(surgeons);
            }, (error) => {
                console.error('Error listening to surgeons:', error);
                this.showErrorNotification('Error loading physicians: ' + error.message);
                this.handleSurgeonsUpdate([]);
            });
            
            console.log('Realtime listener setup complete');
        } catch (error) {
            console.error('Error setting up surgeons listener:', error);
            this.handleSurgeonsUpdate([]);
        }
    }

    async addSurgeon() {
        try {

            // Preferred cases functionality removed - set to empty string
            const preferredCasesString = '';

            const surgeon = {
                name: document.getElementById('surgeonName').value,
                title: document.getElementById('surgeonTitle').value,
                specialty: document.getElementById('surgeonSpecialty').value,
                hospital: document.getElementById('surgeonHospital').value,
                email: document.getElementById('surgeonEmail').value,
                phone: document.getElementById('surgeonPhone').value,
                preferredCases: preferredCasesString,
                notes: document.getElementById('surgeonNotes').value,
                active: document.getElementById('surgeonActive').checked,
                createdAt: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid,
                isDemoSurgeon: false
            };

            await addDoc(collection(this.db, this.collectionName), surgeon);

            bootstrap.Modal.getInstance(document.getElementById('addSurgeonModal')).hide();
            document.getElementById('addSurgeonForm').reset();

            this.showSuccessNotification('Surgeon added successfully!');
        } catch (error) {
            console.error('Error adding surgeon:', error);
            this.showErrorNotification('Error adding surgeon: ' + error.message);
        }
    }

    async updateSurgeon() {
        try {
            const surgeonId = document.getElementById('editSurgeonId').value;

            // Preferred cases functionality removed - set to empty string
            const preferredCasesString = '';

            const updates = {
                name: document.getElementById('editSurgeonName').value,
                title: document.getElementById('editSurgeonTitle').value,
                specialty: document.getElementById('editSurgeonSpecialty').value,
                hospital: document.getElementById('editSurgeonHospital').value,
                email: document.getElementById('editSurgeonEmail').value,
                phone: document.getElementById('editSurgeonPhone').value,
                preferredCases: preferredCasesString,
                notes: document.getElementById('editSurgeonNotes').value,
                active: document.getElementById('editSurgeonActive').checked,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'physicians', surgeonId), updates);

            bootstrap.Modal.getInstance(document.getElementById('editSurgeonModal')).hide();
            this.showSuccessNotification('Surgeon updated successfully!');
        } catch (error) {
            console.error('Error updating surgeon:', error);
            this.showErrorNotification('Error updating surgeon: ' + error.message);
        }
    }

    async deleteSurgeon(surgeonId, surgeonName) {
        if (!confirm(`Are you sure you want to delete surgeon "${surgeonName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(this.db, this.collectionName, surgeonId));
            this.showSuccessNotification('Surgeon deleted successfully!');
        } catch (error) {
            console.error('Error deleting surgeon:', error);
            this.showErrorNotification('Error deleting surgeon: ' + error.message);
        }
    }

    handleSurgeonsUpdate(surgeons) {
        console.log('SurgeonManager received surgeons update:', surgeons.length);
        console.log('Surgeons data:', surgeons);
        this.currentSurgeons = surgeons;
        
        try {
            this.renderSurgeons(surgeons);
            console.log('Successfully rendered surgeons');
        } catch (error) {
            console.error('Error rendering surgeons:', error);
        }
        
        try {
            this.updateStats(surgeons);
            console.log('Successfully updated stats');
        } catch (error) {
            console.error('Error updating stats:', error);
        }

        // Update DataManager with surgeon names for dropdowns
        if (window.app.dataManager) {
            const surgeonNames = surgeons
                .filter(surgeon => surgeon.active)
                .map(surgeon => surgeon.name);
            window.app.dataManager.surgeons = surgeonNames;
        }

        // If case types are not loaded yet, schedule a re-render when they are
        if (window.app.dataManager && (!window.app.dataManager.caseTypes || window.app.dataManager.caseTypes.length === 0)) {
            this.scheduleCaseTypesUpdate();
        }
    }

    getSurgeonPreferredCasesText(preferredCases) {
        if (!preferredCases) return 'Any';

        // If it's comma-separated IDs
        if (preferredCases.includes(',') || preferredCases.length > 15) {
            const caseTypeIds = preferredCases.split(',').map(id => id.trim());
            const caseTypeNames = [];

            if (window.app.dataManager && window.app.dataManager.caseTypes) {
                caseTypeIds.forEach(id => {
                    const caseType = window.app.dataManager.caseTypes.find(ct => ct.id === id);
                    if (caseType) {
                        caseTypeNames.push(caseType.name);
                    }
                });
            }

            return caseTypeNames.length > 0 ? caseTypeNames.join(', ') : 'Unknown case types';
        }

        // Legacy text format
        return preferredCases;
    }

    renderSurgeons(surgeons) {
        if (this.viewMode === 'card') {
            this.renderCardView(surgeons);
        } else {
            this.renderListView(surgeons);
        }
    }

    renderCardView(surgeons) {
        const surgeonCardView = document.getElementById('surgeonCardView');
        if (!surgeonCardView) return;

        if (surgeons.length === 0) {
            surgeonCardView.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-user-md fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No surgeons found. Add a new surgeon to get started.</p>
                </div>
            `;
            return;
        }

        surgeonCardView.innerHTML = '';
        surgeons.forEach(surgeon => {
            const surgeonCard = this.createSurgeonCard(surgeon);
            surgeonCardView.appendChild(surgeonCard);
        });
    }

    renderListView(surgeons) {
        const surgeonHorizontalCards = document.getElementById('surgeonHorizontalCards');
        if (!surgeonHorizontalCards) return;

        if (surgeons.length === 0) {
            surgeonHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-user-md fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No surgeons found. Add a new surgeon to get started.</p>
                </div>
            `;
            return;
        }

        surgeonHorizontalCards.innerHTML = '';
        surgeons.forEach(surgeon => {
            const surgeonCard = this.createHorizontalSurgeonCard(surgeon);
            surgeonHorizontalCards.appendChild(surgeonCard);
        });
    }

    createSurgeonCard(surgeon) {
        const card = document.createElement('div');
        card.className = 'surgeon-card';

        const specialtyIcon = this.getSpecialtyIcon(surgeon.specialty);
        const statusText = surgeon.active ? 'Active' : 'Inactive';
        const statusClass = surgeon.active ? 'status-available' : 'status-in-use';

        card.innerHTML = `
        <div class="surgeon-card-header">
            <div class="surgeon-card-title">
                <div class="surgeon-specialty-icon">
                    <i class="${specialtyIcon}"></i>
                </div>
                ${surgeon.title || 'Dr.'} ${surgeon.name}
            </div>
            <span class="tray-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="surgeon-card-content">
            <div class="surgeon-detail">
                <i class="fas fa-stethoscope"></i>
                <span class="surgeon-detail-value">${surgeon.specialty || 'General'}</span>
            </div>
            <div class="surgeon-detail">
                <i class="fas fa-hospital"></i>
                <span class="surgeon-detail-value">${surgeon.hospital || 'Not specified'}</span>
            </div>
            ${surgeon.email ? `
                <div class="surgeon-detail">
                    <i class="fas fa-envelope"></i>
                    <span class="surgeon-detail-value">${surgeon.email}</span>
                </div>
            ` : `
                <div class="surgeon-detail">
                    <i class="fas fa-envelope"></i>
                    <span class="surgeon-detail-empty">No email</span>
                </div>
            `}
            ${surgeon.phone ? `
                <div class="surgeon-detail">
                    <i class="fas fa-phone"></i>
                    <span class="surgeon-detail-value">${surgeon.phone}</span>
                </div>
            ` : `
                <div class="surgeon-detail">
                    <i class="fas fa-phone"></i>
                    <span class="surgeon-detail-empty">No phone</span>
                </div>
            `}
            ${surgeon.preferredCases ? `
                <div class="surgeon-detail">
                    <i class="fas fa-clipboard-list"></i>
                    <span class="surgeon-detail-value">${this.getSurgeonPreferredCasesText(surgeon.preferredCases)}</span>
                </div>
            ` : `
                <div class="surgeon-detail">
                    <i class="fas fa-clipboard-list"></i>
                    <span class="surgeon-detail-empty">Any case type</span>
                </div>
            `}
        </div>
        <div class="surgeon-card-actions">
            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditSurgeonModal('${surgeon.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-danger-custom btn-sm" onclick="app.surgeonManager.deleteSurgeon('${surgeon.id}', '${surgeon.name}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;

        return card;
    }

    createHorizontalSurgeonCard(surgeon) {
        const card = document.createElement('div');
        card.className = 'surgeon-horizontal-card';

        const statusText = surgeon.active ? 'Active' : 'Inactive';
        const statusClass = surgeon.active ? 'status-available' : 'status-in-use';
        const specialtyIcon = this.getSpecialtyIcon(surgeon.specialty);

        card.innerHTML = `
        <div class="surgeon-horizontal-header">
            <div class="surgeon-horizontal-title">
                <div class="surgeon-specialty-icon">
                    <i class="${specialtyIcon}"></i>
                </div>
                <div>
                    <h6>${surgeon.title || 'Dr.'} ${surgeon.name}</h6>
                    <small class="text-muted">${surgeon.specialty || 'General'}</small>
                </div>
            </div>
            <div class="surgeon-horizontal-status">
                <span class="tray-status-badge ${statusClass}">${statusText}</span>
            </div>
        </div>
        
        <div class="surgeon-horizontal-body">
            <div class="surgeon-horizontal-field">
                <label>Hospital</label>
                <span>${surgeon.hospital || 'Not specified'}</span>
            </div>
            <div class="surgeon-horizontal-field">
                <label>Email</label>
                <span class="${!surgeon.email ? 'empty-value' : ''}">${surgeon.email || 'Not provided'}</span>
            </div>
            <div class="surgeon-horizontal-field">
                <label>Phone</label>
                <span class="${!surgeon.phone ? 'empty-value' : ''}">${surgeon.phone || 'Not provided'}</span>
            </div>
            <div class="surgeon-horizontal-field">
                <label>Preferred Cases</label>
                <span class="${!surgeon.preferredCases ? 'empty-value' : ''}" title="${this.getSurgeonPreferredCasesText(surgeon.preferredCases)}">${this.getSurgeonPreferredCasesText(surgeon.preferredCases)}</span>
            </div>
        </div>
        
        <div class="surgeon-horizontal-actions">
            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditSurgeonModal('${surgeon.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-danger-custom btn-sm" onclick="app.surgeonManager.deleteSurgeon('${surgeon.id}', '${surgeon.name}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;

        return card;
    }

    scheduleCaseTypesUpdate() {
        if (!this.caseTypesUpdateScheduled) {
            this.caseTypesUpdateScheduled = true;
            let attempts = 0;
            const maxAttempts = 10;

            const checkForCaseTypes = () => {
                attempts++;
                if (window.app.dataManager && window.app.dataManager.caseTypes && window.app.dataManager.caseTypes.length > 0) {
                    console.log('Case types loaded, re-rendering surgeons...');
                    this.caseTypesUpdateScheduled = false;
                    this.renderSurgeons(this.currentSurgeons);
                } else if (attempts < maxAttempts) {
                    setTimeout(checkForCaseTypes, 1000);
                } else {
                    console.log('Timeout waiting for case types, rendering surgeons without them');
                    this.caseTypesUpdateScheduled = false;
                    this.renderSurgeons(this.currentSurgeons);
                }
            };

            setTimeout(checkForCaseTypes, 1000);
        }
    }


    getSpecialtyIcon(specialty) {
        const specialtyIcons = {
            'Orthopedic': 'fas fa-bone',
            'Neurosurgery': 'fas fa-brain',
            'Spine': 'fas fa-user-injured',
            'Sports Medicine': 'fas fa-running',
            'General': 'fas fa-user-md',
            'Minimally Invasive': 'fas fa-microscope'
        };
        return specialtyIcons[specialty] || 'fas fa-stethoscope';
    }

    updateStats(surgeons) {
        const stats = {
            total: surgeons.length,
            active: surgeons.filter(s => s.active).length,
            orthopedic: surgeons.filter(s => s.specialty === 'Orthopedic' || s.specialty === 'Spine').length,
            general: surgeons.filter(s => !s.specialty || s.specialty === 'General').length
        };

        const totalElement = document.getElementById('totalSurgeonsCount');
        const activeElement = document.getElementById('activeSurgeonsCount');
        const orthopedicElement = document.getElementById('orthopedicSurgeonsCount');
        const generalElement = document.getElementById('generalSurgeonsCount');

        if (totalElement) totalElement.textContent = stats.total;
        if (activeElement) activeElement.textContent = stats.active;
        if (orthopedicElement) orthopedicElement.textContent = stats.orthopedic;
        if (generalElement) generalElement.textContent = stats.general;
    }

    showSuccessNotification(message) {
        this.showNotification(message, 'success');
    }

    showErrorNotification(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
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

    // Tray Preferences Management Methods
    async loadSurgeonTrayPreferences(surgeonId) {
        console.log('loadSurgeonTrayPreferences called with surgeonId:', surgeonId);
        try {
            if (!surgeonId) {
                console.log('No surgeonId provided');
                this.currentSurgeonPreferences = [];
                await this.renderTrayPreferencesAccordion();
                await this.populateCaseTypeDropdown();
                return;
            }

            // Use direct Firestore operations (bypassing service due to module compatibility issues)
            console.log('Using direct Firestore operations for preferences');
            await this.loadSurgeonTrayPreferencesDirectly(surgeonId);
            
            // Check if tray ID dropdown exists before populating case types
            const trayDropdown = document.getElementById('surgeonPreferenceTrayIdDropdown');
            console.log('🔥 INITIAL CHECK: Tray ID dropdown exists on modal load:', !!trayDropdown);
            console.log('🔥 INITIAL CHECK: Tray ID dropdown element:', trayDropdown);
            
            // Populate case type dropdown and render preferences
            await this.renderTrayPreferencesAccordion();
            await this.populateCaseTypeDropdown();
            
            // Also populate tray dropdown with all trays initially
            await this.logToAPI('Initial tray dropdown population in loadSurgeonTrayPreferences');
            await this.populateTrayIdDropdown();
        } catch (error) {
            console.error('Error loading surgeon tray preferences:', error);
            this.currentSurgeonPreferences = [];
            
            // Still populate case type dropdown on error
            await this.renderTrayPreferencesAccordion();
            await this.populateCaseTypeDropdown();
            
            // Also populate tray dropdown even on error
            await this.logToAPI('Error case: Initial tray dropdown population in loadSurgeonTrayPreferences');
            await this.populateTrayIdDropdown();
        }
    }

    async renderTrayPreferencesAccordion() {
        const accordion = document.getElementById('surgeonTrayPreferencesAccordion');
        if (!accordion) return;

        // Group preferences by case type
        const groupedPrefs = {};
        this.currentSurgeonPreferences.forEach(pref => {
            if (!groupedPrefs[pref.case_type]) {
                groupedPrefs[pref.case_type] = [];
            }
            groupedPrefs[pref.case_type].push(pref);
        });

        if (Object.keys(groupedPrefs).length === 0) {
            accordion.innerHTML = '<p class="text-muted">No tray preferences set for this surgeon.</p>';
            return;
        }

        // Get all trays to resolve names
        const allTrays = await this.getAllTrays();
        const trayMap = {};
        allTrays.forEach(tray => {
            trayMap[tray.id] = tray.tray_name || tray.name || tray.id;
        });

        let html = '';
        Object.entries(groupedPrefs).forEach(([caseType, prefs], index) => {
            const accordionId = `preference-${index}`;
            const isFirst = index === 0;
            
            html += `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${isFirst ? '' : 'collapsed'}" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#${accordionId}">
                            ${caseType} <span class="badge bg-secondary ms-2">${prefs.length} preferences</span>
                        </button>
                    </h2>
                    <div id="${accordionId}" class="accordion-collapse collapse ${isFirst ? 'show' : ''}" 
                         data-bs-parent="#surgeonTrayPreferencesAccordion">
                        <div class="accordion-body">
                            ${prefs.map(pref => {
                                const trayName = trayMap[pref.tray_id] || pref.tray_name || pref.tray_id;
                                const requirementBadgeClass = pref.requirement_type === 'required' ? 'danger' : 
                                                              pref.requirement_type === 'preferred' ? 'warning' : 'secondary';
                                return `
                                <div class="preference-item p-2 mb-2 bg-light border rounded" data-pref-id="${pref.id}">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <strong>${trayName}</strong>
                                            <span class="badge bg-${requirementBadgeClass} ms-2">
                                                ${pref.requirement_type}
                                            </span>
                                            <span class="badge bg-info text-dark ms-2">
                                                Qty: ${pref.quantity || 1}
                                            </span>
                                            ${pref.notes ? `<br><small class="text-muted">${pref.notes}</small>` : ''}
                                        </div>
                                        <div class="btn-group btn-group-sm">
                                            <button type="button" class="btn btn-outline-danger" 
                                                    onclick="app.surgeonManager.removeTrayPreference('${pref.id}')">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        accordion.innerHTML = html;
    }

    async populateCaseTypeDropdown() {
        const dropdown = document.getElementById('surgeonPrefCaseType');
        console.log('populateCaseTypeDropdown called, dropdown element:', dropdown);
        
        if (!dropdown) {
            console.error('surgeonPrefCaseType dropdown not found in DOM');
            return;
        }

        dropdown.innerHTML = '<option value="">Loading...</option>';

        try {
            // Debug logging
            console.log('window.app:', window.app);
            console.log('window.app.dataManager:', window.app?.dataManager);
            console.log('window.app.dataManager.caseTypes:', window.app?.dataManager?.caseTypes);

            // Ensure case types are loaded
            let caseTypes = [];
            if (window.app.dataManager && window.app.dataManager.caseTypes) {
                caseTypes = window.app.dataManager.caseTypes;
                console.log('Using cached case types:', caseTypes);
            } else if (window.app.dataManager) {
                console.log('Loading case types from dataManager...');
                caseTypes = await window.app.dataManager.getAllCaseTypes();
                console.log('Loaded case types:', caseTypes);
            }

            // If still no case types, use hardcoded MyRepData case type names as fallback
            if (!caseTypes || caseTypes.length === 0) {
                console.log('Using hardcoded case type names as fallback');
                const hardcodedCaseTypes = [
                    'SI fusion – lateral',
                    'SI fusion – Intra–articular', 
                    'Spine fusion – Short Construct',
                    'Spine fusion – Long Construct',
                    'Revision Surgery – Spine fusion',
                    'Revision Surgery – SI fusion',
                    'Minimally Invasive Spine fusion'
                ];
                caseTypes = hardcodedCaseTypes.map(name => ({ name: name, active: true }));
            }

            dropdown.innerHTML = '<option value="">Select Case Type...</option>';
            
            if (caseTypes && caseTypes.length > 0) {
                const activeCaseTypes = caseTypes.filter(caseType => caseType.active !== false);
                console.log('Active case types:', activeCaseTypes);
                
                activeCaseTypes
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach(caseType => {
                        dropdown.innerHTML += `<option value="${caseType.name}">${caseType.name}</option>`;
                    });
                console.log('Populated dropdown with', activeCaseTypes.length, 'case types');
            } else {
                console.log('No case types available');
                dropdown.innerHTML = '<option value="">No case types available</option>';
            }

            // Add event listener for case type selection change
            console.log('Adding event listener to case type dropdown:', dropdown);
            
            // Remove any existing listeners first
            dropdown.onchange = null;
            
            // Add the event listener using arrow function to preserve 'this' context
            dropdown.addEventListener('change', async (event) => {
                console.log('CHANGE EVENT TRIGGERED! Event:', event);
                console.log('Selected value:', event.target.value);
                await this.logToAPI('CHANGE EVENT TRIGGERED', { 
                    selectedValue: event.target.value,
                    dropdownId: event.target.id,
                    timestamp: new Date().toISOString()
                }, 'dropdown-events');
                this.handleCaseTypeChange(event);
            });
            
            // Remove the onchange backup since it's causing duplicate calls
            console.log('Event listener added successfully. Current dropdown value:', dropdown.value);
            console.log('🔍 Case type dropdown setup complete. Element:', dropdown);
            console.log('🔍 Dropdown ID:', dropdown.id);
            console.log('🔍 Dropdown is enabled:', !dropdown.disabled);
            
            // Log setup completion to API
            await this.logToAPI('Case type dropdown setup completed', {
                dropdownId: dropdown.id,
                optionsCount: dropdown.options.length,
                currentValue: dropdown.value,
                isEnabled: !dropdown.disabled,
                timestamp: new Date().toISOString()
            }, 'dropdown-setup');
            
            // Add a click handler to test if the element is responsive
            dropdown.addEventListener('click', async () => {
                console.log('🔍 Case type dropdown clicked!');
                await this.logToAPI('Case type dropdown clicked', {
                    dropdownId: dropdown.id,
                    currentValue: dropdown.value,
                    timestamp: new Date().toISOString()
                }, 'dropdown-events');
            });
            
            // Test that the dropdown is interactive
            console.log('Dropdown options:', dropdown.options.length);
            for (let i = 0; i < dropdown.options.length; i++) {
                console.log(`Option ${i}: value="${dropdown.options[i].value}", text="${dropdown.options[i].text}"`);
            }
            
            // Add a global test function for debugging
            window.testCaseTypeChange = () => {
                console.log('Manual test: Triggering case type change for first available option');
                if (dropdown.options.length > 1) {
                    dropdown.value = dropdown.options[1].value;
                    dropdown.dispatchEvent(new Event('change'));
                } else {
                    console.log('No options available to test');
                }
            };
            console.log('Test function available: window.testCaseTypeChange()');
            
            // Also add direct click listener as backup
            dropdown.addEventListener('click', () => {
                console.log('Case type dropdown clicked, current value:', dropdown.value);
            });
        } catch (error) {
            console.error('Error loading case types for dropdown:', error);
            dropdown.innerHTML = '<option value="">Error loading case types</option>';
        }
    }

    async handleCaseTypeChange(event) {
        const selectedCaseType = event.target.value;
        const callId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        
        console.log(`🔍 [${callId}] Case type change triggered:`, { 
            selectedCaseType, 
            eventTargetId: event.target.id,
            timestamp: new Date().toISOString()
        });
        
        await this.logToAPI('handleCaseTypeChange triggered', { 
            callId,
            selectedCaseType, 
            eventTargetId: event.target.id,
            eventTargetValue: event.target.value,
            timestamp: new Date().toISOString()
        }, 'case-type-change');
        
        // Populate tray dropdown filtered by selected case type
        console.log(`🔍 [${callId}] About to call populateTrayIdDropdown`);
        await this.logToAPI('Calling populateTrayIdDropdown with case type filter', { 
            callId,
            selectedCaseType 
        }, 'case-type-change');
        
        await this.populateTrayIdDropdown(selectedCaseType, callId);
        
        console.log(`🔍 [${callId}] Finished populateTrayIdDropdown`);
        await this.logToAPI('Finished populateTrayIdDropdown call', { 
            callId,
            selectedCaseType 
        }, 'case-type-change');
    }

    async logToAPI(message, data = null, context = 'tray-dropdown-debug') {
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

    async populateTrayIdDropdown(caseType = null, callId = null) {
        const localCallId = callId || Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        console.log(`🔍 [${localCallId}] populateTrayIdDropdown called with:`, { caseType, filterByCaseType: !!caseType });
        await this.logToAPI('populateTrayIdDropdown called', { 
            callId: localCallId,
            caseType, 
            filterByCaseType: !!caseType 
        });
        
        // Check if element exists in DOM
        const dropdown = document.getElementById('surgeonPreferenceTrayIdDropdown');
        await this.logToAPI(`Tray ID dropdown element found: ${!!dropdown}`, { exists: !!dropdown, elementId: dropdown?.id });
        
        if (!dropdown) {
            await this.logToAPI('ERROR: surgeonPreferenceTrayIdDropdown not found in DOM');
            return;
        }

        dropdown.innerHTML = '<option value="">Loading...</option>';

        try {
            let trays = [];
            
            if (caseType && caseType.trim() !== '') {
                // Get trays filtered by case type compatibility
                await this.logToAPI('Getting trays filtered by case type', { caseType });
                const allTrays = await window.app.dataManager.getAllTrays();
                await this.logToAPI('All trays before filtering', { 
                    count: allTrays.length,
                    trays: allTrays.map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name }))
                });
                
                // Filter trays by case_type_compatibility
                const filteredTrays = allTrays.filter(tray => {
                    const compatible = tray.case_type_compatibility && 
                                     Array.isArray(tray.case_type_compatibility) && 
                                     tray.case_type_compatibility.includes(caseType);
                    return compatible;
                });
                
                await this.logToAPI('After case type filtering', {
                    caseType,
                    originalCount: allTrays.length,
                    filteredCount: filteredTrays.length,
                    filteredTrays: filteredTrays.map(t => ({ 
                        id: t.id, 
                        tray_id: t.tray_id, 
                        name: t.name,
                        case_type_compatibility: t.case_type_compatibility
                    }))
                });
                
                // Remove duplicates based on tray ID
                trays = await this.removeDuplicateTrays(filteredTrays);
                
                await this.logToAPI('Filtered and deduplicated trays for case type', { caseType, filteredTrays: trays, length: trays?.length });
            } else {
                // Get all trays if no case type specified (initial load or when clearing selection)
                await this.logToAPI('Getting all trays (no case type filter)');
                const allTrays = await window.app.dataManager.getAllTrays();
                await this.logToAPI('All trays (unfiltered)', { 
                    count: allTrays.length,
                    trays: allTrays.map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name }))
                });
                
                // Use trays directly but remove duplicates
                trays = await this.removeDuplicateTrays(allTrays);
            }
            
            await this.logToAPI('Final trays before dropdown population', {
                count: trays?.length,
                trays: trays?.map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name }))
            });
            
            dropdown.innerHTML = '<option value="">Select Tray ID...</option>';
            
            if (trays && trays.length > 0) {
                await this.logToAPI(`Populating dropdown with ${trays.length} trays`, { count: trays.length, trays });
                trays.forEach((tray, index) => {
                    // Use MyRepData-compatible tray_id field, fallback to Firebase id
                    const trayId = tray.tray_id || tray.id;
                    const trayName = tray.name || trayId;
                    console.log(`Adding tray ${index}: ID="${trayId}", Name="${trayName}"`, tray);
                    dropdown.innerHTML += `<option value="${trayId}">${trayName}</option>`;
                });
                
                // Log final dropdown population to API
                await this.logToAPI('Dropdown population completed', {
                    callId: localCallId,
                    caseType,
                    finalOptionCount: dropdown.options.length,
                    traysAdded: trays.length,
                    finalHTML: dropdown.innerHTML.substring(0, 500) + '...', // Truncate for logging
                    timestamp: new Date().toISOString()
                }, 'dropdown-population');
                await this.logToAPI('Final dropdown populated', { 
                    innerHTMLLength: dropdown.innerHTML.length,
                    optionsCount: dropdown.options.length,
                    firstOption: dropdown.options[1]?.text || 'none',
                    finalHTML: dropdown.innerHTML
                });
            } else {
                console.log('❌ NO TRAYS FOUND', { trays, caseType, traysLength: trays?.length });
                await this.logToAPI('No trays found for case type, showing no trays message', { trays, caseType });
                dropdown.innerHTML = caseType ? 
                    `<option value="">No trays available for ${caseType}</option>` :
                    '<option value="">No trays available</option>';
            }
        } catch (error) {
            await this.logToAPI('Error loading trays', { error: error.message, stack: error.stack });
            dropdown.innerHTML = '<option value="">Error loading trays</option>';
        }
    }

    async getAllTrays() {
        await this.logToAPI('getAllTrays called - fetching all trays from Firestore');
        
        try {
            if (!this.db) {
                await this.logToAPI('ERROR: this.db is null/undefined!');
                return [];
            }

            // Query all trays from the trays collection (matching DataManager pattern)
            await this.logToAPI('Querying trays collection directly from Firebase');
            const traysQuery = query(collection(this.db, 'tray_tracking'));
            const querySnapshot = await getDocs(traysQuery);
            
            await this.logToAPI('Trays query snapshot size', { size: querySnapshot.size });
            
            const trays = [];
            const docDetails = [];
            querySnapshot.forEach((doc) => {
                const trayData = doc.data();
                trays.push({
                    id: doc.id,
                    tray_name: trayData.tray_name || trayData.name || doc.id,
                    ...trayData
                });
                
                docDetails.push({ 
                    docId: doc.id, 
                    trayName: trayData.tray_name || trayData.name,
                    hasData: !!trayData
                });
            });
            
            await this.logToAPI('Processing tray documents', { docDetails, count: docDetails.length });
            
            await this.logToAPI('Processed trays from Firebase', { trays, count: trays.length });
            
            // Sort by tray name
            trays.sort((a, b) => (a.tray_name || '').localeCompare(b.tray_name || ''));
            
            return trays;
            
        } catch (error) {
            await this.logToAPI('Error getting all trays from Firebase', { error: error.message, stack: error.stack });
            return [];
        }
    }

    async getTrayIdsByCaseType(caseType) {
        await this.logToAPI('getTrayIdsByCaseType called', { caseType, caseTypeType: typeof caseType, value: JSON.stringify(caseType) });
        
        try {
            // Query tray_requirements collection for the specified case type
            await this.logToAPI('Querying tray_requirements collection', { case_type: caseType });
            
            if (!this.db) {
                await this.logToAPI('ERROR: this.db is null/undefined!');
                return this.getDefaultTrayIdsByCaseType(caseType);
            }
            
            const q = query(
                collection(this.db, 'tray_requirements'), 
                where('case_type', '==', caseType),
                where('deletedAt', '==', null)
            );
            
            await this.logToAPI('Query created, executing getDocs...');
            const querySnapshot = await getDocs(q);
            const trayIds = [];
            
            await this.logToAPI('Query snapshot size', { size: querySnapshot.size });
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                trayIds.push({
                    tray_id: data.tray_id,
                    tray_name: data.tray_name || data.tray_id
                });
            });

            await this.logToAPI('Raw trayIds from Firebase', { trayIds, count: trayIds.length });

            // Remove duplicates based on tray_id
            const uniqueTrayIds = trayIds.reduce((acc, current) => {
                const exists = acc.find(item => item.tray_id === current.tray_id);
                if (!exists) {
                    acc.push(current);
                }
                return acc;
            }, []);

            // Sort by tray_id
            uniqueTrayIds.sort((a, b) => a.tray_id.localeCompare(b.tray_id));

            await this.logToAPI('Processed uniqueTrayIds from Firebase', { uniqueTrayIds, count: uniqueTrayIds.length });
            
            // If no data from database, use fallback
            if (uniqueTrayIds.length === 0) {
                await this.logToAPI('No tray IDs found in Firebase, using fallback data');
                const fallbackIds = this.getDefaultTrayIdsByCaseType(caseType);
                await this.logToAPI('Fallback returned', { fallbackIds, count: fallbackIds.length });
                return fallbackIds;
            }
            
            return uniqueTrayIds;
        } catch (error) {
            await this.logToAPI('Error getting tray IDs by case type from Firebase', { error: error.message, stack: error.stack });
            
            // Final fallback: return default tray IDs based on case type
            const fallbackIds = this.getDefaultTrayIdsByCaseType(caseType);
            await this.logToAPI('Error fallback returned', { fallbackIds, count: fallbackIds.length });
            return fallbackIds;
        }
    }

    getDefaultTrayIdsByCaseType(caseType) {
        console.log('getDefaultTrayIdsByCaseType called with:', caseType);
        
        // Fallback tray IDs mapped to your actual database case types
        const defaultTrayIds = {
            // Your database case types mapped to appropriate tray IDs
            'ALIF': [
                { tray_id: 'alif_primary_tray', tray_name: 'ALIF Primary Tray' },
                { tray_id: 'alif_instrumentation', tray_name: 'ALIF Instrumentation' }
            ],
            'Lateral Fusion': [
                { tray_id: 'lateral_fusion_primary', tray_name: 'Lateral Fusion Primary Tray' },
                { tray_id: 'lateral_fusion_backup', tray_name: 'Lateral Fusion Backup Tray' }
            ],
            'Minimally Invasive': [
                { tray_id: 'mis_primary_tray', tray_name: 'MIS Primary Tray' },
                { tray_id: 'mis_specialized_tools', tray_name: 'MIS Specialized Tools' }
            ],
            'Pain Management': [
                { tray_id: 'pain_mgmt_basic', tray_name: 'Pain Management Basic Kit' },
                { tray_id: 'pain_mgmt_injection', tray_name: 'Pain Management Injection Kit' }
            ],
            'Posterior Fusion': [
                { tray_id: 'posterior_fusion_primary', tray_name: 'Posterior Fusion Primary Tray' },
                { tray_id: 'posterior_fusion_instrumentation', tray_name: 'Posterior Fusion Instrumentation' }
            ],
            'Revision Surgery': [
                { tray_id: 'revision_primary_kit', tray_name: 'Revision Surgery Primary Kit' },
                { tray_id: 'revision_extraction_tools', tray_name: 'Revision Extraction Tools' }
            ],
            'SI Joint Fusion': [
                { tray_id: 'si_joint_primary', tray_name: 'SI Joint Fusion Primary Tray' },
                { tray_id: 'si_joint_instrumentation', tray_name: 'SI Joint Instrumentation' }
            ],
            'TLIF': [
                { tray_id: 'tlif_primary_tray', tray_name: 'TLIF Primary Tray' },
                { tray_id: 'tlif_cage_insertion', tray_name: 'TLIF Cage Insertion Tools' }
            ]
        };

        const result = defaultTrayIds[caseType] || [];
        console.log('Returning default tray IDs for', caseType, ':', result);
        return result;
    }

    async addTrayPreference() {
        try {
            // Ensure case type dropdown is populated
            const dropdown = document.getElementById('surgeonPrefCaseType');
            if (dropdown && dropdown.children.length <= 1) {
                await this.populateCaseTypeDropdown();
            }

            const caseType = document.getElementById('surgeonPrefCaseType').value.trim();
            const trayId = document.getElementById('surgeonPreferenceTrayIdDropdown').value.trim();
            const requirementType = document.getElementById('surgeonPrefRequirementType').value;
            const quantity = parseInt(document.getElementById('surgeonPrefQuantity').value) || 1;
            const notes = document.getElementById('surgeonPrefNotes').value.trim();
            const surgeonId = document.getElementById('editSurgeonId').value;

            if (!caseType || !trayId || !surgeonId) {
                alert('Please fill in all required fields (Case Type and Tray ID are required)');
                return;
            }

            // Check if we're in editing mode
            if (this.editingPreferenceId) {
                console.log('Updating existing preference:', this.editingPreferenceId);
                await this.updateTrayPreferenceDirectly(this.editingPreferenceId, surgeonId, caseType, trayId, requirementType, quantity, notes);
                
                // Reset editing mode
                this.editingPreferenceId = null;
                const addButton = document.getElementById('addTrayPreferenceBtn');
                if (addButton) {
                    addButton.textContent = 'Add Preference';
                    addButton.classList.remove('btn-warning');
                    addButton.classList.add('btn-primary');
                }
            } else {
                // Always use direct Firestore operations for new preferences
                console.log('Using direct Firestore operations for adding preference');
                await this.addTrayPreferenceDirectly(surgeonId, caseType, trayId, requirementType, quantity, notes);
            }
            return;

            const preferenceData = {
                physician_id: surgeonId,
                case_type: caseType,
                tray_id: trayId,
                tray_name: trayId, // Use tray_id as tray_name for now
                requirement_type: requirementType,
                quantity: quantity,
                priority: requirementType === 'required' ? 1 : requirementType === 'preferred' ? 2 : 3,
                notes: notes
            };

            const userId = window.app.authManager.getCurrentUser()?.uid;
            const created = await this.physicianPreferenceService.createPhysicianPreference(preferenceData, userId);

            // Refresh preferences display
            await this.loadSurgeonTrayPreferences(surgeonId);

            // Clear form
            document.getElementById('surgeonPrefCaseType').value = '';
            document.getElementById('surgeonPreferenceTrayIdDropdown').innerHTML = '<option value="">Select Tray ID...</option>';
            document.getElementById('surgeonPrefRequirementType').value = 'preferred';
            document.getElementById('surgeonPrefQuantity').value = '1';
            document.getElementById('surgeonPrefNotes').value = '';

            this.showSuccessNotification('Tray preference added successfully!');
        } catch (error) {
            console.error('Error adding tray preference:', error);
            this.showErrorNotification('Error adding tray preference: ' + error.message);
        }
    }

    async editTrayPreference(preferenceId) {
        try {
            const preference = this.currentSurgeonPreferences.find(p => p.id === preferenceId);
            if (!preference) {
                this.showErrorNotification('Preference not found');
                return;
            }

            // Populate the form with current values for editing
            document.getElementById('surgeonPrefCaseType').value = preference.case_type;
            document.getElementById('surgeonPrefRequirementType').value = preference.requirement_type || 'preferred';
            document.getElementById('surgeonPrefQuantity').value = preference.quantity || '1';
            document.getElementById('surgeonPrefNotes').value = preference.notes || '';

            // Populate tray dropdown filtered by case type and select the current tray
            await this.populateTrayIdDropdown(preference.case_type);
            setTimeout(() => {
                document.getElementById('surgeonPreferenceTrayIdDropdown').value = preference.tray_id;
            }, 100);

            // Store the preference ID for updating instead of creating new
            this.editingPreferenceId = preferenceId;

            // Update the button text to show it's editing
            const addButton = document.getElementById('addTrayPreferenceBtn');
            if (addButton) {
                addButton.textContent = 'Update Preference';
                addButton.classList.remove('btn-primary');
                addButton.classList.add('btn-warning');
            }

            this.showSuccessNotification('Preference loaded for editing. Update the values and click "Update Preference".');
        } catch (error) {
            console.error('Error loading preference for edit:', error);
            this.showErrorNotification('Error loading preference: ' + error.message);
        }
    }

    async removeTrayPreference(preferenceId) {
        try {
            const userId = window.app.authManager.getCurrentUser()?.uid;
            
            if (this.physicianPreferenceService) {
                // Use service if available
                await this.physicianPreferenceService.deletePhysicianPreference(preferenceId, userId);
            } else {
                // Fallback: Direct Firestore operation
                await this.deleteTrayPreferenceDirectly(preferenceId);
            }

            const surgeonId = document.getElementById('editSurgeonId').value;
            await this.loadSurgeonTrayPreferences(surgeonId);

            this.showSuccessNotification('Tray preference removed successfully!');
        } catch (error) {
            console.error('Error removing tray preference:', error);
            this.showErrorNotification('Error removing tray preference: ' + error.message);
        }
    }

    // Direct Firestore fallback methods (when service isn't available)
    async updateTrayPreferenceDirectly(preferenceId, surgeonId, caseType, trayId, requirementType, quantity, notes) {
        try {
            const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
            
            const updateData = {
                case_type: caseType,
                tray_id: trayId,
                tray_name: trayId,
                requirement_type: requirementType,
                quantity: quantity,
                priority: requirementType === 'required' ? 1 : requirementType === 'preferred' ? 2 : 3,
                notes: notes,
                updated_at: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'physician_preferences', preferenceId), updateData);

            // Refresh preferences display
            await this.loadSurgeonTrayPreferences(surgeonId);

            // Clear form
            document.getElementById('surgeonPrefCaseType').value = '';
            document.getElementById('surgeonPreferenceTrayIdDropdown').innerHTML = '<option value="">Select Tray ID...</option>';
            document.getElementById('surgeonPrefRequirementType').value = 'preferred';
            document.getElementById('surgeonPrefQuantity').value = '1';
            document.getElementById('surgeonPrefNotes').value = '';

            this.showSuccessNotification('Tray preference updated successfully!');
        } catch (error) {
            console.error('Error updating tray preference directly:', error);
            this.showErrorNotification('Error updating tray preference: ' + error.message);
        }
    }

    async addTrayPreferenceDirectly(surgeonId, caseType, trayId, requirementType, quantity, notes) {
        try {
            const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
            
            const preferenceData = {
                physician_id: surgeonId,
                case_type: caseType,
                tray_id: trayId,
                tray_name: trayId,
                requirement_type: requirementType,
                quantity: quantity,
                priority: requirementType === 'required' ? 1 : requirementType === 'preferred' ? 2 : 3,
                notes: notes,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid,
                modifiedBy: window.app.authManager.getCurrentUser()?.uid,
                deletedAt: null
            };

            await addDoc(collection(this.db, 'physician_preferences'), preferenceData);

            // Refresh preferences display
            await this.loadSurgeonTrayPreferences(surgeonId);

            // Clear form
            document.getElementById('surgeonPrefCaseType').value = '';
            document.getElementById('surgeonPreferenceTrayIdDropdown').innerHTML = '<option value="">Select Tray ID...</option>';
            document.getElementById('surgeonPrefRequirementType').value = 'preferred';
            document.getElementById('surgeonPrefQuantity').value = '1';
            document.getElementById('surgeonPrefNotes').value = '';

            this.showSuccessNotification('Tray preference added successfully!');
        } catch (error) {
            console.error('Error adding tray preference directly:', error);
            this.showErrorNotification('Error adding tray preference: ' + error.message);
        }
    }

    async deleteTrayPreferenceDirectly(preferenceId) {
        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
            
            await deleteDoc(doc(this.db, 'physician_preferences', preferenceId));
            
            console.log('Tray preference deleted directly:', preferenceId);
        } catch (error) {
            console.error('Error deleting tray preference directly:', error);
            throw error;
        }
    }

    async loadSurgeonTrayPreferencesDirectly(surgeonId) {
        try {
            const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js');
            
            const q = query(
                collection(this.db, 'physician_preferences'), 
                where('physician_id', '==', surgeonId),
                where('deletedAt', '==', null)
            );
            
            const querySnapshot = await getDocs(q);
            const preferences = [];
            
            querySnapshot.forEach((doc) => {
                preferences.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.currentSurgeonPreferences = preferences;
            console.log('Loaded preferences directly:', preferences);
            
            return preferences;
        } catch (error) {
            console.error('Error loading preferences directly:', error);
            this.currentSurgeonPreferences = [];
            return [];
        }
    }

    async removeDuplicateTrays(trays) {
        if (!trays || !Array.isArray(trays)) return trays;
        
        const inputData = { 
            inputCount: trays.length,
            inputTrays: trays.map(t => ({ id: t.id, tray_id: t.tray_id, name: t.name }))
        };
        
        console.log('🔍 Starting deduplication:', inputData);
        await this.logToAPI('Starting deduplication', inputData);
        
        const seen = new Set();
        const uniqueTrays = [];
        const duplicatesFound = [];
        
        trays.forEach((tray, index) => {
            // Use MyRepData-compatible tray_id field, fallback to Firebase id
            const trayId = tray.tray_id || tray.id;
            if (!seen.has(trayId)) {
                seen.add(trayId);
                uniqueTrays.push(tray);
                this.logToAPI(`Keeping tray ${index}`, { 
                    trayId, 
                    name: tray.name, 
                    id: tray.id, 
                    tray_id: tray.tray_id 
                });
            } else {
                duplicatesFound.push({ 
                    index, 
                    trayId, 
                    name: tray.name, 
                    id: tray.id, 
                    tray_id: tray.tray_id 
                });
                this.logToAPI(`Removing duplicate tray ${index}`, { 
                    trayId, 
                    name: tray.name, 
                    id: tray.id, 
                    tray_id: tray.tray_id 
                });
            }
        });
        
        await this.logToAPI('Deduplication complete', {
            inputCount: trays.length,
            outputCount: uniqueTrays.length,
            duplicatesRemoved: duplicatesFound.length,
            duplicates: duplicatesFound
        });
        
        return uniqueTrays;
    }

    cleanup() {
        if (this.surgeonsUnsubscribe) {
            this.surgeonsUnsubscribe();
        }
    }
}