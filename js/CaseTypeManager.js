// js/CaseTypeManager.js - Case Type Management for Tray Tracker
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class CaseTypeManager {
    constructor(db) {
        this.db = db;
        this.currentCaseTypes = [];
        this.viewMode = this.getStoredViewMode();
        this.caseTypesUnsubscribe = null;
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
            const caseType = {
                name: document.getElementById('caseTypeName').value,
                description: document.getElementById('caseTypeDescription').value,
                active: document.getElementById('caseTypeActive').checked,
                createdAt: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid,
                isDemoCaseType: false
            };

            await addDoc(collection(this.db, 'casetypes'), caseType);

            bootstrap.Modal.getInstance(document.getElementById('addCaseTypeModal')).hide();
            document.getElementById('addCaseTypeForm').reset();

            this.showSuccessNotification('Case type added successfully!');
        } catch (error) {
            console.error('Error adding case type:', error);
            this.showErrorNotification('Error adding case type: ' + error.message);
        }
    }

    async updateCaseType() {
        try {
            const caseTypeId = document.getElementById('editCaseTypeId').value;

            const updates = {
                name: document.getElementById('editCaseTypeName').value,
                description: document.getElementById('editCaseTypeDescription').value,
                active: document.getElementById('editCaseTypeActive').checked,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'casetypes', caseTypeId), updates);

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
                <button class="btn-danger-custom btn-sm" onclick="app.caseTypeManager.deleteCaseType('${caseType.id}', '${caseType.name}')">
                    <i class="fas fa-trash"></i> Delete
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
                <button class="btn-danger-custom btn-sm" onclick="app.caseTypeManager.deleteCaseType('${caseType.id}', '${caseType.name}')">
                    <i class="fas fa-trash"></i> Delete
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

    cleanup() {
        if (this.caseTypesUnsubscribe) {
            this.caseTypesUnsubscribe();
        }
    }
}