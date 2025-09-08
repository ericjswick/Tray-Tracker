// Case Status Constants - Single source of truth for all case statuses
// Order: Scheduled, Set, Cancelled, Complete, Removed
export const CASE_STATUS = {
    SCHEDULED: 'Scheduled',
    SET: 'Set',
    CANCELLED: 'Cancelled',
    COMPLETE: 'Complete',
    REMOVED: 'Removed'
};

// Array of all valid statuses for dropdowns and validation (in proper order)
export const CASE_STATUS_OPTIONS = [
    { value: CASE_STATUS.SCHEDULED, label: 'Scheduled' },
    { value: CASE_STATUS.SET, label: 'Set' },
    { value: CASE_STATUS.CANCELLED, label: 'Cancelled' },
    { value: CASE_STATUS.COMPLETE, label: 'Complete' },
    { value: CASE_STATUS.REMOVED, label: 'Removed' }
];

// Array of status values only
export const CASE_STATUS_VALUES = Object.values(CASE_STATUS);

// Default status for new cases
export const DEFAULT_CASE_STATUS = CASE_STATUS.SCHEDULED;

// Status validation function
export function isValidCaseStatus(status) {
    return CASE_STATUS_VALUES.includes(status);
}

// Status display helpers
export function getCaseStatusLabel(status) {
    return status || DEFAULT_CASE_STATUS;
}

export function getCaseStatusClass(status) {
    switch (status) {
        case CASE_STATUS.SCHEDULED:
            return 'status-scheduled';
        case CASE_STATUS.SET:
            return 'status-set';
        case CASE_STATUS.CANCELLED:
            return 'status-cancelled';
        case CASE_STATUS.COMPLETE:
            return 'status-complete';
        case CASE_STATUS.REMOVED:
            return 'status-removed';
        default:
            return 'status-scheduled';
    }
}

// Status progression helpers
export function getNextCaseStatus(currentStatus) {
    const statusOrder = [
        CASE_STATUS.SCHEDULED,
        CASE_STATUS.SET,
        CASE_STATUS.CANCELLED,
        CASE_STATUS.COMPLETE,
        CASE_STATUS.REMOVED
    ];
    
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === statusOrder.length - 1) {
        return currentStatus; // Return current if not found or if it's the last status
    }
    
    return statusOrder[currentIndex + 1];
}

export function getPreviousCaseStatus(currentStatus) {
    const statusOrder = [
        CASE_STATUS.SCHEDULED,
        CASE_STATUS.SET,
        CASE_STATUS.CANCELLED,
        CASE_STATUS.COMPLETE,
        CASE_STATUS.REMOVED
    ];
    
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex <= 0) {
        return currentStatus; // Return current if not found or if it's the first status
    }
    
    return statusOrder[currentIndex - 1];
}

// Status category helpers
export function isActiveCaseStatus(status) {
    return status === CASE_STATUS.SCHEDULED || status === CASE_STATUS.SET;
}

export function isCompletedCaseStatus(status) {
    return status === CASE_STATUS.COMPLETE;
}

export function isInactiveCaseStatus(status) {
    return status === CASE_STATUS.CANCELLED || status === CASE_STATUS.REMOVED;
}

// Status filtering helpers
export function getActiveCaseStatuses() {
    return [CASE_STATUS.SCHEDULED, CASE_STATUS.SET];
}

export function getCompletedCaseStatuses() {
    return [CASE_STATUS.COMPLETE];
}

export function getInactiveCaseStatuses() {
    return [CASE_STATUS.CANCELLED, CASE_STATUS.REMOVED];
}

// UI Population Helper - Central function to populate dropdowns
export function populateCaseStatusDropdown(selectElement, options = {}) {
    if (!selectElement) {
        console.error('CaseStatus.populateCaseStatusDropdown: selectElement is null');
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
    let statusesToShow = CASE_STATUS_OPTIONS;
    if (filterStatuses && Array.isArray(filterStatuses)) {
        statusesToShow = CASE_STATUS_OPTIONS.filter(option => 
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
export function getCaseStatusOptionsHTML(options = {}) {
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
    let statusesToShow = CASE_STATUS_OPTIONS;
    if (filterStatuses && Array.isArray(filterStatuses)) {
        statusesToShow = CASE_STATUS_OPTIONS.filter(option => 
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
export function getCaseStatusInfo() {
    return {
        availableStatuses: CASE_STATUS_VALUES,
        defaultStatus: DEFAULT_CASE_STATUS,
        totalCount: CASE_STATUS_VALUES.length,
        statusOrder: 'Scheduled → Set → Cancelled → Complete → Removed'
    };
}