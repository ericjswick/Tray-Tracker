// js/MapManager.js
import { TRAY_STATUS, normalizeStatus, isInUseStatus, isAvailableStatus, getStatusDisplayText } from './constants/TrayStatus.js';
import { TRAY_LOCATIONS, getLocationCoordinatesArray } from './constants/TrayLocations.js';
export class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
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
    }

    initializeMap() {
        if (this.map) return;

        // Initialize map centered on Milwaukee area as default
        const defaultCenter = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK) || [43.0389, -87.9065];
        this.map = L.map('map').setView(defaultCenter, 8);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    updateMap(trays) {
        if (!this.map) return;
        
        console.log('🗺️ DEBUG: updateMap called with', trays.length, 'trays');

        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

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
        
        console.log('🗺️ DEBUG: After filtering:', filteredTrays.length, 'trays remain');
        console.log('🗺️ DEBUG: Filters applied - search:', searchTerm, 'status:', availabilityFilter, 'type:', typeFilter);

        filteredTrays.forEach(tray => {
            let position;

            if (tray.location === TRAY_LOCATIONS.FACILITY && tray.facility && this.facilityLocations[tray.facility]) {
                position = this.facilityLocations[tray.facility];
            } else if (tray.location === TRAY_LOCATIONS.CORPORATE) {
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.CORPORATE);
            } else if (tray.location === TRAY_LOCATIONS.TRUNK) {
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK);
            }

            if (position) {
                const marker = L.marker(position).addTo(this.map);

                const statusClass = `status-${normalizeStatus(tray.status).replace('_', '-')}`;

                // Get surgeon name for display (handle both old and new format)
                let surgeonName = '';
                if (tray.physician_id && window.app.surgeonManager) {
                    const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === tray.physician_id);
                    surgeonName = surgeon ? surgeon.full_name : 'Unknown Surgeon';
                } else if (tray.surgeon) {
                    surgeonName = tray.surgeon; // Legacy format
                }

                const popupContent = `
                <div class="p-2">
                    <h6>${tray.tray_name}</h6>
                    <p class="mb-1"><span class="badge ${statusClass}">${tray.status}</span></p>
                    <p class="mb-1"><strong>Type:</strong> ${window.app.trayManager.getTrayTypeText(tray)}</p>
                    <p class="mb-1"><strong>Location:</strong> ${window.app.trayManager.getLocationText(tray.location)}</p>
                    ${tray.facility ? `<p class="mb-1"><strong>Facility:</strong> ${tray.facility}</p>` : ''}
                    ${tray.caseDate ? `<p class="mb-1"><strong>Case Date:</strong> ${tray.caseDate}</p>` : ''}
                    ${surgeonName ? `<p class="mb-0"><strong>Surgeon:</strong> ${surgeonName}</p>` : ''}
                </div>
            `;

                marker.bindPopup(popupContent);
                this.markers.push(marker);
            }
        });

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
        const mapDisplayFilter = document.getElementById('mapDisplayFilter');

        // Add event listeners for facility filters
        if (locationSearch) {
            locationSearch.addEventListener('input', () => this.updateCombinedFilters());
        }
        if (locationTypeFilter) {
            locationTypeFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
        if (locationStatusFilter) {
            locationStatusFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
        if (locationRegionFilter) {
            locationRegionFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
        
        // Add event listeners for tray filters
        if (trayStatusFilter) {
            trayStatusFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
        if (trayLocationFilter) {
            trayLocationFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
        if (mapDisplayFilter) {
            mapDisplayFilter.addEventListener('change', () => this.updateCombinedFilters());
        }
    }

    // Update location markers based on filters
    updateLocationFilters() {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

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
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        // Get display option
        const displayFilter = document.getElementById('mapDisplayFilter')?.value || 'both';
        
        // Show facilities if requested
        if (displayFilter === 'both' || displayFilter === 'facilities') {
            this.addFilteredFacilityMarkers();
        }
        
        // Show trays if requested
        if (displayFilter === 'both' || displayFilter === 'trays') {
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
        
        console.log('🗺️ DEBUG: Facilities for map:', locations.length, locations);
        
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

        console.log('🗺️ DEBUG: Filtered facilities:', filteredLocations.length);
        const facilitiesWithCoords = filteredLocations.filter(loc => loc.latitude && loc.longitude);
        console.log('🗺️ DEBUG: Facilities with coordinates:', facilitiesWithCoords.length, facilitiesWithCoords);

        // Display facility markers
        this.displayLocationMarkers(filteredLocations);
    }

    addFilteredTrayMarkers() {
        // Get tray filter values
        const searchTerm = document.getElementById('locationSearch')?.value.toLowerCase() || '';
        const trayStatusFilter = document.getElementById('trayStatusFilter')?.value || '';
        const trayLocationFilter = document.getElementById('trayLocationFilter')?.value || '';

        // Get trays from TrayManager
        const trays = window.app.trayManager?.currentTrays || [];
        
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
            if (trayLocationFilter && tray.location !== trayLocationFilter) {
                return false;
            }
            
            return true;
        });

        // Display tray markers
        this.displayTrayMarkers(filteredTrays);
        
        console.log(`🔍 Filtered trays: ${filteredTrays.length} of ${trays.length} trays`);
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
                console.log(`📍 Using tray coordinates for ${tray.tray_name}: [${position[0]}, ${position[1]}]`);
            }
            // Fallback to legacy logic for trays without coordinates
            else if (tray.location === TRAY_LOCATIONS.FACILITY && tray.facility && this.facilityLocations[tray.facility]) {
                position = this.facilityLocations[tray.facility];
                legacyTrays++;
                console.log(`📍 Using legacy facility coordinates for ${tray.tray_name}: [${position[0]}, ${position[1]}]`);
            } else if (tray.location === TRAY_LOCATIONS.CORPORATE) {
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.CORPORATE);
                corporateTrays++;
                console.log(`📍 Using corporate location for ${tray.tray_name}`);
            } else if (tray.location === TRAY_LOCATIONS.TRUNK) {
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK);
                trunkTrays++;
                console.log(`📍 Using trunk location for ${tray.tray_name}`);
            } else {
                // Default fallback location for trays with no coordinates
                // Use trunk location as default
                position = getLocationCoordinatesArray(TRAY_LOCATIONS.TRUNK);
                noLocationTrays++;
                console.log(`📍 Using default location for ${tray.tray_name} (no coordinates available)`);
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
                
                const marker = L.marker(position, { icon: markerIcon }).addTo(this.map);

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
                        <p class="mb-1"><strong>Status:</strong> <span class="status-${tray.status}">${tray.status.charAt(0).toUpperCase() + tray.status.slice(1)}</span></p>
                        <p class="mb-1"><strong>Location:</strong> ${locationInfo}</p>
                        ${tray.facility ? `<p class="mb-1"><strong>Facility:</strong> ${tray.facility}</p>` : ''}
                        ${coordinateInfo}
                        ${tray.caseDate ? `<p class="mb-1"><strong>Case Date:</strong> ${tray.caseDate}</p>` : ''}
                        ${surgeonName && surgeonName !== 'Not assigned' ? `<p class="mb-2"><strong>Surgeon:</strong> ${surgeonName}</p>` : ''}
                        ${actions ? `<div class="d-flex gap-2 mt-2">${actions}</div>` : ''}
                    </div>
                `;

                marker.bindPopup(popupContent);
                this.markers.push(marker);
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
        if (!surgeonId) return 'Not assigned';
        
        const surgeons = window.app.surgeonManager?.currentSurgeons || [];
        const surgeon = surgeons.find(s => s.id === surgeonId);
        return surgeon ? surgeon.full_name : 'Unknown Surgeon';
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
                
                const marker = L.marker(position, { icon: markerIcon }).addTo(this.map);

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

                marker.bindPopup(popupContent);
                this.markers.push(marker);
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
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
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