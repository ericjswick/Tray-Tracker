// UserRoles.js - Centralized user role management system

// User Role Constants
export const USER_ROLES = {
    ADMIN: 'Admin',
    TERRITORY_MANAGER: 'Territory Manager',
    MANAGER: 'Manager',
    SALES_REP: 'Sales Rep',
    CLINICAL_SPECIALIST: 'Clinical Specialist'
};

// Role Display Labels (for forms and UI)
export const ROLE_LABELS = {
    [USER_ROLES.ADMIN]: 'Administrator',
    [USER_ROLES.TERRITORY_MANAGER]: 'Territory Manager',
    [USER_ROLES.MANAGER]: 'Manager',
    [USER_ROLES.SALES_REP]: 'Sales Rep',
    [USER_ROLES.CLINICAL_SPECIALIST]: 'Clinical Specialist'
};

// Role CSS Classes for styling
export const ROLE_CSS_CLASSES = {
    [USER_ROLES.ADMIN]: 'role-admin',
    [USER_ROLES.TERRITORY_MANAGER]: 'role-manager',
    [USER_ROLES.MANAGER]: 'role-manager',
    [USER_ROLES.SALES_REP]: 'role-rep',
    [USER_ROLES.CLINICAL_SPECIALIST]: 'role-specialist'
};

// Role hierarchy levels (higher number = more permissions)
export const ROLE_HIERARCHY = {
    [USER_ROLES.ADMIN]: 100,
    [USER_ROLES.TERRITORY_MANAGER]: 80,
    [USER_ROLES.MANAGER]: 70,
    [USER_ROLES.CLINICAL_SPECIALIST]: 50,
    [USER_ROLES.SALES_REP]: 30
};

// Role groups for filtering and statistics
export const ROLE_GROUPS = {
    MANAGEMENT: [USER_ROLES.ADMIN, USER_ROLES.TERRITORY_MANAGER, USER_ROLES.MANAGER],
    FIELD_STAFF: [USER_ROLES.SALES_REP, USER_ROLES.CLINICAL_SPECIALIST],
    ALL: Object.values(USER_ROLES)
};

/**
 * Get all available roles as an array
 * @returns {Array} Array of role values
 */
export function getAllRoles() {
    return Object.values(USER_ROLES);
}

/**
 * Get role display label
 * @param {string} role - The role value
 * @returns {string} Display label for the role
 */
export function getRoleLabel(role) {
    return ROLE_LABELS[role] || role || 'Unknown Role';
}

/**
 * Get CSS class for a role
 * @param {string} role - The role value
 * @returns {string} CSS class for styling
 */
export function getRoleClass(role) {
    return ROLE_CSS_CLASSES[role] || 'role-rep';
}

/**
 * Check if a role is valid
 * @param {string} role - The role to validate
 * @returns {boolean} True if role is valid
 */
export function isValidRole(role) {
    return Object.values(USER_ROLES).includes(role);
}

/**
 * Get role hierarchy level
 * @param {string} role - The role value
 * @returns {number} Hierarchy level (higher = more permissions)
 */
export function getRoleLevel(role) {
    return ROLE_HIERARCHY[role] || 0;
}

/**
 * Check if role1 has higher or equal permissions than role2
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} True if role1 >= role2 in hierarchy
 */
export function roleHasPermission(role1, role2) {
    return getRoleLevel(role1) >= getRoleLevel(role2);
}

/**
 * Filter users by role group
 * @param {Array} users - Array of user objects
 * @param {string} groupName - Group name from ROLE_GROUPS
 * @returns {Array} Filtered users
 */
export function filterUsersByRoleGroup(users, groupName) {
    const roles = ROLE_GROUPS[groupName];
    if (!roles) return [];
    return users.filter(user => roles.includes(user.role));
}

/**
 * Get role statistics from users array
 * @param {Array} users - Array of user objects
 * @returns {Object} Role statistics
 */
export function getRoleStats(users) {
    const stats = {
        total: users.length,
        active: users.filter(u => u.active !== false).length
    };

    // Count by individual roles
    getAllRoles().forEach(role => {
        const key = role.toLowerCase().replace(/\s+/g, '_');
        stats[key] = users.filter(u => u.role === role).length;
    });

    // Count by role groups
    stats.management = filterUsersByRoleGroup(users, 'MANAGEMENT').length;
    stats.field_staff = filterUsersByRoleGroup(users, 'FIELD_STAFF').length;

    // Legacy aliases for backwards compatibility
    stats.managers = stats.management;
    stats.reps = stats.sales_rep;

    return stats;
}

/**
 * Generate HTML options for role dropdown
 * @param {string} selectedRole - Currently selected role (optional)
 * @param {boolean} includeEmpty - Whether to include empty "Select Role..." option
 * @returns {string} HTML option elements
 */
export function generateRoleOptions(selectedRole = '', includeEmpty = true) {
    let html = '';

    if (includeEmpty) {
        html += '<option value="">Select Role...</option>';
    }

    getAllRoles().forEach(role => {
        const selected = role === selectedRole ? 'selected' : '';
        const label = getRoleLabel(role);
        html += `<option value="${role}" ${selected}>${label}</option>`;
    });

    return html;
}

/**
 * Populate a select element with role options
 * @param {string|HTMLElement} selectElement - Select element ID or DOM element
 * @param {string} selectedRole - Currently selected role (optional)
 * @param {boolean} includeEmpty - Whether to include empty option
 */
export function populateRoleSelect(selectElement, selectedRole = '', includeEmpty = true) {
    const element = typeof selectElement === 'string'
        ? document.getElementById(selectElement)
        : selectElement;

    if (!element) {
        console.error('Role select element not found:', selectElement);
        return;
    }

    element.innerHTML = generateRoleOptions(selectedRole, includeEmpty);
}

/**
 * Get roles that can manage other roles (management roles)
 * @returns {Array} Array of management role values
 */
export function getManagementRoles() {
    return ROLE_GROUPS.MANAGEMENT;
}

/**
 * Get field staff roles
 * @returns {Array} Array of field staff role values
 */
export function getFieldStaffRoles() {
    return ROLE_GROUPS.FIELD_STAFF;
}

/**
 * Check if role is a management role
 * @param {string} role - Role to check
 * @returns {boolean} True if management role
 */
export function isManagementRole(role) {
    return getManagementRoles().includes(role);
}

/**
 * Check if role is a field staff role
 * @param {string} role - Role to check
 * @returns {boolean} True if field staff role
 */
export function isFieldStaffRole(role) {
    return getFieldStaffRoles().includes(role);
}