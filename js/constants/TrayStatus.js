/**
 * Centralized Tray Status Constants
 * Single source of truth for all tray status values used throughout the application
 * These match the MyRepData compatibility format
 */

export const TRAY_STATUS = {
    // Core statuses used in MyRepData
    AVAILABLE: "available",     // Ready for use
    IN_USE: "in_use",          // Currently in surgery
    CLEANING: "cleaning",       // Being processed/cleaned
    MAINTENANCE: "maintenance", // Under repair
    MISSING: "missing",        // Lost/unaccounted for
    UNKNOWN: "unknown",        // Status could not be determined
    
    // Additional statuses for workflow tracking
    CHECKED_IN: "checked_in",   // Checked in for a specific case
    PICKED_UP: "picked_up"      // Picked up from storage
};

// Helper function to normalize status strings (handles legacy formats)
export function normalizeStatus(status) {
    if (!status) return TRAY_STATUS.UNKNOWN;
    
    const normalized = status.toLowerCase().trim();
    
    // Handle legacy formats with hyphens
    const statusMap = {
        'in-use': TRAY_STATUS.IN_USE,
        'checked-in': TRAY_STATUS.CHECKED_IN,
        'picked-up': TRAY_STATUS.PICKED_UP,
        'in_use': TRAY_STATUS.IN_USE,
        'checked_in': TRAY_STATUS.CHECKED_IN,
        'picked_up': TRAY_STATUS.PICKED_UP,
        'available': TRAY_STATUS.AVAILABLE,
        'cleaning': TRAY_STATUS.CLEANING,
        'maintenance': TRAY_STATUS.MAINTENANCE,
        'missing': TRAY_STATUS.MISSING,
        'unknown': TRAY_STATUS.UNKNOWN
    };
    
    return statusMap[normalized] || TRAY_STATUS.UNKNOWN;
}

// Helper function to check if status is active/in-use
export function isInUseStatus(status) {
    const normalized = normalizeStatus(status);
    return normalized === TRAY_STATUS.IN_USE;
}

// Helper function to check if status means tray is ready/available
export function isAvailableStatus(status) {
    const normalized = normalizeStatus(status);
    return normalized === TRAY_STATUS.AVAILABLE;
}

// Helper function to check if status means tray is checked in
export function isCheckedInStatus(status) {
    const normalized = normalizeStatus(status);
    return normalized === TRAY_STATUS.CHECKED_IN || normalized === TRAY_STATUS.PICKED_UP;
}

// Helper function to get display-friendly status text
export function getStatusDisplayText(status) {
    const normalized = normalizeStatus(status);
    
    const displayMap = {
        [TRAY_STATUS.AVAILABLE]: 'Available',
        [TRAY_STATUS.IN_USE]: 'In Use',
        [TRAY_STATUS.CLEANING]: 'Cleaning',
        [TRAY_STATUS.MAINTENANCE]: 'Maintenance',
        [TRAY_STATUS.MISSING]: 'Missing',
        [TRAY_STATUS.UNKNOWN]: 'Unknown',
        [TRAY_STATUS.CHECKED_IN]: 'Checked In',
        [TRAY_STATUS.PICKED_UP]: 'Picked Up'
    };
    
    return displayMap[normalized] || 'Unknown';
}

// Helper function to get status color/class for UI
export function getStatusColor(status) {
    const normalized = normalizeStatus(status);
    
    const colorMap = {
        [TRAY_STATUS.AVAILABLE]: 'success',      // Green
        [TRAY_STATUS.IN_USE]: 'warning',         // Yellow/Orange
        [TRAY_STATUS.CLEANING]: 'info',          // Blue
        [TRAY_STATUS.MAINTENANCE]: 'secondary',  // Gray
        [TRAY_STATUS.MISSING]: 'danger',         // Red
        [TRAY_STATUS.UNKNOWN]: 'dark',           // Dark gray
        [TRAY_STATUS.CHECKED_IN]: 'primary',     // Primary blue
        [TRAY_STATUS.PICKED_UP]: 'primary'       // Primary blue
    };
    
    return colorMap[normalized] || 'dark';
}

// All possible status values (for validation)
export const ALL_STATUSES = Object.values(TRAY_STATUS);