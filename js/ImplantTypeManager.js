// js/ImplantTypeManager.js - Implant Type Management for Tray Tracker
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { IMPLANT_TYPE_STATUS, DEFAULT_IMPLANT_TYPE_STATUS, getImplantTypeStatusDisplayText, getImplantTypeStatusClass, isActiveImplantType, isInactiveImplantType } from './constants/ImplantType.js';

export class ImplantTypeManager {
    constructor(db) {
        this.db = db;
        this.currentImplantTypes = [];
        this.viewMode = this.getStoredViewMode();
        this.implantTypesUnsubscribe = null;
    }

    getStoredViewMode() {
        return localStorage.getItem('implantTypeViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('implantTypeViewMode', mode);

        const cardBtn = document.getElementById('implantTypeCardViewBtn');
        const listBtn = document.getElementById('implantTypeListViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        const cardView = document.getElementById('implantTypeCardView');
        const listView = document.getElementById('implantTypeListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        // Re-render with current view mode
        this.renderImplantTypes(this.currentImplantTypes);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
    }

    async loadImplantTypes() {
        try {
            console.log('🔄 Loading implant types...');

            if (this.implantTypesUnsubscribe) {
                this.implantTypesUnsubscribe();
            }

            const implantTypesRef = collection(this.db, 'implant_types');
            const q = query(implantTypesRef, orderBy('name'));

            this.implantTypesUnsubscribe = onSnapshot(q, (snapshot) => {
                this.currentImplantTypes = [];
                snapshot.forEach((doc) => {
                    this.currentImplantTypes.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                console.log(`✅ Loaded ${this.currentImplantTypes.length} implant types`);
                if (this.currentImplantTypes.length > 0) {
                    console.log('🔍 Sample implant type:', this.currentImplantTypes[0]);
                    const activeTypes = this.getActiveImplantTypes();
                    console.log(`🔍 Active implant types: ${activeTypes.length} out of ${this.currentImplantTypes.length}`);
                    if (activeTypes.length === 0 && this.currentImplantTypes.length > 0) {
                        console.log('🔍 First implant type status:', this.currentImplantTypes[0].status);
                    }
                }
                this.renderImplantTypes(this.currentImplantTypes);
                this.updateImplantTypeStats();
            }, (error) => {
                console.error('❌ Error loading implant types:', error);
                this.showErrorMessage('Failed to load implant types');
            });

        } catch (error) {
            console.error('❌ Error setting up implant types listener:', error);
            this.showErrorMessage('Failed to load implant types');
        }
    }

    renderImplantTypes(implantTypes) {
        if (this.viewMode === 'card') {
            this.renderCardView(implantTypes);
        } else {
            this.renderListView(implantTypes);
        }
    }

    renderCardView(implantTypes) {
        const implantTypeCardView = document.getElementById('implantTypeCardView');
        if (!implantTypeCardView) return;

        if (implantTypes.length === 0) {
            implantTypeCardView.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-cogs fa-3x mb-3" style="color: var(--primary-color);"></i>
                    <p>No implant types found. <strong>Create your first implant type.</strong></p>
                </div>
            `;
            return;
        }

        implantTypeCardView.innerHTML = '';
        implantTypes.forEach(implantType => {
            const implantTypeCard = this.createImplantTypeCard(implantType);
            implantTypeCardView.appendChild(implantTypeCard);
        });
    }

    renderListView(implantTypes) {
        const implantTypeHorizontalCards = document.getElementById('implantTypeHorizontalCards');
        if (!implantTypeHorizontalCards) return;

        if (implantTypes.length === 0) {
            implantTypeHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-cogs fa-3x mb-3" style="color: var(--primary-color);"></i>
                    <p>No implant types found. <strong>Create your first implant type.</strong></p>
                </div>
            `;
            return;
        }

        implantTypeHorizontalCards.innerHTML = '';
        implantTypes.forEach(implantType => {
            const implantTypeCard = this.createHorizontalImplantTypeCard(implantType);
            implantTypeHorizontalCards.appendChild(implantTypeCard);
        });
    }

    createImplantTypeCard(implantType) {
        const card = document.createElement('div');
        card.className = 'casetype-card';

        const statusText = getImplantTypeStatusDisplayText(implantType.status);
        const statusClass = implantType.status === 'active' ? 'status-available' : 'status-in-use';

        card.innerHTML = `
            <div class="casetype-card-header">
                <div class="casetype-card-title">
                    <div class="casetype-icon">
                        <i class="fas fa-cogs"></i>
                    </div>
                    ${implantType.name}
                </div>
                <span class="tray-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="casetype-card-content">
                ${implantType.description ? `
                    <div class="casetype-detail">
                        <i class="fas fa-info-circle"></i>
                        <span class="casetype-detail-value">${implantType.description}</span>
                    </div>
                ` : `
                    <div class="casetype-detail">
                        <i class="fas fa-info-circle"></i>
                        <span class="casetype-detail-empty">No description</span>
                    </div>
                `}
                <div class="casetype-detail">
                    <i class="fas fa-calendar"></i>
                    <span class="casetype-detail-value">Created: ${this.formatDate(implantType.createdAt)}</span>
                </div>
            </div>
            <div class="casetype-card-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditImplantTypeModal('${implantType.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        `;

        return card;
    }

    createHorizontalImplantTypeCard(implantType) {
        const card = document.createElement('div');
        card.className = 'case-type-horizontal-card';

        const statusClass = getImplantTypeStatusClass(implantType.status);

        card.innerHTML = `
            <div class="case-type-horizontal-header">
                <div class="case-type-horizontal-title">
                    <div class="case-type-icon">
                        <i class="fas fa-cogs"></i>
                    </div>
                    <div>
                        <h6>${implantType.name}</h6>
                    </div>
                </div>
                <div class="case-type-horizontal-status">
                    <span class="status-badge ${statusClass}">${getImplantTypeStatusDisplayText(implantType.status)}</span>
                </div>
            </div>

            <div class="case-type-horizontal-body">
                <div class="case-type-horizontal-field">
                    <label>Description</label>
                    <span>${implantType.description || 'Not provided'}</span>
                </div>
                <div class="case-type-horizontal-field">
                    <label>Created</label>
                    <span>${this.formatDate(implantType.createdAt)}</span>
                </div>
            </div>

            <div class="case-type-horizontal-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditImplantTypeModal('${implantType.id}')" title="Edit Implant Type">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="app.implantTypeManager.confirmDeleteImplantType('${implantType.id}', '${implantType.name}')" title="Delete Implant Type">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        return card;
    }

    async addImplantType(implantTypeData) {
        try {
            console.log('➕ Adding implant type:', implantTypeData);

            const implantTypesRef = collection(this.db, 'implant_types');
            await addDoc(implantTypesRef, {
                ...implantTypeData,
                status: implantTypeData.status || DEFAULT_IMPLANT_TYPE_STATUS,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            console.log('✅ Implant type added successfully');
            this.showSuccessMessage('Implant type added successfully');

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addImplantTypeModal'));
            if (modal) {
                modal.hide();
            }

            // Clear the form
            const form = document.getElementById('addImplantTypeForm');
            if (form) {
                form.reset();
            }
        } catch (error) {
            console.error('❌ Error adding implant type:', error);
            this.showErrorMessage('Failed to add implant type');
            throw error;
        }
    }

    async updateImplantType(implantTypeId, implantTypeData) {
        try {
            console.log('✏️ Updating implant type:', implantTypeId, implantTypeData);

            // Validate input data
            if (!implantTypeId) {
                throw new Error('Implant type ID is required');
            }

            if (!implantTypeData.name || implantTypeData.name.trim() === '') {
                throw new Error('Implant type name is required');
            }

            const implantTypeRef = doc(this.db, 'implant_types', implantTypeId);
            await updateDoc(implantTypeRef, {
                ...implantTypeData,
                updatedAt: serverTimestamp()
            });

            console.log('✅ Implant type updated successfully');
            this.showSuccessMessage('Implant type updated successfully');

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editImplantTypeModal'));
            if (modal) {
                modal.hide();
            }
        } catch (error) {
            console.error('❌ Error updating implant type:', error);
            this.showErrorMessage('Failed to update implant type: ' + error.message);
            throw error;
        }
    }

    async deleteImplantType(implantTypeId) {
        try {
            console.log('🗑️ Deleting implant type:', implantTypeId);

            const implantTypeRef = doc(this.db, 'implant_types', implantTypeId);
            await deleteDoc(implantTypeRef);

            console.log('✅ Implant type deleted successfully');
            this.showSuccessMessage('Implant type deleted successfully');
        } catch (error) {
            console.error('❌ Error deleting implant type:', error);
            this.showErrorMessage('Failed to delete implant type');
            throw error;
        }
    }

    confirmDeleteImplantType(implantTypeId, implantTypeName) {
        const confirmed = confirm(`Are you sure you want to delete the implant type "${implantTypeName}"? This action cannot be undone.`);
        if (confirmed) {
            this.deleteImplantType(implantTypeId);
        }
    }

    getImplantTypeById(implantTypeId) {
        return this.currentImplantTypes.find(implantType => implantType.id === implantTypeId);
    }

    getImplantTypes() {
        return this.currentImplantTypes;
    }

    getActiveImplantTypes() {
        return this.currentImplantTypes.filter(implantType => isActiveImplantType(implantType.status));
    }

    getInactiveImplantTypes() {
        return this.currentImplantTypes.filter(implantType => isInactiveImplantType(implantType.status));
    }

    updateImplantTypeStats() {
        const totalCount = this.currentImplantTypes.length;
        const activeCount = this.getActiveImplantTypes().length;
        const inactiveCount = this.getInactiveImplantTypes().length;

        // Update UI elements if they exist
        const totalElement = document.getElementById('totalImplantTypesCount');
        const activeElement = document.getElementById('activeImplantTypesCount');
        const inactiveElement = document.getElementById('inactiveImplantTypesCount');

        if (totalElement) totalElement.textContent = totalCount;
        if (activeElement) activeElement.textContent = activeCount;
        if (inactiveElement) inactiveElement.textContent = inactiveCount;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown';

        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate(); // Firestore Timestamp
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    showSuccessMessage(message) {
        console.log('✅', message);
        if (window.app && window.app.notifications) {
            window.app.notifications.showSuccess(message);
        }
    }

    showErrorMessage(message) {
        console.error('❌', message);
        if (window.app && window.app.notifications) {
            window.app.notifications.showError(message);
        }
    }

    cleanup() {
        if (this.implantTypesUnsubscribe) {
            this.implantTypesUnsubscribe();
            this.implantTypesUnsubscribe = null;
        }
    }
}