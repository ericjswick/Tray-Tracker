// js/LocationManager.js
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class LocationManager {
    constructor(db) {
        this.db = db;
        this.currentLocations = [];
        this.viewMode = this.getStoredViewMode();
        this.locationsUnsubscribe = null;
    }

    getStoredViewMode() {
        return localStorage.getItem('locationViewMode') || 'list';
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('locationViewMode', mode);

        const cardBtn = document.getElementById('locationCardViewBtn');
        const listBtn = document.getElementById('locationListViewBtn');

        if (mode === 'card') {
            cardBtn?.classList.add('active');
            listBtn?.classList.remove('active');
            document.getElementById('locationCardView')?.classList.remove('d-none');
            document.getElementById('locationListView')?.classList.add('d-none');
        } else {
            listBtn?.classList.add('active');
            cardBtn?.classList.remove('active');
            document.getElementById('locationCardView')?.classList.add('d-none');
            document.getElementById('locationListView')?.classList.remove('d-none');
        }

        this.renderLocations(this.currentLocations);
    }

    initializeViewMode() {
        this.setViewMode(this.viewMode);
        this.setupRealtimeListeners();

        // Show loading state initially
        this.showLoadingState();
    }

    showLoadingState() {
        const locationCardView = document.getElementById('locationCardView');
        const locationListView = document.getElementById('locationListView');

        if (locationCardView) {
            locationCardView.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading locations...</p>
                </div>
            `;
        }

        if (locationListView) {
            const locationHorizontalCards = document.getElementById('locationHorizontalCards');
            if (locationHorizontalCards) {
                locationHorizontalCards.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
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

            alert('Location added successfully!');
        } catch (error) {
            console.error('Error adding location:', error);
            alert('Error adding location: ' + error.message);
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

            alert('Location updated successfully!');
        } catch (error) {
            console.error('Error updating location:', error);
            alert('Error updating location: ' + error.message);
        }
    }

    async deleteLocation(locationId, locationName) {
        if (!confirm(`Are you sure you want to delete location "${locationName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(this.db, 'locations', locationId));
            alert('Location deleted successfully!');
        } catch (error) {
            console.error('Error deleting location:', error);
            alert('Error deleting location: ' + error.message);
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

        if (locations.length === 0) {
            locationCardView.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No locations found. Add a new location to get started.</p>
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

        if (locations.length === 0) {
            locationHorizontalCards.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-map-marker-alt fa-3x mb-3 opacity-50"></i>
                    <p class="mb-0">No locations found. Add a new location to get started.</p>
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
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-3';

        const typeClass = this.getTypeClass(location.type);
        const statusClass = location.active ? 'text-success' : 'text-danger';
        const statusText = location.active ? 'Active' : 'Inactive';
        const typeIcon = this.getTypeIcon(location.type);

        col.innerHTML = `
            <div class="card location-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-start mb-3">
                        <div class="location-icon me-3">
                            <i class="${typeIcon}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-1">${location.name}</h6>
                            <p class="card-text text-muted mb-1">${this.getTypeText(location.type)}</p>
                            <small class="${statusClass}">
                                <i class="fas fa-circle"></i> ${statusText}
                            </small>
                        </div>
                    </div>
                    <div class="location-details">
                        <p class="mb-1">
                            <small class="text-muted">
                                <i class="fas fa-map-marker-alt me-2"></i>${location.city}, ${location.state}
                            </small>
                        </p>
                        ${location.phone ? `<p class="mb-1">
                            <small class="text-muted">
                                <i class="fas fa-phone me-2"></i>${location.phone}
                            </small>
                        </p>` : ''}
                        ${location.contact ? `<p class="mb-1">
                            <small class="text-muted">
                                <i class="fas fa-user me-2"></i>${location.contact}
                            </small>
                        </p>` : ''}
                        ${location.region ? `<p class="mb-2">
                            <small class="text-muted">
                                <i class="fas fa-globe me-2"></i>${location.region}
                            </small>
                        </p>` : ''}
                    </div>
                    <div class="mt-auto">
                        <div class="btn-group w-100" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="app.modalManager.showEditLocationModal('${location.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="app.locationManager.deleteLocation('${location.id}', '${location.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return col;
    }

    createHorizontalLocationCard(location) {
        const card = document.createElement('div');
        card.className = 'location-horizontal-card';

        const statusText = location.active ? 'Active' : 'Inactive';
        const typeIcon = this.getTypeIcon(location.type);

        card.innerHTML = `
            <div class="location-horizontal-header">
                <div class="location-horizontal-title">
                    <div class="location-icon-horizontal">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div>
                        <h6>${location.name}</h6>
                        <small class="text-muted">${this.getTypeText(location.type)}</small>
                    </div>
                </div>
                <div class="location-horizontal-status">
                    <span class="badge ${location.active ? 'bg-success' : 'bg-danger'}">${statusText}</span>
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
                <button class="btn btn-sm btn-outline-primary" onclick="app.modalManager.showEditLocationModal('${location.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="app.locationManager.deleteLocation('${location.id}', '${location.name}')">
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

    getTypeClass(type) {
        const typeClasses = {
            'medical_facility': 'bg-primary',
            'corporate': 'bg-success',
            'warehouse': 'bg-warning',
            'rep_office': 'bg-info'
        };
        return typeClasses[type] || 'bg-secondary';
    }

    updateStats(locations) {
        const stats = {
            total: locations.length,
            facilities: locations.filter(l => l.type === 'medical_facility').length,
            corporate: locations.filter(l => l.type === 'corporate').length
        };

        document.getElementById('totalLocationsCount').textContent = stats.total;
        document.getElementById('facilitiesCount').textContent = stats.facilities;
        document.getElementById('corporateLocationsCount').textContent = stats.corporate;
    }

    cleanup() {
        if (this.locationsUnsubscribe) {
            this.locationsUnsubscribe();
        }
    }
}