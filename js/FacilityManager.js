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
    }

    setupRealtimeListener() {
        if (this.facilitiesUnsubscribe) {
            this.facilitiesUnsubscribe();
        }

        const facilitiesQuery = query(collection(this.db, this.collectionName), orderBy('account_name', 'asc'));
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
        
        const typeIcon = getFacilityTypeIcon(facility.account_record_type);
        const statusText = facility.active ? 'Active' : 'Inactive';
        const statusClass = facility.active ? 'status-available' : 'status-in-use';
        
        card.innerHTML = `
            <div class="location-card-header">
                <div class="location-card-title">
                    <div class="location-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    ${facility.account_name || 'Unnamed Facility'}
                </div>
                <span class="tray-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="location-card-content">
                <div class="location-detail">
                    <i class="fas fa-building"></i>
                    <span class="location-detail-value">${getFacilityTypeLabel(facility.account_record_type)}</span>
                </div>
                ${facility.address?.street ? `
                    <div class="location-detail">
                        <i class="fas fa-road"></i>
                        <span class="location-detail-value">${facility.address?.street}</span>
                    </div>
                ` : ''}
                <div class="location-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="location-detail-value">${facility.address?.city || ''}, ${facility.address?.state || ''}</span>
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
            </div>
        `;
        
        return card;
    }

    createHorizontalFacilityCard(facility) {
        const card = document.createElement('div');
        card.className = 'location-horizontal-card';

        const statusText = facility.active ? 'Active' : 'Inactive';
        const statusClass = facility.active ? 'status-available' : 'status-in-use';
        const typeIcon = getFacilityTypeIcon(facility.account_record_type);

        card.innerHTML = `
            <div class="location-horizontal-header">
                <div class="location-horizontal-title">
                    <div class="location-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div>
                        <h6>${facility.account_name || 'Unnamed Facility'}</h6>
                        <small class="text-muted">${getFacilityTypeLabel(facility.account_record_type)}</small>
                    </div>
                </div>
                <div class="location-horizontal-status">
                    <span class="tray-status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="location-horizontal-body">
                <div class="location-horizontal-field">
                    <label>Address</label>
                    <span>${facility.address?.street || 'No address provided'}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>City, State</label>
                    <span>${facility.address?.city || ''}, ${facility.address?.state || ''} ${facility.address?.zip || ''}</span>
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
            if (stats[facility.account_record_type] !== undefined) {
                stats[facility.account_record_type]++;
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
            
            const facilityData = {
                account_name: document.getElementById('facilityName').value.trim(),
                account_record_type: document.getElementById('facilityType').value,
                specialty: document.getElementById('facilitySpecialty').value,
                address: {
                    street: document.getElementById('facilityAddress').value.trim(),
                    city: document.getElementById('facilityCity').value.trim(),
                    state: document.getElementById('facilityState').value.trim(),
                    zip: document.getElementById('facilityZip').value.trim()
                },
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
                is_corporate_headquarters: document.getElementById('facilityCorporateHQ').checked,
                latitude: parseFloat(document.getElementById('facilityLatitude').value) || null,
                longitude: parseFloat(document.getElementById('facilityLongitude').value) || null,
                createdAt: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid || 'system',
                modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system',
                lastModified: serverTimestamp()
            };

            // Basic validation
            if (!facilityData.account_name) {
                throw new Error('Facility account name is required');
            }
            if (!facilityData.account_record_type) {
                throw new Error('Facility account record type is required');
            }
            if (!facilityData.address?.city) {
                throw new Error('City is required');
            }
            if (!facilityData.address?.state) {
                throw new Error('State is required');
            }

            // Get custom ID if provided
            const customId = document.getElementById('facilityId').value.trim();
            
            // Check for duplicates
            if (customId) {
                // Check if custom ID already exists
                const existingFacility = this.currentFacilities.find(f => f.id === customId);
                if (existingFacility) {
                    throw new Error(`Facility with ID "${customId}" already exists`);
                }
            }
            
            // Check for duplicate facility names
            const existingName = this.currentFacilities.find(f => 
                f.account_name.toLowerCase() === facilityData.account_name.toLowerCase()
            );
            if (existingName) {
                throw new Error(`Facility with name "${facilityData.account_name}" already exists`);
            }

            // Handle corporate headquarters - only one facility can be corporate HQ
            if (facilityData.is_corporate_headquarters) {
                await this.clearOtherCorporateHeadquarters();
            }

            // Handle custom ID vs auto-generated ID
            if (customId) {
                // Use custom ID as document ID (don't save id field in the document)
                await setDoc(doc(this.db, this.collectionName, customId), facilityData);
            } else {
                // Auto-generate document ID
                await addDoc(collection(this.db, this.collectionName), facilityData);
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
                account_name: document.getElementById('editFacilityName').value.trim(),
                account_record_type: document.getElementById('editFacilityType').value,
                specialty: document.getElementById('editFacilitySpecialty').value,
                address: {
                    street: document.getElementById('editFacilityAddress').value.trim(),
                    city: document.getElementById('editFacilityCity').value.trim(),
                    state: document.getElementById('editFacilityState').value.trim(),
                    zip: document.getElementById('editFacilityZip').value.trim()
                },
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
                is_corporate_headquarters: document.getElementById('editFacilityCorporateHQ').checked,
                latitude: parseFloat(document.getElementById('editFacilityLatitude').value) || null,
                longitude: parseFloat(document.getElementById('editFacilityLongitude').value) || null,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
            };

            // Basic validation
            if (!updates.account_name) {
                throw new Error('Facility account name is required');
            }
            if (!updates.account_record_type) {
                throw new Error('Facility account record type is required');
            }
            if (!updates.address.city) {
                throw new Error('City is required');
            }
            if (!updates.address.state) {
                throw new Error('State is required');
            }

            // Handle corporate headquarters - only one facility can be corporate HQ
            if (updates.is_corporate_headquarters) {
                await this.clearOtherCorporateHeadquarters(facilityId);
            }

            await updateDoc(doc(this.db, this.collectionName, facilityId), updates);
            
            // Close modal
            const modal = document.getElementById('editFacilityModal');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }
            
            window.app.notificationManager.show('Facility updated successfully', 'success');
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
                    account_name: 'Advanced Spine Center',
                    account_record_type: 'ASC',
                    specialty: 'Ortho Spine',
                    address: {
                        street: '123 Medical Drive',
                        city: 'Milwaukee',
                        state: 'WI',
                        zip: '53201'
                    },
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
                    account_name: 'Aurora Medical Center - Grafton',
                    account_record_type: 'Hospital',
                    specialty: 'Ortho',
                    address: {
                        street: '975 Port Washington Rd',
                        city: 'Grafton',
                        state: 'WI',
                        zip: '53024'
                    },
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
                    account_name: 'Pain Management Associates',
                    account_record_type: 'OBL',
                    specialty: 'Pain Management',
                    address: {
                        street: '456 Wellness Blvd',
                        city: 'Madison',
                        state: 'WI',
                        zip: '53719'
                    },
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
        } catch (error) {
            console.error('Error initializing default facilities:', error);
            window.app.notificationManager.show(`Error initializing facilities: ${error.message}`, 'error');
        }
    }

    // Facility type functions moved to constants/FacilityTypes.js for central management

    async clearOtherCorporateHeadquarters(excludeFacilityId = null) {
        try {
                
            // Get all facilities
            const facilitiesSnapshot = await getDocs(collection(this.db, this.collectionName));
            const updatePromises = [];
            
            facilitiesSnapshot.forEach((doc) => {
                const facilityData = doc.data();
                const facilityId = doc.id;
                
                // Skip the facility we're currently updating/creating
                if (facilityId === excludeFacilityId) {
                    return;
                }
                
                // If this facility is marked as corporate headquarters, unmark it
                if (facilityData.is_corporate_headquarters === true) {
                    
                    const updatePromise = updateDoc(doc.ref, {
                        is_corporate_headquarters: false,
                        lastModified: serverTimestamp(),
                        modifiedBy: window.app.authManager.getCurrentUser()?.uid || 'system'
                    });
                    
                    updatePromises.push(updatePromise);
                }
            });
            
            // Wait for all updates to complete
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
            }
            
        } catch (error) {
            console.error('❌ Error clearing other corporate headquarters:', error);
            throw new Error(`Failed to clear other corporate headquarters: ${error.message}`);
        }
    }

    cleanup() {
        if (this.facilitiesUnsubscribe) {
            this.facilitiesUnsubscribe();
        }
    }
}