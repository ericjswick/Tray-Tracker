/**
 * Central utility for physician name formatting
 * Provides consistent physician name display across the application
 */

/**
 * Get formatted physician name from ID
 * @param {string} physicianId - The physician's document ID
 * @param {Array} physicians - Array of physician objects from DataManager
 * @returns {string|null} Formatted physician name (e.g., "Dr. John Smith") or null if not found
 */
export function getPhysicianName(physicianId, physicians) {
    if (!physicianId) return null;

    if (physicians && physicians.length > 0) {
        const physician = physicians.find(p => p && p.id === physicianId);
        if (physician) {
            // Handle both full_name and first_name/last_name formats
            const name = physician.full_name ||
                        (physician.first_name && physician.last_name ?
                         `${physician.first_name} ${physician.last_name}` :
                         physician.first_name || physician.last_name || 'Unknown');
            return `${physician.title || 'Dr.'} ${name}`;
        }
    }
    return null;
}
