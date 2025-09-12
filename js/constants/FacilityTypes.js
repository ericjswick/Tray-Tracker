// Facility Types Constants - Single source of truth for all facility types
// MyRepData-compatible facility type system

export const FACILITY_TYPES = {
    ASC: 'ASC',
    HOSPITAL: 'Hospital',
    OBL: 'OBL'
};

// Array of all valid facility types for dropdowns and validation
export const FACILITY_TYPE_OPTIONS = [
    { 
        value: FACILITY_TYPES.ASC, 
        label: 'ASC (Ambulatory Surgery Center)',
        shortLabel: 'ASC',
        description: 'Ambulatory Surgery Center - outpatient surgical facility'
    },
    { 
        value: FACILITY_TYPES.HOSPITAL, 
        label: 'Hospital',
        shortLabel: 'Hospital',
        description: 'Full-service hospital facility'
    },
    { 
        value: FACILITY_TYPES.OBL, 
        label: 'OBL (Office-Based Lab)',
        shortLabel: 'OBL',
        description: 'Office-Based Lab - physician office with surgical capabilities'
    }
];

// Array of facility type values only
export const FACILITY_TYPE_VALUES = Object.values(FACILITY_TYPES);

// Default facility type for new facilities
export const DEFAULT_FACILITY_TYPE = FACILITY_TYPES.HOSPITAL;

// Facility type validation function
export function isValidFacilityType(type) {
    return FACILITY_TYPE_VALUES.includes(type);
}

// Facility type display helpers
export function getFacilityTypeLabel(type, useShortLabel = false) {
    const facilityType = FACILITY_TYPE_OPTIONS.find(option => option.value === type);
    if (!facilityType) {
        return type || 'Unknown';
    }
    return useShortLabel ? facilityType.shortLabel : facilityType.label;
}

export function getFacilityTypeDescription(type) {
    const facilityType = FACILITY_TYPE_OPTIONS.find(option => option.value === type);
    return facilityType ? facilityType.description : 'Unknown facility type';
}

// Facility type icon mapping
export function getFacilityTypeIcon(type) {
    switch (type) {
        case FACILITY_TYPES.ASC:
            return 'fas fa-clinic-medical';
        case FACILITY_TYPES.HOSPITAL:
            return 'fas fa-hospital';
        case FACILITY_TYPES.OBL:
            return 'fas fa-user-md';
        default:
            return 'fas fa-building';
    }
}

// Facility type color mapping for UI consistency
export function getFacilityTypeColor(type) {
    switch (type) {
        case FACILITY_TYPES.ASC:
            return '#10B981'; // Green
        case FACILITY_TYPES.HOSPITAL:
            return '#3B82F6'; // Blue
        case FACILITY_TYPES.OBL:
            return '#8B5CF6'; // Purple
        default:
            return '#6B7280'; // Gray
    }
}

// Facility type CSS class mapping
export function getFacilityTypeClass(type) {
    switch (type) {
        case FACILITY_TYPES.ASC:
            return 'facility-type-asc';
        case FACILITY_TYPES.HOSPITAL:
            return 'facility-type-hospital';
        case FACILITY_TYPES.OBL:
            return 'facility-type-obl';
        default:
            return 'facility-type-unknown';
    }
}

// UI Population Helper - Central function to populate dropdowns
export function populateFacilityTypeDropdown(selectElement, options = {}) {
    if (!selectElement) {
        console.error('FacilityTypes.populateFacilityTypeDropdown: selectElement is null');
        return;
    }
    
    const {
        includeAllOption = true,
        allOptionText = 'All Facility Types',
        includeEmptyOption = false,
        emptyOptionText = 'Select Facility Type...',
        selectedValue = null,
        filterTypes = null, // array of facility type values to include/exclude
        useShortLabels = false
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
    if (includeEmptyOption) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = emptyOptionText;
        selectElement.appendChild(emptyOption);
    }
    
    // Get facility types to display
    let typesToShow = FACILITY_TYPE_OPTIONS;
    if (filterTypes && Array.isArray(filterTypes)) {
        typesToShow = FACILITY_TYPE_OPTIONS.filter(option => 
            filterTypes.includes(option.value)
        );
    }
    
    // Add facility type options
    typesToShow.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = useShortLabels ? option.shortLabel : option.label;
        if (selectedValue === option.value) {
            optionElement.selected = true;
        }
        selectElement.appendChild(optionElement);
    });
}

// Helper to get all facility types as HTML string (for dynamic insertion)
export function getFacilityTypeOptionsHTML(options = {}) {
    const {
        includeAllOption = true,
        allOptionText = 'All Facility Types',
        includeEmptyOption = false,
        emptyOptionText = 'Select Facility Type...',
        selectedValue = null,
        filterTypes = null,
        useShortLabels = false
    } = options;
    
    let html = '';
    
    // Add "All" option if requested
    if (includeAllOption) {
        html += `<option value="">${allOptionText}</option>`;
    }
    
    // Add empty/placeholder option if requested  
    if (includeEmptyOption) {
        html += `<option value="">${emptyOptionText}</option>`;
    }
    
    // Get facility types to display
    let typesToShow = FACILITY_TYPE_OPTIONS;
    if (filterTypes && Array.isArray(filterTypes)) {
        typesToShow = FACILITY_TYPE_OPTIONS.filter(option => 
            filterTypes.includes(option.value)
        );
    }
    
    // Add facility type options
    typesToShow.forEach(option => {
        const selected = selectedValue === option.value ? ' selected' : '';
        const label = useShortLabels ? option.shortLabel : option.label;
        html += `<option value="${option.value}"${selected}>${label}</option>`;
    });
    
    return html;
}

// Statistics helpers
export function getFacilityTypeStats(facilities) {
    const stats = {
        total: facilities.length,
        byType: {}
    };
    
    // Initialize counts
    FACILITY_TYPE_VALUES.forEach(type => {
        stats.byType[type] = 0;
    });
    
    // Count facilities by type
    facilities.forEach(facility => {
        if (facility.type && stats.byType.hasOwnProperty(facility.type)) {
            stats.byType[facility.type]++;
        }
    });
    
    return stats;
}

// For debugging and logging
export function getFacilityTypeInfo() {
    return {
        availableTypes: FACILITY_TYPE_VALUES,
        defaultType: DEFAULT_FACILITY_TYPE,
        totalCount: FACILITY_TYPE_VALUES.length,
        typeDescriptions: FACILITY_TYPE_OPTIONS.reduce((acc, option) => {
            acc[option.value] = option.description;
            return acc;
        }, {})
    };
}