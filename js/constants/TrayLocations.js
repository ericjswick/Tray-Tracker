// js/constants/TrayLocations.js - Centralized Tray Location Constants

/**
 * Centralized Tray Location Constants
 * Single source of truth for all tray location values used throughout the application
 * These represent where trays can be physically located
 */

export const TRAY_LOCATIONS = {
    // Static locations
    TRUNK: "trunk",           // Rep trunk/vehicle
    CORPORATE: "corporate",   // SI-BONE corporate office
    FACILITY: "facility",     // Generic medical facility
    CLEANING: "cleaning",     // Cleaning facility/sterilization
    MAINTENANCE: "maintenance" // Under maintenance/repair
};

// Helper function to normalize location strings
export function normalizeLocation(location) {
    if (!location) return TRAY_LOCATIONS.TRUNK; // Default to trunk
    
    const normalized = location.toLowerCase().trim();
    
    // Handle legacy formats and variations
    const locationMap = {
        'rep trunk': TRAY_LOCATIONS.TRUNK,
        'rep_trunk': TRAY_LOCATIONS.TRUNK,
        'trunk': TRAY_LOCATIONS.TRUNK,
        'si-bone corporate': TRAY_LOCATIONS.CORPORATE,
        'sibone corporate': TRAY_LOCATIONS.CORPORATE,
        'corporate': TRAY_LOCATIONS.CORPORATE,
        'medical facility': TRAY_LOCATIONS.FACILITY,
        'facility': TRAY_LOCATIONS.FACILITY,
        'cleaning facility': TRAY_LOCATIONS.CLEANING,
        'cleaning': TRAY_LOCATIONS.CLEANING,
        'sterilization': TRAY_LOCATIONS.CLEANING,
        'maintenance': TRAY_LOCATIONS.MAINTENANCE,
        'repair': TRAY_LOCATIONS.MAINTENANCE
    };
    
    return locationMap[normalized] || normalized; // Return mapped value or original if not found
}

// Helper function to get display-friendly location text
export function getLocationDisplayText(location) {
    const normalized = normalizeLocation(location);
    
    const displayMap = {
        [TRAY_LOCATIONS.TRUNK]: 'Rep Trunk',
        [TRAY_LOCATIONS.CORPORATE]: 'SI-BONE Corporate',
        [TRAY_LOCATIONS.FACILITY]: 'Medical Facility',
        [TRAY_LOCATIONS.CLEANING]: 'Cleaning Facility',
        [TRAY_LOCATIONS.MAINTENANCE]: 'Maintenance'
    };
    
    return displayMap[normalized] || location || 'Unknown Location';
}

// Helper function to get location icon class for UI
export function getLocationIcon(location) {
    const normalized = normalizeLocation(location);
    
    const iconMap = {
        [TRAY_LOCATIONS.TRUNK]: 'fas fa-truck',
        [TRAY_LOCATIONS.CORPORATE]: 'fas fa-building',
        [TRAY_LOCATIONS.FACILITY]: 'fas fa-hospital',
        [TRAY_LOCATIONS.CLEANING]: 'fas fa-soap',
        [TRAY_LOCATIONS.MAINTENANCE]: 'fas fa-tools'
    };
    
    return iconMap[normalized] || 'fas fa-map-marker-alt';
}

// Static location options (core locations that are always available)
export const STATIC_LOCATION_OPTIONS = [
    { 
        value: TRAY_LOCATIONS.TRUNK, 
        label: 'Rep Trunk', 
        description: 'Sales representative trunk/vehicle',
        icon: 'fas fa-truck'
    },
    { 
        value: TRAY_LOCATIONS.CORPORATE, 
        label: 'SI-BONE Corporate', 
        description: 'SI-BONE corporate office',
        icon: 'fas fa-building'
    },
    { 
        value: TRAY_LOCATIONS.CLEANING, 
        label: 'Cleaning Facility', 
        description: 'Sterilization/cleaning facility',
        icon: 'fas fa-soap'
    },
    { 
        value: TRAY_LOCATIONS.MAINTENANCE, 
        label: 'Maintenance', 
        description: 'Under repair or maintenance',
        icon: 'fas fa-tools'
    }
];

