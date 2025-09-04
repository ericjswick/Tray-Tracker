// js/SurgeonManager.js - Surgeon Management for Tray Tracker
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class SurgeonManager {
    constructor(db) {
        this.db = db;
        this.currentSurgeons = [];
        this.viewMode = this.getStoredViewMode();
        this.surgeonsUnsubscribe = null;
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

    setupRealtimeListeners() {
        if (!this.db) return;

        const surgeonsQuery = query(collection(this.db, 'surgeons'), orderBy('createdAt', 'desc'));
        this.surgeonsUnsubscribe = onSnapshot(surgeonsQuery, (snapshot) => {
            const surgeons = [];
            snapshot.forEach((doc) => {
                surgeons.push({ id: doc.id, ...doc.data() });
            });

            this.handleSurgeonsUpdate(surgeons);
        }, (error) => {
            console.error('Error listening to surgeons:', error);
        });
    }

    async addSurgeon() {
        try {

            // Get selected case type IDs from multi-select
            const preferredCasesSelect = document.getElementById('surgeonPreferredCases');
            const selectedCaseTypes = Array.from(preferredCasesSelect.selectedOptions).map(option => option.value);
            const preferredCasesString = selectedCaseTypes.join(',');

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

            await addDoc(collection(this.db, 'surgeons'), surgeon);

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

            // Get selected case type IDs from multi-select
            const preferredCasesSelect = document.getElementById('editSurgeonPreferredCases');
            const selectedCaseTypes = Array.from(preferredCasesSelect.selectedOptions).map(option => option.value);
            const preferredCasesString = selectedCaseTypes.join(',');

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

            await updateDoc(doc(this.db, 'surgeons', surgeonId), updates);

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
            await deleteDoc(doc(this.db, 'surgeons', surgeonId));
            this.showSuccessNotification('Surgeon deleted successfully!');
        } catch (error) {
            console.error('Error deleting surgeon:', error);
            this.showErrorNotification('Error deleting surgeon: ' + error.message);
        }
    }

    handleSurgeonsUpdate(surgeons) {
        console.log('SurgeonManager received surgeons update:', surgeons.length);
        this.currentSurgeons = surgeons;
        this.renderSurgeons(surgeons);
        this.updateStats(surgeons);

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

            const checkForCaseTypes = () => {
                if (window.app.dataManager && window.app.dataManager.caseTypes && window.app.dataManager.caseTypes.length > 0) {
                    console.log('Case types loaded, re-rendering surgeons...');
                    this.caseTypesUpdateScheduled = false;
                    this.renderSurgeons(this.currentSurgeons);
                } else {
                    setTimeout(checkForCaseTypes, 1000);
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

    cleanup() {
        if (this.surgeonsUnsubscribe) {
            this.surgeonsUnsubscribe();
        }
    }
}