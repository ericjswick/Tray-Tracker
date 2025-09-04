// js/MapManager.js
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

        this.map = L.map('map').setView([43.0389, -87.9065], 9);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    updateMap(trays) {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        // Apply filters
        const availabilityFilter = document.getElementById('availabilityFilter')?.value || 'all';
        const typeFilter = document.getElementById('typeFilter')?.value || 'all';

        const filteredTrays = trays.filter(tray => {
            if (availabilityFilter !== 'all' && tray.status !== availabilityFilter) return false;
            if (typeFilter !== 'all' && tray.type !== typeFilter) return false;
            return true;
        });

        filteredTrays.forEach(tray => {
            let position;

            if (tray.location === 'facility' && tray.facility && this.facilityLocations[tray.facility]) {
                position = this.facilityLocations[tray.facility];
            } else if (tray.location === 'corporate') {
                position = [37.4419, -122.1430]; // SI-BONE HQ (simulated)
            } else if (tray.location === 'trunk') {
                // Random position around Wisconsin for demo
                position = [43.0389 + (Math.random() - 0.5) * 0.5, -87.9065 + (Math.random() - 0.5) * 0.5];
            }

            if (position) {
                const marker = L.marker(position).addTo(this.map);

                const statusClass = `status-${tray.status === 'in-use' ? 'in-use' : tray.status}`;

                // Get surgeon name for display (handle both old and new format)
                let surgeonName = '';
                if (tray.surgeonId && window.app.surgeonManager) {
                    const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === tray.surgeonId);
                    surgeonName = surgeon ? surgeon.name : 'Unknown Surgeon';
                } else if (tray.surgeon) {
                    surgeonName = tray.surgeon; // Legacy format
                }

                const popupContent = `
                <div class="p-2">
                    <h6>${tray.name}</h6>
                    <p class="mb-1"><span class="badge ${statusClass}">${tray.status}</span></p>
                    <p class="mb-1"><strong>Type:</strong> ${tray.type}</p>
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
    }


    updateFilters() {
        if (window.app && window.app.trayManager && window.app.trayManager.currentTrays) {
            this.updateMap(window.app.trayManager.currentTrays);
        }
    }
}