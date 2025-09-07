// Case Status Constants - Single source of truth for all case statuses
export const CASE_STATUS = {
    SCHEDULED: 'Scheduled',
    CANCELED: 'Canceled', 
    COMPLETE: 'Complete'
};

// Array of all valid statuses for dropdowns and validation
export const CASE_STATUS_OPTIONS = [
    { value: CASE_STATUS.SCHEDULED, label: 'Scheduled' },
    { value: CASE_STATUS.CANCELED, label: 'Canceled' },
    { value: CASE_STATUS.COMPLETE, label: 'Complete' }
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
        case CASE_STATUS.CANCELED:
            return 'status-canceled';
        case CASE_STATUS.COMPLETE:
            return 'status-complete';
        default:
            return 'status-scheduled';
    }
}

// For debugging and logging
export function getCaseStatusInfo() {
    return {
        availableStatuses: CASE_STATUS_VALUES,
        defaultStatus: DEFAULT_CASE_STATUS,
        totalCount: CASE_STATUS_VALUES.length
    };
}