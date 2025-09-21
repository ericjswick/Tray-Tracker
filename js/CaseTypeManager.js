// js/CaseTypeManager.js - Case Type Management for Tray Tracker
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class CaseTypeManager {
    constructor(db) {
        this.db = db;
        this.currentCaseTypes = [];
        this.viewMode = this.getStoredViewMode();
        this.caseTypesUnsubscribe = null;
        
        // Temporary storage for tray requirements during modal editing
        this.tempTrayRequirements = [];
        this.editTrayRequirements = [];
    }


    getStoredViewMode() {
        return localStorage.getItem('caseTypeViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('caseTypeViewMode', mode);

        const cardBtn = document.getElementById('caseTypeCardViewBtn');
        const listBtn = document.getElementById('caseTypeListViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        const cardView = document.getElementById('caseTypeCardView');
        const listView = document.getElementById('caseTypeListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        this.renderCaseTypes(this.currentCaseTypes);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        this.setupRealtimeListeners();
        this.showLoadingState();
    }

    showLoadingState() {
        const caseTypeCardView = document.getElementById('caseTypeCardView');
        const caseTypeListView = document.getElementById('caseTypeListView');

        if (caseTypeCardView) {
            caseTypeCardView.innerHTML = `
                <div class="loading-state">
                    <div class="spinner-border" role="status"></div>
                    <p class="mt-2">Loading case types...</p>
                </div>
            `;
        }

        if (caseTypeListView) {
            const caseTypeHorizontalCards = document.getElementById('caseTypeHorizontalCards');
            if (caseTypeHorizontalCards) {
                caseTypeHorizontalCards.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner-border" role="status"></div>
                        <p class="mt-2">Loading case types...</p>
                    </div>
                `;
            }
        }
    }

    setupRealtimeListeners() {
        if (!this.db) return;

        const caseTypesQuery = query(collection(this.db, 'casetypes'), orderBy('name', 'asc'));
        this.caseTypesUnsubscribe = onSnapshot(caseTypesQuery, (snapshot) => {
            const caseTypes = [];
            snapshot.forEach((doc) => {
                caseTypes.push({ id: doc.id, ...doc.data() });
            });

            this.handleCaseTypesUpdate(caseTypes);
        }, (error) => {
            console.error('Error listening to case types:', error);
        });
    }

    async addCaseType() {
        try {
            const caseTypeName = document.getElementById('caseTypeName').value;
            const userId = window.app.authManager.getCurrentUser()?.uid;

            // Create the case type without embedded tray requirements
            const caseType = {
                name: caseTypeName,
                description: document.getElementById('caseTypeDescription').value,
                active: document.getElementById('caseTypeActive').checked,
                createdAt: serverTimestamp(),
                createdBy: userId,
                isDemoCaseType: false
            };

            const docRef = await addDoc(collection(this.db, 'casetypes'), caseType);

            // Save tray requirements to separate collection
            if (this.tempTrayRequirements.length > 0) {
                const trayRequirementsCollection = collection(this.db, 'tray_requirements');
                
                for (const requirement of this.tempTrayRequirements) {
                    await addDoc(trayRequirementsCollection, {
                        case_type_id: docRef.id,
                        case_type_name: caseTypeName,
                        tray_id: requirement.tray_id,
                        tray_name: requirement.tray_name,
                        requirement_type: requirement.requirement_type,
                        quantity: requirement.quantity,
                        notes: requirement.notes || '',
                        createdAt: serverTimestamp(),
                        createdBy: userId,
                        isDemoRequirement: false
                    });
                }
            }

            bootstrap.Modal.getInstance(document.getElementById('addCaseTypeModal')).hide();
            document.getElementById('addCaseTypeForm').reset();
            this.tempTrayRequirements = []; // Clear temp requirements
            this.renderTrayRequirements('addCaseTypeTrayRequirements', []); // Clear display

            this.showSuccessNotification('Case type added successfully!');
        } catch (error) {
            console.error('Error adding case type:', error);
            this.showErrorNotification('Error adding case type: ' + error.message);
        }
    }

    async updateCaseType() {
        try {
            const caseTypeId = document.getElementById('editCaseTypeId').value;
            const caseTypeName = document.getElementById('editCaseTypeName').value;
            const userId = window.app.authManager.getCurrentUser()?.uid;

            // Update the case type without embedded tray requirements
            const updates = {
                name: caseTypeName,
                description: document.getElementById('editCaseTypeDescription').value,
                active: document.getElementById('editCaseTypeActive').checked,
                lastModified: serverTimestamp(),
                modifiedBy: userId
            };

            await updateDoc(doc(this.db, 'casetypes', caseTypeId), updates);

            // Update tray requirements in separate collection
            // First, delete existing requirements for this case type (using OR logic)
            const existingRequirementsById = query(
                collection(this.db, 'tray_requirements'),
                where('case_type_id', '==', caseTypeId)
            );
            const existingRequirementsByName = query(
                collection(this.db, 'tray_requirements'),
                where('case_type_name', '==', caseTypeName)
            );
            const [snapshotById, snapshotByName] = await Promise.all([
                getDocs(existingRequirementsById),
                getDocs(existingRequirementsByName)
            ]);

            // Combine results and deduplicate
            const existingDocs = new Map();
            snapshotById.forEach(doc => existingDocs.set(doc.id, doc));
            snapshotByName.forEach(doc => existingDocs.set(doc.id, doc));
            const existingSnapshot = { docs: Array.from(existingDocs.values()) };
            
            // Delete existing requirements
            for (const docSnapshot of existingSnapshot.docs) {
                await deleteDoc(doc(this.db, 'tray_requirements', docSnapshot.id));
            }
            
            // Add new requirements
            if (this.editTrayRequirements.length > 0) {
                const trayRequirementsCollection = collection(this.db, 'tray_requirements');
                
                for (const requirement of this.editTrayRequirements) {
                    await addDoc(trayRequirementsCollection, {
                        case_type_id: caseTypeId,
                        case_type_name: caseTypeName,
                        tray_id: requirement.tray_id,
                        tray_name: requirement.tray_name,
                        requirement_type: requirement.requirement_type,
                        quantity: requirement.quantity,
                        notes: requirement.notes || '',
                        createdAt: serverTimestamp(),
                        createdBy: userId,
                        isDemoRequirement: false
                    });
                }
            }

            bootstrap.Modal.getInstance(document.getElementById('editCaseTypeModal')).hide();
            this.showSuccessNotification('Case type updated successfully!');
        } catch (error) {
            console.error('Error updating case type:', error);
            this.showErrorNotification('Error updating case type: ' + error.message);
        }
    }

    async deleteCaseType(caseTypeId, caseTypeName) {
        if (!confirm(`Are you sure you want to delete case type "${caseTypeName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const userId = window.app.authManager.getCurrentUser()?.uid;

            // Delete associated tray requirements first (using OR logic)
            const existingRequirementsById = query(
                collection(this.db, 'tray_requirements'),
                where('case_type_id', '==', caseTypeId)
            );
            const existingRequirementsByName = query(
                collection(this.db, 'tray_requirements'),
                where('case_type_name', '==', caseTypeName)
            );
            const [snapshotById, snapshotByName] = await Promise.all([
                getDocs(existingRequirementsById),
                getDocs(existingRequirementsByName)
            ]);

            // Combine results and deduplicate
            const existingDocs = new Map();
            snapshotById.forEach(doc => existingDocs.set(doc.id, doc));
            snapshotByName.forEach(doc => existingDocs.set(doc.id, doc));
            const existingSnapshot = { docs: Array.from(existingDocs.values()) };
            
            for (const docSnapshot of existingSnapshot.docs) {
                await deleteDoc(doc(this.db, 'tray_requirements', docSnapshot.id));
            }

            // Then delete the case type
            await deleteDoc(doc(this.db, 'casetypes', caseTypeId));
            this.showSuccessNotification('Case type deleted successfully!');
        } catch (error) {
            console.error('Error deleting case type:', error);
            this.showErrorNotification('Error deleting case type: ' + error.message);
        }
    }

    handleCaseTypesUpdate(caseTypes) {
        console.log('CaseTypeManager received case types update:', caseTypes.length);
        this.currentCaseTypes = caseTypes;
        this.renderCaseTypes(caseTypes);
        this.updateStats(caseTypes);

        // Update DataManager with case types for dropdowns
        if (window.app.dataManager) {
            window.app.dataManager.caseTypes = caseTypes;
        }
    }

    renderCaseTypes(caseTypes) {
        if (this.viewMode === 'card') {
            this.renderCardView(caseTypes);
        } else {
            this.renderListView(caseTypes);
        }
    }

    renderCardView(caseTypes) {
        const caseTypeCardView = document.getElementById('caseTypeCardView');
        if (!caseTypeCardView) return;

        if (caseTypes.length === 0) {
            caseTypeCardView.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-clipboard-list fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No case types found. Add a new case type to get started.</p>
                </div>
            `;
            return;
        }

        caseTypeCardView.innerHTML = '';
        caseTypes.forEach(caseType => {
            const caseTypeCard = this.createCaseTypeCard(caseType);
            caseTypeCardView.appendChild(caseTypeCard);
        });
    }

    renderListView(caseTypes) {
        const caseTypeHorizontalCards = document.getElementById('caseTypeHorizontalCards');
        if (!caseTypeHorizontalCards) return;

        if (caseTypes.length === 0) {
            caseTypeHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-clipboard-list fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No case types found. Add a new case type to get started.</p>
                </div>
            `;
            return;
        }

        caseTypeHorizontalCards.innerHTML = '';
        caseTypes.forEach(caseType => {
            const caseTypeCard = this.createHorizontalCaseTypeCard(caseType);
            caseTypeHorizontalCards.appendChild(caseTypeCard);
        });
    }

    createCaseTypeCard(caseType) {
        const card = document.createElement('div');
        card.className = 'casetype-card';

        const statusText = caseType.active !== false ? 'Active' : 'Inactive';
        const statusClass = caseType.active !== false ? 'status-available' : 'status-in-use';

        card.innerHTML = `
            <div class="casetype-card-header">
                <div class="casetype-card-title">
                    <div class="casetype-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    ${caseType.name}
                </div>
                <span class="tray-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="casetype-card-content">
                ${caseType.description ? `
                    <div class="casetype-detail">
                        <i class="fas fa-info-circle"></i>
                        <span class="casetype-detail-value">${caseType.description}</span>
                    </div>
                ` : `
                    <div class="casetype-detail">
                        <i class="fas fa-info-circle"></i>
                        <span class="casetype-detail-empty">No description</span>
                    </div>
                `}
                <div class="casetype-detail">
                    <i class="fas fa-calendar"></i>
                    <span class="casetype-detail-value">Created: ${this.formatDate(caseType.createdAt)}</span>
                </div>
            </div>
            <div class="casetype-card-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditCaseTypeModal('${caseType.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        `;

        return card;
    }

    createHorizontalCaseTypeCard(caseType) {
        const card = document.createElement('div');
        card.className = 'casetype-horizontal-card';

        const statusText = caseType.active !== false ? 'Active' : 'Inactive';
        const statusClass = caseType.active !== false ? 'status-available' : 'status-in-use';

        card.innerHTML = `
            <div class="casetype-horizontal-header">
                <div class="casetype-horizontal-title">
                    <div class="casetype-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <div>
                        <h6>${caseType.name}</h6>
                        <small class="text-muted">${caseType.description || 'No description'}</small>
                    </div>
                </div>
                <div class="casetype-horizontal-status">
                    <span class="tray-status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="casetype-horizontal-body">
                <div class="casetype-horizontal-field">
                    <label>Description</label>
                    <span class="${!caseType.description ? 'empty-value' : ''}">${caseType.description || 'No description provided'}</span>
                </div>
                <div class="casetype-horizontal-field">
                    <label>Status</label>
                    <span>${caseType.active !== false ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="casetype-horizontal-field">
                    <label>Created</label>
                    <span>${this.formatDate(caseType.createdAt)}</span>
                </div>
                <div class="casetype-horizontal-field">
                    <label>Usage</label>
                    <span class="empty-value">View surgeons using this</span>
                </div>
            </div>
            
            <div class="casetype-horizontal-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditCaseTypeModal('${caseType.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        `;

        return card;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    }

    updateStats(caseTypes) {
        const stats = {
            total: caseTypes.length,
            active: caseTypes.filter(ct => ct.active !== false).length,
            inactive: caseTypes.filter(ct => ct.active === false).length
        };

        const totalElement = document.getElementById('totalCaseTypesCount');
        const activeElement = document.getElementById('activeCaseTypesCount');
        const inactiveElement = document.getElementById('inactiveCaseTypesCount');

        if (totalElement) totalElement.textContent = stats.total;
        if (activeElement) activeElement.textContent = stats.active;
        if (inactiveElement) inactiveElement.textContent = stats.inactive;
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

    // Tray Requirements Management Methods
    addTrayRequirement() {
        const trayId = document.getElementById('newTrayDropdown').value;
        const requirementType = document.getElementById('newTrayRequirementType').value;
        const quantity = parseInt(document.getElementById('newTrayQuantity').value) || 1;
        const notes = document.getElementById('newTrayNotes').value.trim();
        
        if (!trayId) {
            alert('Please select a tray');
            return;
        }
        
        const requirement = {
            tray_id: trayId,
            requirement_type: requirementType,
            quantity: quantity,
            notes: notes
        };
        
        this.tempTrayRequirements.push(requirement);
        this.renderTrayRequirements('addCaseTypeTrayRequirements', this.tempTrayRequirements);
        
        // Clear the form
        document.getElementById('newTrayDropdown').value = '';
        document.getElementById('newTrayRequirementType').value = 'required';
        document.getElementById('newTrayQuantity').value = '1';
        document.getElementById('newTrayNotes').value = '';
    }
    
    addTrayRequirementToEdit() {
        const trayDropdown = document.getElementById('editCaseTypeTrayDropdown_CT001');
        const trayId = trayDropdown.value.trim();
        const trayName = trayDropdown.selectedOptions[0]?.textContent || trayId;
        const requirementType = document.getElementById('editNewTrayRequirementType').value;
        const quantity = parseInt(document.getElementById('editNewTrayQuantity').value) || 1;
        const notes = document.getElementById('editNewTrayNotes').value.trim();

        if (!trayId) {
            alert('Please select a tray from the dropdown');
            return;
        }

        // Check for duplicate tray requirements - be thorough about checking different ID formats
        const existingRequirement = this.editTrayRequirements.find(req => {
            return req.tray_id === trayId || req.id === trayId;
        });

        if (existingRequirement) {
            console.log('🔍 DEBUG: Duplicate detected:', {
                attemptedTrayId: trayId,
                attemptedTrayName: trayName,
                existingRequirement: existingRequirement
            });
            alert(`Tray "${trayName}" is already added to the requirements. Please select a different tray.`);
            return;
        }

        console.log('🔍 DEBUG: Adding new requirement:', {
            trayId,
            trayName,
            currentRequirements: this.editTrayRequirements.length
        });

        const requirement = {
            tray_id: trayId,
            tray_name: trayName,
            requirement_type: requirementType,
            quantity: quantity,
            notes: notes
        };

        this.editTrayRequirements.push(requirement);
        this.renderTrayRequirements('editCaseTypeTrayRequirements', this.editTrayRequirements);

        // Refresh dropdown to remove the newly added tray from available options
        this.populateTrayDropdownForEdit();

        // Clear the form
        trayDropdown.value = '';
        document.getElementById('editNewTrayRequirementType').value = 'required';
        document.getElementById('editNewTrayQuantity').value = '1';
        document.getElementById('editNewTrayNotes').value = '';
    }
    
    removeTrayRequirement(index, isEdit = false) {
        if (isEdit) {
            this.editTrayRequirements.splice(index, 1);
            this.renderTrayRequirements('editCaseTypeTrayRequirements', this.editTrayRequirements);
            // Refresh dropdown to add the removed tray back to available options
            this.populateTrayDropdownForEdit();
        } else {
            this.tempTrayRequirements.splice(index, 1);
            this.renderTrayRequirements('addCaseTypeTrayRequirements', this.tempTrayRequirements);
        }
    }
    
    renderTrayRequirements(containerId, requirements) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (requirements.length === 0) {
            container.innerHTML = '<small class="text-muted">No tray requirements added yet.</small>';
            return;
        }
        
        const isEdit = containerId.includes('edit');
        
        console.log('🔍 Rendering requirements:', requirements);
        
        const html = requirements.map((req, index) => {
            console.log('🔍 Requirement item:', req);
            const requirementType = req.requirement_type || 'required';
            const badgeClass = requirementType === 'required' ? 'danger' : 
                              requirementType === 'preferred' ? 'warning' : 'secondary';
            
            return `
            <div class="tray-requirement-item d-flex justify-content-between align-items-center p-2 mb-1 bg-white border rounded">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <strong>${req.tray_name || req.tray_id}</strong>
                        <span class="badge bg-${badgeClass}">
                            ${requirementType}
                        </span>
                        <span class="badge bg-info text-dark">
                            Qty: ${req.quantity || 1}
                        </span>
                    </div>
                    ${req.notes ? `<small class="text-muted">${req.notes}</small>` : ''}
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="app.caseTypeManager.removeTrayRequirement(${index}, ${isEdit})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    // Called when showing edit modal to populate existing tray requirements
    async loadTrayRequirementsForEdit(caseType) {
        try {
            console.log('🔍 Loading tray requirements for case type:', caseType.name);

            // Use the central function from DataManager
            const requirements = await window.app.dataManager.getTrayRequirementsByCaseType(caseType.id, caseType.name);

            console.log('🔍 Raw requirements loaded from collection:', requirements);

            // Check for and remove duplicates based on tray_id
            const uniqueRequirements = [];
            const seenTrayIds = new Set();

            requirements.forEach(req => {
                const trayId = req.tray_id;
                if (trayId && !seenTrayIds.has(trayId)) {
                    seenTrayIds.add(trayId);
                    uniqueRequirements.push(req);
                } else if (trayId) {
                    console.log('🔍 Found duplicate requirement for tray_id:', trayId, 'removing duplicate');
                } else {
                    console.log('🔍 Found requirement without tray_id:', req, 'skipping');
                }
            });

            console.log(`🔍 Filtered ${requirements.length} raw requirements to ${uniqueRequirements.length} unique requirements`);
            console.log('🔍 Final unique requirements:', uniqueRequirements);

            this.editTrayRequirements = uniqueRequirements;
            this.renderTrayRequirements('editCaseTypeTrayRequirements', this.editTrayRequirements);

            // Populate dropdown AFTER loading requirements so filtering works correctly
            await this.populateTrayDropdownForEdit();

        } catch (error) {
            console.error('Error loading tray requirements for edit:', error);
            this.editTrayRequirements = [];
            this.renderTrayRequirements('editCaseTypeTrayRequirements', this.editTrayRequirements);
            // Still populate dropdown even on error
            await this.populateTrayDropdownForEdit();
        }
    }
    
    
    // Populate the tray dropdown for case type edit modal
    async populateTrayDropdownForEdit() {
        const dropdown = document.getElementById('editCaseTypeTrayDropdown_CT001');
        if (!dropdown) return;

        try {
            // Get all trays from DataManager
            let trays = await window.app.dataManager.getAllTrays();

            // Get the current case type being edited
            const currentCaseTypeId = document.getElementById('editCaseTypeId')?.value;

            // Debug: Log first tray to see structure
            if (trays && trays.length > 0) {
                console.log('🔍 DEBUG: First tray object structure:', trays[0]);
                console.log('🔍 DEBUG: Tray properties:', Object.keys(trays[0]));
            }

            // Apply compatibility filtering for case type editing
            if (currentCaseTypeId && window.app.dataManager.filterForTrayCompatibilityType) {
                trays = window.app.dataManager.filterForTrayCompatibilityType(currentCaseTypeId, trays);
                console.log(`🔍 DEBUG: Applied compatibility filtering for case type "${currentCaseTypeId}"`);
            }

            // Clear existing options
            dropdown.innerHTML = '<option value="">Select a tray...</option>';

            // Add tray options
            if (trays && trays.length > 0) {
                // Get IDs of trays already in requirements to filter them out
                // Handle both tray_id and id fields from requirements
                const usedTrayIds = this.editTrayRequirements.map(req => req.tray_id).filter(Boolean);
                console.log('🔍 DEBUG: Used tray IDs to filter out:', usedTrayIds);
                console.log('🔍 DEBUG: Current requirements:', this.editTrayRequirements);

                // Filter out trays that are already in the requirements
                const availableTrays = trays.filter(tray => {
                    const trayId = tray.tray_id || tray.id;
                    const isAlreadyUsed = usedTrayIds.includes(trayId);

                    if (isAlreadyUsed) {
                        console.log(`🔍 DEBUG: Filtering out already used tray: ${trayId} (${tray.tray_name || tray.name})`);
                    }

                    return !isAlreadyUsed;
                });

                console.log(`🔍 DEBUG: Filtered ${trays.length} compatible trays to ${availableTrays.length} available trays`);

                if (availableTrays.length === 0) {
                    dropdown.innerHTML = '<option value="">All trays have been added</option>';
                    dropdown.disabled = true;
                    return;
                }

                // Sort available trays alphabetically by name
                const sortedTrays = [...availableTrays].sort((a, b) => {
                    const nameA = (a.tray_name || a.name || a.tray_id || a.id || '').toLowerCase();
                    const nameB = (b.tray_name || b.name || b.tray_id || b.id || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                sortedTrays.forEach(tray => {
                    const option = document.createElement('option');
                    option.value = tray.tray_id || tray.id;
                    option.textContent = tray.tray_name || tray.name || tray.tray_id || tray.id;
                    dropdown.appendChild(option);
                });
                dropdown.disabled = false;
            } else {
                dropdown.innerHTML = '<option value="">No trays available</option>';
                dropdown.disabled = true;
            }
        } catch (error) {
            console.error('Error populating tray dropdown:', error);
            dropdown.innerHTML = '<option value="">Error loading trays</option>';
            dropdown.disabled = true;
        }
    }
    
    // Called when showing add modal to reset tray requirements
    resetTrayRequirementsForAdd() {
        this.tempTrayRequirements = [];
        this.renderTrayRequirements('addCaseTypeTrayRequirements', this.tempTrayRequirements);
    }

    cleanup() {
        if (this.caseTypesUnsubscribe) {
            this.caseTypesUnsubscribe();
        }
    }
}