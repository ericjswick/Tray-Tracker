// js/LocationManager.js - Updated for Tray Tracker
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class LocationManager {
    constructor(db) {
        this.db = db;
        this.currentLocations = [];
        this.viewMode = this.getStoredViewMode();
        this.locationsUnsubscribe = null;
    }

    getStoredViewMode() {
        return localStorage.getItem('locationViewMode') || 'card';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('locationViewMode', mode);

        const cardBtn = document.getElementById('locationCardViewBtn');
        const listBtn = document.getElementById('locationListViewBtn');

        if (cardBtn && listBtn) {
            if (mode === 'card') {
                cardBtn.classList.add('active');
                listBtn.classList.remove('active');
            } else {
                listBtn.classList.add('active');
                cardBtn.classList.remove('active');
            }
        }

        const cardView = document.getElementById('locationCardView');
        const listView = document.getElementById('locationListView');

        if (cardView && listView) {
            if (mode === 'card') {
                cardView.classList.remove('d-none');
                listView.classList.add('d-none');
            } else {
                cardView.classList.add('d-none');
                listView.classList.remove('d-none');
            }
        }

        this.renderLocations(this.currentLocations);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        this.setupRealtimeListeners();
        this.showLoadingState();
    }

    showLoadingState() {
        const locationCardView = document.getElementById('locationCardView');
        const locationListView = document.getElementById('locationListView');

        if (locationCardView) {
            locationCardView.innerHTML = `
                <div class="loading-state">
                    <div class="spinner-border" role="status"></div>
                    <p class="mt-2">Loading locations...</p>
                </div>
            `;
        }

        if (locationListView) {
            const locationHorizontalCards = document.getElementById('locationHorizontalCards');
            if (locationHorizontalCards) {
                locationHorizontalCards.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner-border" role="status"></div>
                        <p class="mt-2">Loading locations...</p>
                    </div>
                `;
            }
        }
    }

    setupRealtimeListeners() {
        if (!this.db) return;

        const locationsQuery = query(collection(this.db, 'locations'), orderBy('createdAt', 'desc'));
        this.locationsUnsubscribe = onSnapshot(locationsQuery, (snapshot) => {
            const locations = [];
            snapshot.forEach((doc) => {
                locations.push({ id: doc.id, ...doc.data() });
            });

            this.handleLocationsUpdate(locations);
        }, (error) => {
            console.error('Error listening to locations:', error);
        });
    }

    async addLocation() {
        try {
            const location = {
                name: document.getElementById('locationName').value,
                type: document.getElementById('locationType').value,
                address: document.getElementById('locationAddress').value,
                city: document.getElementById('locationCity').value,
                state: document.getElementById('locationState').value,
                zip: document.getElementById('locationZip').value,
                phone: document.getElementById('locationPhone').value,
                contact: document.getElementById('locationContact').value,
                region: document.getElementById('locationRegion').value,
                latitude: parseFloat(document.getElementById('locationLatitude').value) || null,
                longitude: parseFloat(document.getElementById('locationLongitude').value) || null,
                notes: document.getElementById('locationNotes').value,
                active: document.getElementById('locationActive').checked,
                createdAt: serverTimestamp(),
                createdBy: window.app.authManager.getCurrentUser()?.uid,
                isDemoLocation: false
            };

            await addDoc(collection(this.db, 'locations'), location);

            bootstrap.Modal.getInstance(document.getElementById('addLocationModal')).hide();
            document.getElementById('addLocationForm').reset();

            this.showSuccessNotification('Location added successfully!');
        } catch (error) {
            console.error('Error adding location:', error);
            this.showErrorNotification('Error adding location: ' + error.message);
        }
    }

    async updateLocation() {
        try {
            const locationId = document.getElementById('editLocationId').value;

            const updates = {
                name: document.getElementById('editLocationName').value,
                type: document.getElementById('editLocationType').value,
                address: document.getElementById('editLocationAddress').value,
                city: document.getElementById('editLocationCity').value,
                state: document.getElementById('editLocationState').value,
                zip: document.getElementById('editLocationZip').value,
                phone: document.getElementById('editLocationPhone').value,
                contact: document.getElementById('editLocationContact').value,
                region: document.getElementById('editLocationRegion').value,
                latitude: parseFloat(document.getElementById('editLocationLatitude').value) || null,
                longitude: parseFloat(document.getElementById('editLocationLongitude').value) || null,
                notes: document.getElementById('editLocationNotes').value,
                active: document.getElementById('editLocationActive').checked,
                lastModified: serverTimestamp(),
                modifiedBy: window.app.authManager.getCurrentUser()?.uid
            };

            await updateDoc(doc(this.db, 'locations', locationId), updates);

            bootstrap.Modal.getInstance(document.getElementById('editLocationModal')).hide();
            this.showSuccessNotification('Location updated successfully!');
        } catch (error) {
            console.error('Error updating location:', error);
            this.showErrorNotification('Error updating location: ' + error.message);
        }
    }

    async deleteLocation(locationId, locationName) {
        if (!confirm(`Are you sure you want to delete location "${locationName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(this.db, 'locations', locationId));
            this.showSuccessNotification('Location deleted successfully!');
        } catch (error) {
            console.error('Error deleting location:', error);
            this.showErrorNotification('Error deleting location: ' + error.message);
        }
    }

    handleLocationsUpdate(locations) {
        console.log('LocationManager received locations update:', locations.length);
        this.currentLocations = locations;
        this.renderLocations(locations);
        this.updateStats(locations);

        // Update facilities in DataManager for tray forms
        if (window.app.dataManager) {
            const facilityNames = locations
                .filter(loc => loc.type === 'medical_facility' && loc.active)
                .map(loc => loc.name);
            window.app.dataManager.facilities = facilityNames;
        }
    }

    renderLocations(locations) {
        if (this.viewMode === 'card') {
            this.renderCardView(locations);
        } else {
            this.renderListView(locations);
        }
    }

    renderCardView(locations) {
        const locationCardView = document.getElementById('locationCardView');
        if (!locationCardView) return;

        if (locations.length === 0) {
            locationCardView.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-map-marker-alt fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No locations found. Add a new location to get started.</p>
                </div>
            `;
            return;
        }

        locationCardView.innerHTML = '';
        locations.forEach(location => {
            const locationCard = this.createLocationCard(location);
            locationCardView.appendChild(locationCard);
        });
    }

    renderListView(locations) {
        const locationHorizontalCards = document.getElementById('locationHorizontalCards');
        if (!locationHorizontalCards) return;

        if (locations.length === 0) {
            locationHorizontalCards.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-map-marker-alt fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No locations found. Add a new location to get started.</p>
                </div>
            `;
            return;
        }

        locationHorizontalCards.innerHTML = '';
        locations.forEach(location => {
            const locationCard = this.createHorizontalLocationCard(location);
            locationHorizontalCards.appendChild(locationCard);
        });
    }

    createLocationCard(location) {
        const card = document.createElement('div');
        card.className = 'location-card';

        const typeIcon = this.getTypeIcon(location.type);
        const statusText = location.active ? 'Active' : 'Inactive';
        const statusClass = location.active ? 'status-available' : 'status-in-use';

        card.innerHTML = `
            <div class="location-card-header">
                <div class="location-card-title">
                    <div class="location-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    ${location.name}
                </div>
                <span class="tray-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="location-card-content">
                <div class="location-detail">
                    <i class="fas fa-building"></i>
                    <span class="location-detail-value">${this.getTypeText(location.type)}</span>
                </div>
                <div class="location-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="location-detail-value">${location.city}, ${location.state}</span>
                </div>
                ${location.phone ? `
                    <div class="location-detail">
                        <i class="fas fa-phone"></i>
                        <span class="location-detail-value">${location.phone}</span>
                    </div>
                ` : `
                    <div class="location-detail">
                        <i class="fas fa-phone"></i>
                        <span class="location-detail-empty">No phone</span>
                    </div>
                `}
                ${location.contact ? `
                    <div class="location-detail">
                        <i class="fas fa-user"></i>
                        <span class="location-detail-value">${location.contact}</span>
                    </div>
                ` : `
                    <div class="location-detail">
                        <i class="fas fa-user"></i>
                        <span class="location-detail-empty">No contact</span>
                    </div>
                `}
                ${location.region ? `
                    <div class="location-detail">
                        <i class="fas fa-globe"></i>
                        <span class="location-detail-value">${location.region}</span>
                    </div>
                ` : ''}
            </div>
            <div class="location-card-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditLocationModal('${location.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.locationManager.deleteLocation('${location.id}', '${location.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    }

    createHorizontalLocationCard(location) {
        const card = document.createElement('div');
        card.className = 'location-horizontal-card';

        const statusText = location.active ? 'Active' : 'Inactive';
        const statusClass = location.active ? 'status-available' : 'status-in-use';
        const typeIcon = this.getTypeIcon(location.type);

        card.innerHTML = `
            <div class="location-horizontal-header">
                <div class="location-horizontal-title">
                    <div class="location-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div>
                        <h6>${location.name}</h6>
                        <small class="text-muted">${this.getTypeText(location.type)}</small>
                    </div>
                </div>
                <div class="location-horizontal-status">
                    <span class="tray-status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="location-horizontal-body">
                <div class="location-horizontal-field">
                    <label>Address</label>
                    <span>${location.address}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>City, State</label>
                    <span>${location.city}, ${location.state} ${location.zip}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>Contact</label>
                    <span class="${!location.contact ? 'empty-value' : ''}">${location.contact || 'Not assigned'}</span>
                </div>
                <div class="location-horizontal-field">
                    <label>Region</label>
                    <span class="${!location.region ? 'empty-value' : ''}">${location.region || 'Not assigned'}</span>
                </div>
            </div>
            
            <div class="location-horizontal-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditLocationModal('${location.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.locationManager.deleteLocation('${location.id}', '${location.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    }

    getTypeIcon(type) {
        const typeIcons = {
            'medical_facility': 'fas fa-hospital',
            'corporate': 'fas fa-building',
            'warehouse': 'fas fa-warehouse',
            'rep_office': 'fas fa-briefcase'
        };
        return typeIcons[type] || 'fas fa-map-marker-alt';
    }

    getTypeText(type) {
        const typeTexts = {
            'medical_facility': 'Medical Facility',
            'corporate': 'Corporate Office',
            'warehouse': 'Warehouse',
            'rep_office': 'Rep Office'
        };
        return typeTexts[type] || type;
    }

    updateStats(locations) {
        const stats = {
            total: locations.length,
            facilities: locations.filter(l => l.type === 'medical_facility').length,
            corporate: locations.filter(l => l.type === 'corporate').length
        };

        const totalElement = document.getElementById('totalLocationsCount');
        const facilitiesElement = document.getElementById('facilitiesCount');
        const corporateElement = document.getElementById('corporateLocationsCount');

        if (totalElement) totalElement.textContent = stats.total;
        if (facilitiesElement) facilitiesElement.textContent = stats.facilities;
        if (corporateElement) corporateElement.textContent = stats.corporate;
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
        if (this.locationsUnsubscribe) {
            this.locationsUnsubscribe();
        }
    }
}