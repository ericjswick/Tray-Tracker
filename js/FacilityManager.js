// js/FacilityManager.js - MyRepData-compatible facility management
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { FACILITY_TYPES, getFacilityTypeLabel, getFacilityTypeIcon, getFacilityTypeColor, getFacilityTypeClass, isValidFacilityType } from './constants/FacilityTypes.js';

export class FacilityManager {
    constructor(db) {
        this.db = db;
        this.currentFacilities = [];
        this.viewMode = this.getStoredViewMode();
        this.facilitiesUnsubscribe = null;
        this.collectionName = 'facilities'; // MyRepData-compatible collection name
    }

    getStoredViewMode() {
        return localStorage.getItem('facilityViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('facilityViewMode', mode);

        const cardBtn = document.getElementById('facilityCardViewBtn');
        const listBtn = document.getElementById('facilityListViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        const cardView = document.getElementById('facilityCardView');
        const listView = document.getElementById('facilityListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        this.renderFacilities(this.currentFacilities);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        this.setupRealtimeListener();
        console.log('FacilityManager initialized with MyRepData-compatible structure');
    }

    setupRealtimeListener() {
        if (this.facilitiesUnsubscribe) {
            this.facilitiesUnsubscribe();
        }

        const facilitiesQuery = query(collection(this.db, this.collectionName), orderBy('name', 'asc'));
        this.facilitiesUnsubscribe = onSnapshot(facilitiesQuery, (snapshot) => {
            const facilities = [];
            snapshot.forEach((doc) => {
                const facilityData = doc.data();
                // Only include active facilities (not soft-deleted)
                if (facilityData.active !== false && !facilityData.deletedAt) {
                    // Always use Firestore document ID, remove any id field from data
                    const { id: dataId, ...cleanFacilityData } = facilityData;
                    facilities.push({ 
                        id: doc.id,  // Always use Firestore document ID
                        customId: dataId, // Store original custom ID if it exists
                        ...cleanFacilityData 
                    });
                }
            });

            this.currentFacilities = facilities;
            this.renderFacilities(facilities);
            this.updateStats(facilities);
            console.log(`Loaded ${facilities.length} facilities from MyRepData-compatible collection`);
            
            // Trigger tray re-render when facilities are loaded/updated
            if (window.app.trayManager && facilities.length > 0) {
                window.app.trayManager.onFacilitiesLoaded();
            }
        }, (error) => {
            console.error('Error listening to facilities:', error);
        });
    }

    renderFacilities(facilities) {
        if (this.viewMode === 'card') {
            this.renderCardView(facilities);
        } else {
            this.renderListView(facilities);
        }
    }

    renderCardView(facilities) {
        const container = document.getElementById('facilityCardView');
        if (!container) return;

        if (facilities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-building"></i>
                    </div>
                    <h3>No Facilities Found</h3>
                    <p>Start by adding medical facilities, ASCs, and hospitals to your network.</p>
                    <button class="btn-primary-custom" onclick="app.modalManager.showAddFacilityModal()">
                        <i class="fas fa-plus"></i> Add First Facility
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        facilities.forEach(facility => {
            const facilityCard = this.createFacilityCard(facility);
            container.appendChild(facilityCard);
        });
    }

    renderListView(facilities) {
        const facilityHorizontalCards = document.getElementById('facilityHorizontalCards');
        if (!facilityHorizontalCards) return;
        
        if (facilities.length === 0) {
            facilityHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-building fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No facilities found. Add a new facility to get started.</p>
                </div>
            `;
            return;
        }
        
        facilityHorizontalCards.innerHTML = '';
        facilities.forEach(facility => {
            const facilityCard = this.createHorizontalFacilityCard(facility);
            facilityHorizontalCards.appendChild(facilityCard);
        });
    }

    createFacilityCard(facility) {
        const card = document.createElement('div');
        card.className = 'location-card';
        
        const typeIcon = getFacilityTypeIcon(facility.type);
        const statusText = facility.active ? 'Active' : 'Inactive';
        const statusClass = facility.active ? 'status-available' : 'status-in-use';
        
        card.innerHTML = `
            <div class="location-card-header">
                <div class="location-card-title">
                    <div class="location-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    ${facility.name || 'Unnamed Facility'}
                </div>
                <span class="tray-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="location-card-content">
                <div class="location-detail">
                    <i class="fas fa-building"></i>
                    <span class="location-detail-value">${getFacilityTypeLabel(facility.type)}</span>
                </div>
                ${facility.address ? `
                    <div class="location-detail">
                        <i class="fas fa-road"></i>
                        <span class="location-detail-value">${facility.address}</span>
                    </div>
                ` : ''}
                <div class="location-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="location-detail-value">${facility.city || ''}, ${facility.state || ''}</span>
                </div>
                ${facility.phone ? `
                    <div class="location-detail">
                        <i class="fas fa-phone"></i>
                        <span class="location-detail-value">${facility.phone}</span>
                    </div>
                ` : `
                    <div class="location-detail">
                        <i class="fas fa-phone"></i>
                        <span class="location-detail-empty">No phone</span>
                    </div>
                `}
                ${facility.contact?.primary ? `
                    <div class="location-detail">
                        <i class="fas fa-user"></i>
                        <span class="location-detail-value">${facility.contact.primary}</span>
                    </div>
                ` : `
                    <div class="location-detail">
                        <i class="fas fa-user"></i>
                        <span class="location-detail-empty">No contact</span>
                    </div>
                `}
                ${facility.territory ? `
                    <div class="location-detail">
                        <i class="fas fa-map"></i>
                        <span class="location-detail-value">${facility.territory}</span>
                    </div>
                ` : `
                    <div class="location-detail">
                        <i class="fas fa-map"></i>
                        <span class="location-detail-empty">No territory</span>
                    </div>
                `}
                ${facility.specialty ? `
                    <div class="location-detail">
                        <i class="fas fa-stethoscope"></i>
                        <span class="location-detail-value">${facility.specialty}</span>
                    </div>
                ` : ''}
            </div>
            <div class="location-card-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditFacilityModal('${facility.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.facilityManager.deleteFacility('${facility.id}', '${facility.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        return card;
    }

    createHorizontalFacilityCard(facility) {
        const card = document.createElement('div');
        card.className = 'location-horizontal-card';

        const statusText = facility.active ? 'Active' : 'Inactive';
        const statusClass = facility.active ? 'status-available' : 'status-in-use';
        const typeIcon = getFacilityTypeIcon(facility.type);

        card.innerHTML = `
            <div class="location-horizontal-header">
                <div class="location-horizontal-title">
                    <div class="location-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div>
                        <h6>${facility.name || 'Unnamed Facility'}</h6>
                        <small class="text-muted">${getFacilityTypeLabel(facility.type)}</small>
                    </div>
                </div>
                <div class="location-horizontal-status">
                    <span class="tray-status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="location-horizontal-body">
                <div class="location-horizontal-field">
                    <label>Address</label>
                    <span>${facility.address || 'No address provided'}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>City, State</label>
                    <span>${facility.city || ''}, ${facility.state || ''} ${facility.zip || ''}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>Contact</label>
                    <span class="${!facility.contact?.primary ? 'empty-value' : ''}">${facility.contact?.primary || 'Not assigned'}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>Territory</label>
                    <span class="${!facility.territory ? 'empty-value' : ''}">${facility.territory || 'Not assigned'}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>Specialty</label>
                    <span class="${!facility.specialty ? 'empty-value' : ''}">${facility.specialty || 'General'}</span>
                </div>
            </div>
            
            <div class="location-horizontal-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditFacilityModal('${facility.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.facilityManager.deleteFacility('${facility.id}', '${facility.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    }

    updateStats(facilities) {
        const totalCount = document.getElementById('totalFacilitiesCount');
        const ascCount = document.getElementById('ascCount');
        const hospitalCount = document.getElementById('hospitalCount');
        const oblCount = document.getElementById('oblCount');

        if (totalCount) totalCount.textContent = facilities.length;

        const stats = {
            ASC: 0,
            Hospital: 0,
            OBL: 0
        };

        facilities.forEach(facility => {
            if (stats[facility.type] !== undefined) {
                stats[facility.type]++;
            }
        });

        if (ascCount) ascCount.textContent = stats.ASC;
        if (hospitalCount) hospitalCount.textContent = stats.Hospital;
        if (oblCount) oblCount.textContent = stats.OBL;
    }

    async addFacility() {
        try {
            // Check if all required elements exist
            const requiredFields = [
                'facilityName', 'facilityType', 'facilityAddress', 
                'facilityCity', 'facilityState', 'facilityZip'
            ];
            
            for (const fieldId of requiredFields) {
                const element = document.getElementById(fieldId);
                if (!element) {
                    throw new Error(`Required field '${fieldId}' not found in form`);
                }
                if (!element.value.trim()) {
                    throw new Error(`${fieldId.replace('facility', '').replace(/([A-Z])/g, ' $1').trim()} is required`);
                }
            }
            
            // Check database connection
            if (!this.db) {
                throw new Error('Database connection not available');
            }
            
            const facility = {
                id: document.getElementById('facilityId').value.trim() || null,
                name: document.getElementById('facilityName').value.trim(),
                type: document.getElementById('facilityType').value,
                specialty: document.getElementById('facilitySpecialty').value,
                address: document.getElementById('facilityAddress').value.trim(),
                city: document.getElementById('facilityCity').value.trim(),
                state: document.getElementById('facilityState').value.trim(),
                zip: document.getElementById('facilityZip').value.trim(),
                phone: document.getElementById('facilityPhone').value.trim(),
                territory: document.getElementById('facilityTerritory').value,
                priority: parseInt(document.getElementById('facilityPriority').value) || 3,
                contact: {
                    primary: document.getElementById('facilityContact').value.trim(),
                    email: document.getElementById('facilityContactEmail').value.trim()
                },
                npi: document.getElementById('facilityNPI').value.trim(),
                notes: document.getElementById('facilityNotes').value.trim(),
                active: document.getElementById('facilityActive').checked,
                latitude: parseFloat(document.getElementById('facilityLatitude').value) || null,
                longitude: parseFloat(document.getElementById('facilityLongitude').value) || null,
                createdAt: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid || 'system',
                modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system',
                lastModified: serverTimestamp()
            };

            // Basic validation
            if (!facility.name) {
                throw new Error('Facility name is required');
            }
            if (!facility.type) {
                throw new Error('Facility type is required');
            }
            if (!facility.city) {
                throw new Error('City is required');
            }
            if (!facility.state) {
                throw new Error('State is required');
            }

            // Handle custom ID vs auto-generated ID
            if (facility.id) {
                // Use custom ID as document ID
                const facilityWithoutId = { ...facility };
                delete facilityWithoutId.id; // Remove id field since it becomes the document ID
                await setDoc(doc(this.db, this.collectionName, facility.id), facilityWithoutId);
            } else {
                // Auto-generate document ID
                await addDoc(collection(this.db, this.collectionName), facility);
            }
            
            // Close modal
            const modal = document.getElementById('addFacilityModal');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }

            // Reset form
            document.getElementById('addFacilityForm').reset();
            document.getElementById('facilityActive').checked = true;
            
            window.app.notificationManager.show('Facility added successfully', 'success');
            console.log('Facility added to MyRepData-compatible collection');
        } catch (error) {
            console.error('Error adding facility:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            window.app.notificationManager.show(`Error adding facility: ${errorMessage}`, 'error');
        }
    }

    async updateFacility() {
        try {
            const facilityId = document.getElementById('editFacilityId').value;
            
            // Verify the facility exists in our current facilities list
            const existingFacility = this.currentFacilities.find(f => f.id === facilityId);
            if (!existingFacility) {
                throw new Error(`Facility with ID '${facilityId}' not found`);
            }
            
            const updates = {
                name: document.getElementById('editFacilityName').value.trim(),
                type: document.getElementById('editFacilityType').value,
                specialty: document.getElementById('editFacilitySpecialty').value,
                address: document.getElementById('editFacilityAddress').value.trim(),
                city: document.getElementById('editFacilityCity').value.trim(),
                state: document.getElementById('editFacilityState').value.trim(),
                zip: document.getElementById('editFacilityZip').value.trim(),
                phone: document.getElementById('editFacilityPhone').value.trim(),
                territory: document.getElementById('editFacilityTerritory').value,
                priority: parseInt(document.getElementById('editFacilityPriority').value) || 3,
                contact: {
                    primary: document.getElementById('editFacilityContact').value.trim(),
                    email: document.getElementById('editFacilityContactEmail').value.trim()
                },
                npi: document.getElementById('editFacilityNPI').value.trim(),
                notes: document.getElementById('editFacilityNotes').value.trim(),
                active: document.getElementById('editFacilityActive').checked,
                latitude: parseFloat(document.getElementById('editFacilityLatitude').value) || null,
                longitude: parseFloat(document.getElementById('editFacilityLongitude').value) || null,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
            };

            // Basic validation
            if (!updates.name) {
                throw new Error('Facility name is required');
            }
            if (!updates.type) {
                throw new Error('Facility type is required');
            }
            if (!updates.city) {
                throw new Error('City is required');
            }
            if (!updates.state) {
                throw new Error('State is required');
            }

            await updateDoc(doc(this.db, this.collectionName, facilityId), updates);
            
            // Close modal
            const modal = document.getElementById('editFacilityModal');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }
            
            window.app.notificationManager.show('Facility updated successfully', 'success');
            console.log('Facility updated in MyRepData-compatible collection');
        } catch (error) {
            console.error('Error updating facility:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            window.app.notificationManager.show(`Error updating facility: ${errorMessage}`, 'error');
        }
    }

    async deleteFacility(facilityId, facilityName) {
        if (!confirm(`Are you sure you want to delete "${facilityName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            // Soft delete - set deletedAt timestamp
            await updateDoc(doc(this.db, this.collectionName, facilityId), {
                deletedAt: serverTimestamp(),
                active: false,
                modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system',
                lastModified: serverTimestamp()
            });
            
            window.app.notificationManager.show('Facility deleted successfully', 'success');
            console.log('Facility soft-deleted from MyRepData-compatible collection');
        } catch (error) {
            console.error('Error deleting facility:', error);
            window.app.notificationManager.show(`Error deleting facility: ${error.message}`, 'error');
        }
    }

    async initializeDefaults() {
        try {
            // Use the defaults from our MyRepData-compatible FacilityModel
            const defaults = [
                {
                    name: 'Advanced Spine Center',
                    type: 'ASC',
                    specialty: 'Ortho Spine',
                    address: '123 Medical Drive',
                    city: 'Milwaukee',
                    state: 'WI',
                    zip: '53201',
                    phone: '+1-555-0456',
                    territory: 'Wisconsin East',
                    priority: 1,
                    contact: {
                        primary: 'Sarah Johnson, OR Manager',
                        email: 'sarah.johnson@advancedspine.com'
                    },
                    latitude: 43.0389,
                    longitude: -87.9065,
                    notes: 'Premier outpatient spine surgery center'
                },
                {
                    name: 'Aurora Medical Center - Grafton',
                    type: 'Hospital',
                    specialty: 'Ortho',
                    address: '975 Port Washington Rd',
                    city: 'Grafton',
                    state: 'WI',
                    zip: '53024',
                    phone: '+1-262-329-1000',
                    territory: 'Wisconsin East',
                    priority: 1,
                    contact: {
                        primary: 'Jennifer Martinez, Surgical Coordinator',
                        email: 'jennifer.martinez@aurora.org'
                    },
                    latitude: 43.3239,
                    longitude: -87.9511,
                    notes: 'Full-service hospital with advanced spine services'
                },
                {
                    name: 'Pain Management Associates',
                    type: 'OBL',
                    specialty: 'Pain Management',
                    address: '456 Wellness Blvd',
                    city: 'Madison',
                    state: 'WI',
                    zip: '53719',
                    phone: '+1-608-555-0123',
                    territory: 'Wisconsin West',
                    priority: 3,
                    contact: {
                        primary: 'Dr. Lisa Thompson, Medical Director',
                        email: 'lisa.thompson@painmgmt.com'
                    },
                    latitude: 43.0731,
                    longitude: -89.4012,
                    notes: 'Specialized pain management and interventional procedures'
                }
            ];

            const createdBy = window.app.authManager.getCurrentUser()?.uid || 'system';
            
            for (const defaultFacility of defaults) {
                const facilityWithMeta = {
                    ...defaultFacility,
                    active: true,
                    createdAt: serverTimestamp(),
                    createdBy,
                    modifiedBy: createdBy,
                    lastModified: serverTimestamp()
                };
                
                await addDoc(collection(this.db, this.collectionName), facilityWithMeta);
            }
            
            window.app.notificationManager.show(`Initialized ${defaults.length} MyRepData-compatible facilities`, 'success');
            console.log('Default facilities initialized with MyRepData structure');
        } catch (error) {
            console.error('Error initializing default facilities:', error);
            window.app.notificationManager.show(`Error initializing facilities: ${error.message}`, 'error');
        }
    }

    // Facility type functions moved to constants/FacilityTypes.js for central management

    cleanup() {
        if (this.facilitiesUnsubscribe) {
            this.facilitiesUnsubscribe();
        }
    }
}