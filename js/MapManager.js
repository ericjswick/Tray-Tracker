// js/MapManager.js
import { TRAY_STATUS, normalizeStatus, isInUseStatus, isAvailableStatus, getStatusDisplayText } from './constants/TrayStatus.js';
import { TRAY_LOCATIONS, getLocationCoordinatesArray } from './constants/TrayLocations.js';
import { getPhysicianName } from './utils/PhysicianHelper.js';
export class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.spiderfier = null;
        this.mapInitRetries = 0; // Track initialization retries
        this._pendingTrays = null; // Store trays that arrive before map is initialized
        this.facilityLocations = {
            'Aurora Medical Center - Grafton': [43.3239, -87.9511],
            'Aurora Medical Center - Summit': [43.0166, -88.0711],
            'Children\'s Hospital of Wisconsin': [43.0642, -87.8911],
            'Columbia St. Mary\'s Hospital': [43.0481, -87.9073],
            'Froedtert Hospital': [43.0509, -88.0034],
            'Medical College of Wisconsin': [43.0509, -88.0134],
            'Milwaukee Regional Medical Center': [43.0389, -88.0073],
            'ProHealth Waukesha Memorial Hospital': [43.0166, -88.2311],
            'St. Joseph\'s Hospital': [43.0731, -88.0373],
            'University of Wisconsin Hospital': [43.0642, -89.4012]
        };

        // Set up EventBus listeners immediately when MapManager is created
        // This ensures we catch updates even if they fire before map view is displayed
        if (window.eventBus) {
            // Subscribe to tray updates
            this.traysUpdateUnsubscribe = window.eventBus.subscribe('trays-updated', (data) => {
                // Only process if we're on the map view
                if (window.app?.viewManager?.currentView === 'map') {
                    const trays = data?.trays || window.app.trayManager.currentTrays;
                    if (trays && trays.length > 0) {
                        if (this.map) {
                            this.updateMap(trays);
                        } else {
                            this._pendingTrays = trays;
                        }
                    }
                }
            });

            // Subscribe to facility updates - when facilities load, re-render map with current trays
            this.facilitiesUpdateUnsubscribe = window.eventBus.subscribe('facilities-updated', (data) => {
                // When facilities load, re-render the map with current trays
                // This handles the case where trays arrived before facilities
                if (window.app?.viewManager?.currentView === 'map' && this.map) {
                    const trays = window.app.trayManager?.currentTrays;
                    if (trays && trays.length > 0) {
                        this.updateMap(trays);
                    }
                }
            });
        }
    }

    initializeMap() {
        if (this.map) return;

        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('🗺️ Map container not found');
            return;
        }

        // Check if container has proper dimensions
        if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
            this.mapInitRetries++;

            if (this.mapInitRetries < 10) {
                console.warn(`🗺️ Map container has zero dimensions, retry ${this.mapInitRetries}/10`);
                setTimeout(() => this.initializeMap(), 150);
                return;
            } else {
                // After 10 retries, force dimensions
                console.warn('🗺️ Forcing map container dimensions after retry limit');
                mapContainer.style.minHeight = '600px';
                mapContainer.style.height = '100%';
                mapContainer.style.width = '100%';
                // Force reflow
                mapContainer.offsetHeight;
            }
        }

        console.log('🗺️ Initializing map with container dimensions:', {
            width: mapContainer.offsetWidth,
            height: mapContainer.offsetHeight,
            retries: this.mapInitRetries
        });

        try {
            // Initialize map centered on Milwaukee area as default
            const defaultCenter = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK) || [43.0389, -87.9065];
            this.map = L.map('map').setView(defaultCenter, 8);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            // Initialize OverlappingMarkerSpiderfier
            this.initializeSpiderfier();

            // Ensure map renders properly after initialization
            setTimeout(() => {
                if (this.map) {
                    this.map.invalidateSize();
                    console.log('🗺️ Map initialization complete');

                    // Load pending trays if any arrived before map was ready
                    if (this._pendingTrays && this._pendingTrays.length > 0) {
                        console.log('🗺️ Loading', this._pendingTrays.length, 'pending trays that arrived early');
                        this.updateMap(this._pendingTrays);
                        this._pendingTrays = null;
                    }
                }
            }, 100);

        } catch (error) {
            console.error('🗺️ Error initializing map:', error);
        }
    }

    initializeSpiderfier() {
        if (!this.map || typeof OverlappingMarkerSpiderfier === 'undefined') {
            console.warn('🕷️ OverlappingMarkerSpiderfier not available');
            return;
        }

        // Create spiderfier instance with custom options
        this.spiderfier = new OverlappingMarkerSpiderfier(this.map, {
            keepSpiderfied: true, // Keep spiderfied after marker click
            nearbyDistance: 20,   // Distance in pixels to consider markers overlapping
            spiralFootSeparation: 28, // Distance between spiderfied markers
            spiralLengthStart: 15,    // Initial spiral radius
            spiralLengthFactor: 4,    // How much the spiral grows
            circleFootSeparation: 25, // Distance for circular layout
            legWeight: 3,             // Line thickness connecting markers
            legColors: {
                usual: '#222',        // Normal line color
                highlighted: '#f00'   // Highlighted line color
            }
        });

        // Add event listeners for spiderfier events
        this.spiderfier.addListener('click', (marker) => {
            // Trigger the marker's popup when clicked
            marker.openPopup();
        });

        this.spiderfier.addListener('spiderfy', (markers) => {
            console.log(`🕷️ Spiderfied ${markers.length} overlapping markers`);
        });

        this.spiderfier.addListener('unspiderfy', (markers) => {
            console.log(`🕷️ Unspiderfied ${markers.length} markers`);
        });

        console.log('🕷️ OverlappingMarkerSpiderfier initialized');
    }

    clearAllMarkers() {
        // Clear spiderfier markers first
        if (this.spiderfier) {
            this.spiderfier.clearMarkers();
        }

        // Remove all markers from map
        this.markers.forEach(marker => {
            if (this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });

        this.markers = [];
        console.log('🗺️ All markers cleared');
    }

    addMarkerWithSpider(marker) {
        // Add marker to map
        marker.addTo(this.map);

        // Add marker to spiderfier if available
        if (this.spiderfier) {
            this.spiderfier.addMarker(marker);
        }

        // Add to markers array for tracking
        this.markers.push(marker);

        return marker;
    }

    updateMap(trays) {
        console.log('🗺️ updateMap called', {
            mapExists: !!this.map,
            traysCount: trays?.length,
            traysIsArray: Array.isArray(trays)
        });

        if (!this.map) {
            console.error('🗺️ ❌ Cannot update map - map not initialized');
            return;
        }

        if (!trays || !Array.isArray(trays)) {
            console.error('🗺️ ❌ Invalid trays data:', trays);
            return;
        }

        // Clear existing markers
        this.clearAllMarkers();

        // Apply filters
        const availabilityFilter = document.getElementById('trayStatusFilter')?.value || '';
        const typeFilter = document.getElementById('typeFilter')?.value || '';
        const searchTerm = document.getElementById('locationSearch')?.value.toLowerCase() || '';

        const filteredTrays = trays.filter(tray => {
            // Search filter (tray name or facility) - same logic as addFilteredTrayMarkers
            if (searchTerm && 
                !tray.tray_name?.toLowerCase().includes(searchTerm) && 
                !tray.facility?.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            if (availabilityFilter && tray.status !== availabilityFilter) return false;
            if (typeFilter) {
                // Support both legacy type and MyRepData case type compatibility
                let hasMatchingType = false;
                if (tray.case_type_compatibility && Array.isArray(tray.case_type_compatibility)) {
                    hasMatchingType = tray.case_type_compatibility.includes(typeFilter);
                } else if (tray.type) {
                    hasMatchingType = tray.type === typeFilter;
                }
                if (!hasMatchingType) return false;
            }
            return true;
        });

        filteredTrays.forEach(tray => {
            try {
                let position;

                // Handle standard TrayTracker locations
                if (tray.location === TRAY_LOCATIONS.FACILITY && tray.facility && this.facilityLocations[tray.facility]) {
                    position = this.facilityLocations[tray.facility];
                } else if (tray.location === TRAY_LOCATIONS.CORPORATE) {
                    position = getLocationCoordinatesArray(TRAY_LOCATIONS.CORPORATE);
                } else if (tray.location === TRAY_LOCATIONS.TRUNK) {
                    position = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK);
                }
                // Handle legacy MyRepData format where location is a facility ID
                else if (tray.location && typeof tray.location === 'string' && tray.location.length > 10) {
                    // Location appears to be a document ID, try to find facility
                    const facilities = window.app.facilityManager?.currentFacilities || [];
                    const facility = facilities.find(f => f.id === tray.location || f.id === tray.facility);
                    if (facility && facility.latitude && facility.longitude) {
                        position = [facility.latitude, facility.longitude];
                    }
                }

                if (position) {
                    // Create custom colored marker based on tray status
                    const markerColor = this.getTrayMarkerColor(tray.status);
                    const markerIcon = L.divIcon({
                        className: 'tray-marker',
                        html: `<div class="marker-pin" style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fas fa-box" style="color: white; font-size: 10px;"></i></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 20]
                    });

                    const marker = L.marker(position, { icon: markerIcon });

                    const surgeonName = this.getSurgeonName(tray.physician_id);

                    // Generate action buttons based on tray status (same logic as tray cards)
                    let actions = '';
                    if (isAvailableStatus(tray.status)) {
                        actions += `
                            <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                                <i class="fas fa-sign-in-alt"></i> Check-in
                            </button>
                        `;
                    }
                    if (isInUseStatus(tray.status)) {
                        actions += `
                            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                                <i class="fas fa-hand-paper"></i> Pickup
                            </button>
                            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showTurnoverModal('${tray.id}')">
                                <i class="fas fa-exchange-alt"></i> Turnover
                            </button>
                        `;
                    }
                    if (normalizeStatus(tray.status) === TRAY_STATUS.CHECKED_IN) {
                        actions += `
                            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                                <i class="fas fa-hand-paper"></i> Pickup
                            </button>
                        `;
                    }
                    if (normalizeStatus(tray.status) === TRAY_STATUS.READY_FOR_PICKUP) {
                        actions += `
                            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                                <i class="fas fa-hand-paper"></i> Pickup
                            </button>
                        `;
                    }
                    if (normalizeStatus(tray.status) === TRAY_STATUS.PICKED_UP) {
                        actions += `
                            <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                                <i class="fas fa-sign-in-alt"></i> Check-in
                            </button>
                        `;
                    }

                    const locationInfo = window.app.trayManager.getLocationText(tray.location);

                    const popupContent = `
                        <div class="tray-popup">
                            <h6 class="popup-title">${tray.tray_name}</h6>
                            <p class="mb-1"><strong>Status:</strong> <span class="status-${normalizeStatus(tray.status)}">${getStatusDisplayText(tray.status)}</span></p>
                            <p class="mb-1"><strong>Location:</strong> ${locationInfo}</p>
                            ${tray.assignedTo ? `<p class="mb-1"><strong>Assigned to:</strong> ${window.app.trayManager.getUserName(tray.assignedTo)}</p>` : ''}
                            ${tray.caseDate ? `<p class="mb-1"><strong>Case Date:</strong> ${tray.caseDate}</p>` : ''}
                            ${surgeonName && surgeonName !== 'Not assigned' ? `<p class="mb-2"><strong>Physician:</strong> ${surgeonName}</p>` : ''}
                            ${actions ? `<div class="d-flex gap-2 mt-2">${actions}</div>` : ''}
                        </div>
                    `;

                    marker.bindPopup(popupContent, {
                        offset: [0, -20]
                    });
                    this.addMarkerWithSpider(marker);
                }
            } catch (error) {
                console.error('Error adding tray marker:', error);
            }
        });

        // Also add facility markers if display filter allows
        const displayFilter = document.getElementById('mapDisplayFilter')?.value || 'both';
        const trayFiltersActive = availabilityFilter || typeFilter || searchTerm;

        if ((displayFilter === 'both' || displayFilter === 'facilities') && !trayFiltersActive) {
            this.addFilteredFacilityMarkers();
        }

        // Center map around markers if any exist
        this.centerMapOnMarkers();
    }

    centerMapOnMarkers() {
        if (!this.map || this.markers.length === 0) return;

        if (this.markers.length === 1) {
            // Single marker - center on it with a reasonable zoom level
            const markerLatLng = this.markers[0].getLatLng();
            this.map.setView(markerLatLng, 12);
        } else {
            // Multiple markers - fit bounds to show all markers
            const group = new L.featureGroup(this.markers);
            const bounds = group.getBounds();
            
            // Add some padding around the markers
            const paddingOptions = {
                padding: [20, 20], // pixels
                maxZoom: 14 // Don't zoom in too much
            };
            
            this.map.fitBounds(bounds, paddingOptions);
        }
    }

    updateFilters() {
        if (window.app && window.app.trayManager && window.app.trayManager.currentTrays) {
            this.updateMap(window.app.trayManager.currentTrays);
        }
    }

    // Set up location filtering functionality
    setupLocationFilters() {
        // Facility filters
        const locationSearch = document.getElementById('locationSearch');
        const locationTypeFilter = document.getElementById('locationTypeFilter');
        const locationStatusFilter = document.getElementById('locationStatusFilter');
        const locationRegionFilter = document.getElementById('locationRegionFilter');
        
        // Tray filters
        const trayStatusFilter = document.getElementById('trayStatusFilter');
        const trayLocationFilter = document.getElementById('trayLocationFilter');
        const trayUserFilter = document.getElementById('trayUserFilter');
        const mapDisplayFilter = document.getElementById('mapDisplayFilter');

        // Add event listeners for facility filters with smart switching
        if (locationSearch) {
            locationSearch.addEventListener('input', (e) => {
                if (e.target.value.trim()) {
                    this.switchToFacilityMode();
                }
                this.updateCombinedFilters();
            });
        }
        if (locationTypeFilter) {
            locationTypeFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.switchToFacilityMode();
                }
                this.updateCombinedFilters();
            });
        }
        if (locationStatusFilter) {
            locationStatusFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.switchToFacilityMode();
                }
                this.updateCombinedFilters();
            });
        }
        if (locationRegionFilter) {
            locationRegionFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
        
        // Add event listeners for tray filters with smart switching
        if (trayStatusFilter) {
            trayStatusFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.switchToTrayMode();
                }
                this.updateCombinedFilters();
            });
        }
        if (trayLocationFilter) {
            trayLocationFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.switchToTrayMode();
                }
                this.updateCombinedFilters();
            });
        }
        if (trayUserFilter) {
            trayUserFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.switchToTrayMode();
                }
                this.updateCombinedFilters();
            });
        }
        const trayCustodyFilter = document.getElementById('trayCustodyFilter');
        if (trayCustodyFilter) {
            trayCustodyFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.switchToTrayMode();
                }
                this.updateCombinedFilters();
            });
        }
        if (mapDisplayFilter) {
            mapDisplayFilter.addEventListener('change', () => this.updateCombinedFilters());
        }

        // Populate user dropdown
        this.populateUserFilter();
        this.populateCustodyFilter();
    }

    // Switch to tray-focused mode
    switchToTrayMode() {
        // Set display filter to show trays only
        const mapDisplayFilter = document.getElementById('mapDisplayFilter');
        if (mapDisplayFilter) {
            mapDisplayFilter.value = 'trays';
        }

        // Reset facility filters
        const locationTypeFilter = document.getElementById('locationTypeFilter');
        const locationStatusFilter = document.getElementById('locationStatusFilter');
        const locationSearch = document.getElementById('locationSearch');

        if (locationTypeFilter) locationTypeFilter.value = '';
        if (locationStatusFilter) locationStatusFilter.value = '';
        if (locationSearch) locationSearch.value = '';
    }

    // Switch to facility-focused mode
    switchToFacilityMode() {
        // Set display filter to show facilities only
        const mapDisplayFilter = document.getElementById('mapDisplayFilter');
        if (mapDisplayFilter) {
            mapDisplayFilter.value = 'facilities';
        }

        // Reset tray filters
        const trayStatusFilter = document.getElementById('trayStatusFilter');
        const trayLocationFilter = document.getElementById('trayLocationFilter');
        const trayUserFilter = document.getElementById('trayUserFilter');
        const trayCustodyFilter = document.getElementById('trayCustodyFilter');

        if (trayStatusFilter) trayStatusFilter.value = '';
        if (trayLocationFilter) trayLocationFilter.value = '';
        if (trayUserFilter) trayUserFilter.value = '';
        if (trayCustodyFilter) trayCustodyFilter.value = '';
    }

    // Populate user filter dropdown
    populateUserFilter(retryCount = 0) {
        const trayUserFilter = document.getElementById('trayUserFilter');
        if (!trayUserFilter) return;

        // Clear existing options except "All Users"
        trayUserFilter.innerHTML = '<option value="">All Users</option>';

        // Get users from DataManager
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const users = Array.from(window.app.dataManager.users.values())
                .filter(user => user.active !== false) // Only show active users
                .sort((a, b) => {
                    const nameA = a.name || a.email || '';
                    const nameB = b.name || b.email || '';
                    return nameA.localeCompare(nameB);
                });

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.uid || user.id; // Use uid first, fallback to id
                option.textContent = user.name || user.email || 'Unknown User';
                trayUserFilter.appendChild(option);
            });
        } else if (retryCount < 5) {
            // Data not loaded yet, retry after delay (max 5 retries)
            setTimeout(() => {
                this.populateUserFilter(retryCount + 1);
            }, 1000);
        }
    }

    // Populate custody filter dropdown
    populateCustodyFilter(retryCount = 0) {
        const trayCustodyFilter = document.getElementById('trayCustodyFilter');
        if (!trayCustodyFilter) return;

        // Clear existing options except "All Custody"
        trayCustodyFilter.innerHTML = '<option value="">All Custody</option>';

        // Get users from DataManager
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const users = Array.from(window.app.dataManager.users.values())
                .filter(user => user.active !== false) // Only show active users
                .sort((a, b) => {
                    const nameA = a.name || a.email || '';
                    const nameB = b.name || b.email || '';
                    return nameA.localeCompare(nameB);
                });

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.uid || user.id; // Use uid first, fallback to id
                option.textContent = user.name || user.email || 'Unknown User';
                trayCustodyFilter.appendChild(option);
            });
        } else if (retryCount < 5) {
            // Data not loaded yet, retry after delay (max 5 retries)
            setTimeout(() => {
                this.populateCustodyFilter(retryCount + 1);
            }, 1000);
        }
    }

    // Update location markers based on filters
    updateLocationFilters() {
        if (!this.map) return;

        // Clear existing markers
        this.clearAllMarkers();

        // Get filter values
        const searchTerm = document.getElementById('locationSearch')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('locationTypeFilter')?.value || '';
        const statusFilter = document.getElementById('locationStatusFilter')?.value || '';
        const regionFilter = document.getElementById('locationRegionFilter')?.value || '';

        // Get facilities from FacilityManager  
        const locations = window.app.facilityManager?.currentFacilities || [];
        
        // Apply filters
        const filteredLocations = locations.filter(location => {
            // Search filter
            if (searchTerm && !(location.account_name || location.name)?.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Type filter
            if (typeFilter && (location.account_record_type || location.type) !== typeFilter) {
                return false;
            }
            
            // Status filter
            if (statusFilter === 'active' && !location.active) {
                return false;
            }
            if (statusFilter === 'inactive' && location.active) {
                return false;
            }
            
            // Territory/Region filter
            if (regionFilter && location.territory !== regionFilter) {
                return false;
            }
            
            return true;
        });

        // Update markers with filtered locations
        this.displayLocationMarkers(filteredLocations);
        
        // Center map around location markers
        this.centerMapOnMarkers();
        
        console.log(`🔍 Filtered locations: ${filteredLocations.length} of ${locations.length} locations`);
    }

    // Update map with combined facility and tray filters
    updateCombinedFilters() {
        if (!this.map) return;

        // Clear existing markers
        this.clearAllMarkers();

        // Get display option
        const displayFilter = document.getElementById('mapDisplayFilter')?.value || 'both';
        
        // Get tray filters - if any tray filter is used, don't show facilities
        const trayStatusFilter = document.getElementById('trayStatusFilter')?.value || '';
        const trayUserFilter = document.getElementById('trayUserFilter')?.value || '';
        const trayCustodyFilter = document.getElementById('trayCustodyFilter')?.value || '';
        const trayLocationFilter = document.getElementById('trayLocationFilter')?.value || '';

        // Get facility filters - if any facility filter is used, don't show trays
        const locationTypeFilter = document.getElementById('locationTypeFilter')?.value || '';
        const locationStatusFilter = document.getElementById('locationStatusFilter')?.value || '';
        const locationRegionFilter = document.getElementById('locationRegionFilter')?.value || '';
        const locationSearch = document.getElementById('locationSearch')?.value || '';

        // Show facilities only if requested and no tray filters are applied
        if ((displayFilter === 'both' || displayFilter === 'facilities') &&
            !trayStatusFilter && !trayUserFilter && !trayCustodyFilter && !trayLocationFilter) {
            this.addFilteredFacilityMarkers();
        }
        
        // Show trays only if requested and no facility filters are applied
        if ((displayFilter === 'both' || displayFilter === 'trays') && 
            !locationTypeFilter && !locationStatusFilter && !locationRegionFilter && !locationSearch) {
            this.addFilteredTrayMarkers();
        }

        // Center map around all markers
        this.centerMapOnMarkers();
    }

    addFilteredFacilityMarkers() {
        // Get facility filter values
        const searchTerm = document.getElementById('locationSearch')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('locationTypeFilter')?.value || '';
        const statusFilter = document.getElementById('locationStatusFilter')?.value || '';
        const regionFilter = document.getElementById('locationRegionFilter')?.value || '';

        // Get facilities from FacilityManager
        const locations = window.app.facilityManager?.currentFacilities || [];

        // Apply facility filters
        const filteredLocations = locations.filter(location => {
            // Search filter
            if (searchTerm && !(location.account_name || location.name)?.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Type filter
            if (typeFilter && (location.account_record_type || location.type) !== typeFilter) {
                return false;
            }
            
            // Status filter
            if (statusFilter === 'active' && !location.active) {
                return false;
            }
            if (statusFilter === 'inactive' && location.active) {
                return false;
            }
            
            // Territory/Region filter
            if (regionFilter && location.territory !== regionFilter) {
                return false;
            }
            
            return true;
        });

        // Display facility markers
        this.displayLocationMarkers(filteredLocations);
    }

    addFilteredTrayMarkers() {
        // Get tray filter values
        const searchTerm = document.getElementById('locationSearch')?.value.toLowerCase() || '';
        const trayStatusFilter = document.getElementById('trayStatusFilter')?.value || '';
        const trayLocationFilter = document.getElementById('trayLocationFilter')?.value || '';
        const trayUserFilter = document.getElementById('trayUserFilter')?.value || '';
        const trayCustodyFilter = document.getElementById('trayCustodyFilter')?.value || '';

        // Get trays from TrayManager
        const trays = window.app.trayManager?.currentTrays || [];
        
        // Static locations that are NOT facilities
        const staticLocations = ['trunk', 'corporate', 'cleaning', 'maintenance'];
        
        // Apply tray filters
        const filteredTrays = trays.filter(tray => {
            // Search filter (tray name or facility)
            if (searchTerm && 
                !tray.tray_name?.toLowerCase().includes(searchTerm) && 
                !tray.facility?.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Tray status filter
            if (trayStatusFilter && tray.status !== trayStatusFilter) {
                return false;
            }
            
            // Tray location filter
            if (trayLocationFilter) {
                if (trayLocationFilter === 'facility') {
                    // "At Facility" means NOT in static locations (trunk, corporate, cleaning, maintenance)
                    if (staticLocations.includes(tray.location)) {
                        return false;
                    }
                } else {
                    // Specific location filter
                    if (tray.location !== trayLocationFilter) {
                        return false;
                    }
                }
            }
            
            // Tray user filter (filter by assigned user)
            if (trayUserFilter && tray.assignedTo !== trayUserFilter) {
                console.log(`🔍 User filter: Filtering out tray ${tray.tray_name} - assignedTo: "${tray.assignedTo}" !== filter: "${trayUserFilter}"`);
                return false;
            }

            // Tray custody filter (filter by custody)
            if (trayCustodyFilter && tray.custody_id !== trayCustodyFilter) {
                console.log(`🔍 Custody filter: Filtering out tray ${tray.tray_name} - custody_id: "${tray.custody_id}" !== filter: "${trayCustodyFilter}"`);
                return false;
            }

            return true;
        });

        // Display tray markers
        this.displayTrayMarkers(filteredTrays);
        
        console.log(`🔍 Filtered trays: ${filteredTrays.length} of ${trays.length} trays`);
        console.log(`🔍 Filter values:`, { 
            searchTerm, 
            trayStatusFilter, 
            trayLocationFilter, 
            trayUserFilter 
        });
        
        if (trayUserFilter) {
            console.log(`🔍 User filter active: "${trayUserFilter}"`);
            console.log(`🔍 All tray assignments:`, 
                trays.map(t => ({ name: t.tray_name, assignedTo: t.assignedTo, assignedToType: typeof t.assignedTo }))
            );
            console.log(`🔍 Available users in dropdown:`, 
                Array.from(document.getElementById('trayUserFilter').options).map(opt => ({ value: opt.value, text: opt.textContent }))
            );
            console.log(`🔍 Users from DataManager:`, 
                Array.from(window.app?.dataManager?.users?.values() || []).map(user => ({ uid: user.uid, id: user.id, name: user.name, email: user.email }))
            );
        }
    }

    displayTrayMarkers(trays) {
        let coordinateTrays = 0;
        let legacyTrays = 0; 
        let corporateTrays = 0;
        let trunkTrays = 0;
        let noLocationTrays = 0;

        trays.forEach(tray => {
            let position = null;

            // Use tray's stored coordinates first (from facility check-in)
            if (tray.latitude && tray.longitude) {
                position = [parseFloat(tray.latitude), parseFloat(tray.longitude)];
                coordinateTrays++;
            }
            // Fallback to legacy logic for trays without coordinates
            else if (tray.location === TRAY_LOCATIONS.FACILITY && tray.facility && this.facilityLocations[tray.facility]) {
                position = this.facilityLocations[tray.facility];
                legacyTrays++;
            } else if (tray.location === TRAY_LOCATIONS.CORPORATE) {
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.CORPORATE);
                corporateTrays++;
            } else if (tray.location === TRAY_LOCATIONS.TRUNK) {
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK);
                trunkTrays++;
            } else {
                // Default fallback location for trays with no coordinates
                // Use trunk location as default
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK);
                noLocationTrays++;
            }

            if (position) {
                // Create different colored marker based on tray status
                const markerColor = this.getTrayMarkerColor(tray.status);
                const markerIcon = L.divIcon({
                    className: 'tray-marker',
                    html: `<div class="marker-pin" style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fas fa-box" style="color: white; font-size: 10px;"></i></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 20]
                });
                
                const marker = L.marker(position, { icon: markerIcon });

                const surgeonName = this.getSurgeonName(tray.physician_id);
                
                // Generate action buttons based on tray status (same logic as tray cards)
                let actions = '';
                if (isAvailableStatus(tray.status)) {
                    actions += `
                        <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                            <i class="fas fa-sign-in-alt"></i> Check-in
                        </button>
                    `;
                }
                if (isInUseStatus(tray.status)) {
                    actions += `
                        <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                            <i class="fas fa-hand-paper"></i> Pickup
                        </button>
                        <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showTurnoverModal('${tray.id}')">
                            <i class="fas fa-exchange-alt"></i> Turnover
                        </button>
                    `;
                }
                if (normalizeStatus(tray.status) === TRAY_STATUS.CHECKED_IN) {
                    actions += `
                        <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                            <i class="fas fa-hand-paper"></i> Pickup
                        </button>
                    `;
                }
                if (normalizeStatus(tray.status) === TRAY_STATUS.READY_FOR_PICKUP) {
                    actions += `
                        <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                            <i class="fas fa-hand-paper"></i> Pickup
                        </button>
                    `;
                }
                if (normalizeStatus(tray.status) === TRAY_STATUS.PICKED_UP) {
                    actions += `
                        <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                            <i class="fas fa-sign-in-alt"></i> Check-in
                        </button>
                    `;
                }

                // Create location info with coordinates if available
                let locationInfo = window.app.trayManager.getLocationText(tray.location);
                let coordinateInfo = '';
                
                if (tray.latitude && tray.longitude) {
                    coordinateInfo = `
                        <p class="mb-1">
                            <strong>📍 Coordinates:</strong> 
                            <small>${parseFloat(tray.latitude).toFixed(4)}, ${parseFloat(tray.longitude).toFixed(4)}</small>
                        </p>
                    `;
                    if (tray.locationSource) {
                        coordinateInfo += `<p class="mb-1"><small><strong>Source:</strong> ${tray.locationSource.replace('_', ' ')}</small></p>`;
                    }
                    if (tray.locationTimestamp) {
                        const timestamp = new Date(tray.locationTimestamp).toLocaleString();
                        coordinateInfo += `<p class="mb-1"><small><strong>Located:</strong> ${timestamp}</small></p>`;
                    }
                } else {
                    // Show when using fallback/legacy location
                    coordinateInfo = `<p class="mb-1"><small><strong>📍 Location:</strong> Using default area (no specific coordinates)</small></p>`;
                }

                const popupContent = `
                    <div class="tray-popup">
                        <h6 class="popup-title">${tray.tray_name}</h6>
                        <p class="mb-1"><strong>Status:</strong> <span class="status-${tray.status}">${getStatusDisplayText(tray.status)}</span></p>
                        <p class="mb-1"><strong>Location:</strong> ${locationInfo}</p>
                        ${tray.assignedTo ? `<p class="mb-1"><strong>Assigned to:</strong> ${window.app.trayManager.getUserName(tray.assignedTo)}</p>` : ''}
                        ${tray.caseDate ? `<p class="mb-1"><strong>Case Date:</strong> ${tray.caseDate}</p>` : ''}
                        ${surgeonName && surgeonName !== 'Not assigned' ? `<p class="mb-2"><strong>Physician:</strong> ${surgeonName}</p>` : ''}
                        ${actions ? `<div class="d-flex gap-2 mt-2">${actions}</div>` : ''}
                    </div>
                `;

                marker.bindPopup(popupContent, {
                    offset: [0, -20] // Increase Y offset to move popup further up from marker
                });
                this.addMarkerWithSpider(marker);
            } else {
                // Log trays that couldn't be positioned on the map
                console.warn(`📍 No coordinates available for tray ${tray.tray_name} (ID: ${tray.id}). Location: ${tray.location}, Facility: ${tray.facility || 'none'}`);
            }
        });

        // Log location statistics
        console.log(`📊 Map Tray Location Statistics:
        📍 Facility Coordinates: ${coordinateTrays} trays
        📍 Legacy Locations: ${legacyTrays} trays  
        📍 Corporate: ${corporateTrays} trays
        📍 Trunk: ${trunkTrays} trays
        ❌ No Location: ${noLocationTrays} trays
        📍 Total Mapped: ${coordinateTrays + legacyTrays + corporateTrays + trunkTrays} / ${trays.length} trays`);
    }

    getTrayMarkerColor(status) {
        const colors = {
            [TRAY_STATUS.AVAILABLE]: '#28a745',      // Green
            [TRAY_STATUS.IN_USE]: '#ffc107',         // Yellow
            [TRAY_STATUS.CHECKED_IN]: '#007bff',     // Blue
            [TRAY_STATUS.PICKED_UP]: '#fd7e14',      // Orange
            [TRAY_STATUS.CLEANING]: '#17a2b8',       // Cyan
            [TRAY_STATUS.MAINTENANCE]: '#6c757d',    // Gray
            [TRAY_STATUS.MISSING]: '#dc3545',        // Red
            [TRAY_STATUS.UNKNOWN]: '#343a40'         // Dark
        };
        return colors[normalizeStatus(status)] || '#6c757d';
    }

    getSurgeonName(surgeonId) {
        return getPhysicianName(surgeonId, window.app.dataManager?.getSurgeons()) || 'Not assigned';
    }

    // Display location markers on the map
    displayLocationMarkers(locations) {
        locations.forEach(location => {
            if (location.latitude && location.longitude) {
                const position = [location.latitude, location.longitude];
                
                // Create different colored markers based on location type
                const markerColor = this.getLocationMarkerColor(location.account_record_type || location.type);
                const markerIcon = L.divIcon({
                    className: 'location-marker',
                    html: `<div class="marker-pin" style="background-color: ${markerColor}; width: 25px; height: 25px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fas fa-map-marker-alt" style="transform: rotate(45deg); color: white; font-size: 12px;"></i></div>`,
                    iconSize: [25, 25],
                    iconAnchor: [12, 25]
                });
                
                const marker = L.marker(position, { icon: markerIcon });

                const statusClass = location.active ? 'status-active' : 'status-inactive';
                const statusText = location.active ? 'Active' : 'Inactive';

                // Format address from nested object structure
                let addressText = '';
                if (location.address && typeof location.address === 'object') {
                    const addressParts = [
                        location.address.street,
                        location.address.city,
                        location.address.state,
                        location.address.zip
                    ].filter(Boolean);
                    addressText = addressParts.join(', ');
                } else if (location.address && typeof location.address === 'string') {
                    // Fallback for legacy flat address
                    addressText = location.address;
                }

                const popupContent = `
                    <div class="location-popup">
                        <h6 class="popup-title">${location.account_name || location.name || 'Unnamed Facility'}</h6>
                        <p class="mb-1"><strong>Type:</strong> ${(location.account_record_type || location.type || 'Unknown').replace('_', ' ')}</p>
                        <p class="mb-1"><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
                        ${addressText ? `<p class="mb-1"><strong>Address:</strong> ${addressText}</p>` : ''}
                        ${location.phone ? `<p class="mb-1"><strong>Phone:</strong> ${location.phone}</p>` : ''}
                        ${location.territory || location.region ? `<p class="mb-0"><strong>Territory:</strong> ${location.territory || location.region}</p>` : ''}
                    </div>
                `;

                marker.bindPopup(popupContent, {
                    offset: [0, -20] // Increase Y offset to move popup further up from marker
                });
                this.addMarkerWithSpider(marker);
            }
        });
    }

    getLocationMarkerColor(type) {
        const colors = {
            'medical_facility': '#007bff',
            'corporate': '#28a745',
            'warehouse': '#ffc107',
            'distribution': '#dc3545'
        };
        return colors[type] || '#6c757d';
    }

    // Clear all markers and refresh the map
    clearAndRefreshMap() {
        if (!this.map) return;
        
        console.log('🗺️ Clearing all map markers and refreshing...');
        
        // Clear existing markers
        this.clearAllMarkers();
        
        // Check which view we're in and refresh accordingly
        const currentView = window.app.viewManager?.currentView;
        
        if (currentView === 'locations') {
            // Refresh location markers with filters
            setTimeout(() => {
                this.updateLocationFilters();
            }, 500);
        } else {
            // Force refresh with current tray data
            if (window.app && window.app.trayManager && window.app.trayManager.currentTrays) {
                setTimeout(() => {
                    this.updateMap(window.app.trayManager.currentTrays);
                }, 500);
            }
        }
    }
}