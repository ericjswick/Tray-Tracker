// Implant Type Constants - Single source of truth for all implant types
// Order: Active, Inactive

// Since implant types are custom defined by users, we focus on status rather than types
export const IMPLANT_TYPE_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

// Array of all valid statuses for dropdowns and validation (in proper order)
export const IMPLANT_TYPE_STATUS_OPTIONS = [
    { value: IMPLANT_TYPE_STATUS.ACTIVE, label: 'Active' },
    { value: IMPLANT_TYPE_STATUS.INACTIVE, label: 'Inactive' }
];

// Array of status values only
export const IMPLANT_TYPE_STATUS_VALUES = Object.values(IMPLANT_TYPE_STATUS);

// Default status for new implant types
export const DEFAULT_IMPLANT_TYPE_STATUS = IMPLANT_TYPE_STATUS.ACTIVE;

// Status validation function
export function isValidImplantTypeStatus(status) {
    return IMPLANT_TYPE_STATUS_VALUES.includes(status);
}

// Status display helpers
export function getImplantTypeStatusLabel(status) {
    return status || DEFAULT_IMPLANT_TYPE_STATUS;
}

export function getImplantTypeStatusClass(status) {
    switch (status) {
        case IMPLANT_TYPE_STATUS.ACTIVE:
            return 'status-active';
        case IMPLANT_TYPE_STATUS.INACTIVE:
            return 'status-inactive';
        default:
            return 'status-active';
    }
}

// Status display text helper
export function getImplantTypeStatusDisplayText(status) {
    switch (status) {
        case IMPLANT_TYPE_STATUS.ACTIVE:
            return 'Active';
        case IMPLANT_TYPE_STATUS.INACTIVE:
            return 'Inactive';
        default:
            return 'Active';
    }
}

// Status filtering helpers
export function getActiveImplantTypeStatuses() {
    return [IMPLANT_TYPE_STATUS.ACTIVE];
}

export function getInactiveImplantTypeStatuses() {
    return [IMPLANT_TYPE_STATUS.INACTIVE];
}

// Status category helpers
export function isActiveImplantType(status) {
    return status === IMPLANT_TYPE_STATUS.ACTIVE;
}

export function isInactiveImplantType(status) {
    return status === IMPLANT_TYPE_STATUS.INACTIVE;
}

// UI Population Helper - Central function to populate dropdowns
export function populateImplantTypeStatusDropdown(selectElement, options = {}) {
    if (!selectElement) {
        console.error('ImplantType.populateImplantTypeStatusDropdown: selectElement is null');
        return;
    }

    const {
        includeAllOption = true,
        allOptionText = 'All Status',
        includeEmptyOption = false,
        emptyOptionText = 'Select Status...',
        selectedValue = null,
        filterStatuses = null // array of status values to include/exclude
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

    // Get status options to display
    let statusesToShow = IMPLANT_TYPE_STATUS_OPTIONS;
    if (filterStatuses && Array.isArray(filterStatuses)) {
        statusesToShow = IMPLANT_TYPE_STATUS_OPTIONS.filter(option =>
            filterStatuses.includes(option.value)
        );
    }

    // Add status options
    statusesToShow.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        if (selectedValue === option.value) {
            optionElement.selected = true;
        }
        selectElement.appendChild(optionElement);
    });
}

// Helper to get all status options as HTML string (for dynamic insertion)
export function getImplantTypeStatusOptionsHTML(options = {}) {
    const {
        includeAllOption = true,
        allOptionText = 'All Status',
        includeEmptyOption = false,
        emptyOptionText = 'Select Status...',
        selectedValue = null,
        filterStatuses = null
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

    // Get status options to display
    let statusesToShow = IMPLANT_TYPE_STATUS_OPTIONS;
    if (filterStatuses && Array.isArray(filterStatuses)) {
        statusesToShow = IMPLANT_TYPE_STATUS_OPTIONS.filter(option =>
            filterStatuses.includes(option.value)
        );
    }

    // Add status options
    statusesToShow.forEach(option => {
        const selected = selectedValue === option.value ? ' selected' : '';
        html += `<option value="${option.value}"${selected}>${option.label}</option>`;
    });

    return html;
}

// For debugging and logging
export function getImplantTypeInfo() {
    return {
        availableStatuses: IMPLANT_TYPE_STATUS_VALUES,
        defaultStatus: DEFAULT_IMPLANT_TYPE_STATUS,
        totalCount: IMPLANT_TYPE_STATUS_VALUES.length,
        statusOrder: 'Active → Inactive'
    };
}