// UI Population Helper - Central function to populate location dropdowns
export function populateTrayLocationDropdown(selectElement, options = {}) {
    if (!selectElement) {
        console.error('TrayLocations.populateTrayLocationDropdown: selectElement is null');
        return;
    }
    
    const {
        includeAllOption = false,
        allOptionText = 'All Locations',
        includeEmptyOption = true,
        emptyOptionText = 'Select Location...',
        selectedValue = null,
        includeFacilities = true, // Whether to include dynamic facilities
        staticLocationsOnly = false, // Only show static locations (trunk, corporate, etc.)
        excludeLocations = [] // Array of location values to exclude
    } = options;
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add "All" option if requested
    if (includeAllOption) {
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = allOptionText;
        selectElement.appendChild(allOption);
    }
    
    // Add empty/placeholder option if requested
    if (includeEmptyOption && !includeAllOption) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = emptyOptionText;
        selectElement.appendChild(emptyOption);
    }
    
    // Add static location options
    STATIC_LOCATION_OPTIONS.forEach(locationOption => {
        if (!excludeLocations.includes(locationOption.value)) {
            const option = document.createElement('option');
            option.value = locationOption.value;
            option.textContent = locationOption.label;
            if (selectedValue === locationOption.value) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        }
    });
    
    // Add dynamic facility locations if requested and not static-only
    if (includeFacilities && !staticLocationsOnly) {
        const facilities = getFacilityLocations();
        if (facilities.length > 0) {
            // Add separator for facilities
            const separator = document.createElement('optgroup');
            separator.label = 'Medical Facilities';
            selectElement.appendChild(separator);
            
            facilities.forEach(facility => {
                if (!excludeLocations.includes(facility.value)) {
                    const option = document.createElement('option');
                    option.value = facility.value;
                    option.textContent = facility.label;
                    if (selectedValue === facility.value) {
                        option.selected = true;
                    }
                    separator.appendChild(option);
                }
            });
        }
    }
}

// Helper to get facility locations from the app
function getFacilityLocations() {
    const facilities = [];
    
    try {
        // Get facilities from the facility manager
        if (window.app?.facilityManager?.currentFacilities) {
            const activeFacilities = window.app.facilityManager.currentFacilities
                .filter(facility => facility.active !== false)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            activeFacilities.forEach(facility => {
                facilities.push({
                    value: facility.id,
                    label: facility.name,
                    description: facility.type || 'Medical Facility'
                });
            });
        }
        
        // Fallback: get from data manager if facility manager not available
        else if (window.app?.dataManager?.facilities) {
            const activeFacilities = window.app.dataManager.facilities
                .filter(facility => facility.active !== false)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            activeFacilities.forEach(facility => {
                facilities.push({
                    value: facility.id,
                    label: facility.name,
                    description: facility.type || 'Medical Facility'
                });
            });
        }
    } catch (error) {
        console.warn('Error getting facility locations:', error);
    }
    
    return facilities;
}

// Helper to get all location options as HTML string (for dynamic insertion)
export function getTrayLocationOptionsHTML(options = {}) {
    const {
        includeAllOption = false,
        allOptionText = 'All Locations',
        includeEmptyOption = true,
        emptyOptionText = 'Select Location...',
        selectedValue = null,
        includeFacilities = true,
        staticLocationsOnly = false,
        excludeLocations = []
    } = options;
    
    let html = '';
    
    // Add "All" option if requested
    if (includeAllOption) {
        const selected = selectedValue === '' ? ' selected' : '';
        html += `<option value=""${selected}>${allOptionText}</option>`;
    }
    
    // Add empty/placeholder option if requested
    if (includeEmptyOption && !includeAllOption) {
        const selected = selectedValue === '' ? ' selected' : '';
        html += `<option value=""${selected}>${emptyOptionText}</option>`;
    }
    
    // Add static location options
    STATIC_LOCATION_OPTIONS.forEach(locationOption => {
        if (!excludeLocations.includes(locationOption.value)) {
            const selected = selectedValue === locationOption.value ? ' selected' : '';
            html += `<option value="${locationOption.value}"${selected}>${locationOption.label}</option>`;
        }
    });
    
    // Add facilities if requested
    if (includeFacilities && !staticLocationsOnly) {
        const facilities = getFacilityLocations();
        if (facilities.length > 0) {
            html += '<optgroup label="Medical Facilities">';
            facilities.forEach(facility => {
                if (!excludeLocations.includes(facility.value)) {
                    const selected = selectedValue === facility.value ? ' selected' : '';
                    html += `<option value="${facility.value}"${selected}>${facility.label}</option>`;
                }
            });
            html += '</optgroup>';
        }
    }
    
    return html;
}

// All possible static location values (for validation)
export const ALL_STATIC_LOCATIONS = Object.values(TRAY_LOCATIONS);