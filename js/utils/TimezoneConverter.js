// js/utils/TimezoneConverter.js - Universal Timezone Converter
// Converts between CDT (Central Daylight Time) and UTC for consistent storage

export class TimezoneConverter {
    constructor() {
        // Define the application's local timezone (Central Time)
        this.LOCAL_TIMEZONE = 'America/Chicago'; // Handles CDT/CST automatically
        this.UTC_TIMEZONE = 'UTC';
    }

    /**
     * Convert a local date/time input (assumed to be CDT) to UTC for Firestore storage
     * @param {string|Date} dateTimeInput - Date/time in CDT timezone
     * @returns {Date} UTC Date object for Firestore storage
     */
    convertToUTC(dateTimeInput) {
        if (!dateTimeInput) return null;

        let inputDate;
        
        if (typeof dateTimeInput === 'string') {
            // Handle different string formats
            if (dateTimeInput.includes('T')) {
                // ISO format: "2024-01-15T14:30:00"
                inputDate = dateTimeInput;
            } else if (dateTimeInput.includes(' ')) {
                // Format: "2024-01-15 14:30"
                inputDate = dateTimeInput.replace(' ', 'T');
            } else {
                // Just date: "2024-01-15"
                inputDate = dateTimeInput + 'T12:00:00'; // Default to noon
            }
        } else if (dateTimeInput instanceof Date) {
            // Convert Date object to local ISO string
            const year = dateTimeInput.getFullYear();
            const month = String(dateTimeInput.getMonth() + 1).padStart(2, '0');
            const day = String(dateTimeInput.getDate()).padStart(2, '0');
            const hours = String(dateTimeInput.getHours()).padStart(2, '0');
            const minutes = String(dateTimeInput.getMinutes()).padStart(2, '0');
            inputDate = `${year}-${month}-${day}T${hours}:${minutes}:00`;
        } else {
            throw new Error('Invalid date input format');
        }

        // Parse as a local date/time, then adjust to UTC
        const localDate = new Date(inputDate + 'Z'); // Temporarily treat as UTC to parse
        const tempDate = new Date(inputDate); // For DST calculation
        const cdtOffset = this.getCDTOffset(tempDate);
        
        // Adjust: Add offset because we're converting FROM CDT TO UTC
        const utcDate = new Date(localDate.getTime() + (cdtOffset * 60 * 1000));
        
        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.debug('Date converted to UTC', {
                input: dateTimeInput,
                parsedLocal: inputDate,
                cdtOffset: cdtOffset,
                utcResult: utcDate.toISOString()
            }, 'timezone-conversion');
        }

        return utcDate;
    }

    /**
     * Convert UTC date from Firestore back to CDT for display
     * @param {Date|string} utcDate - UTC date from Firestore
     * @returns {Date} Date object in CDT timezone
     */
    convertFromUTC(utcDate) {
        if (!utcDate) return null;

        let utcDateObj;
        if (typeof utcDate === 'string') {
            utcDateObj = new Date(utcDate);
        } else if (utcDate instanceof Date) {
            utcDateObj = new Date(utcDate);
        } else {
            throw new Error('Invalid UTC date format');
        }

        // Convert UTC to local timezone
        const cdtOffset = this.getCDTOffset(utcDateObj);
        // Subtract offset because we're converting FROM UTC TO CDT
        const localDate = new Date(utcDateObj.getTime() - (cdtOffset * 60 * 1000));

        if (window.is_enable_api_logging && window.frontendLogger) {
            window.frontendLogger.debug('Date converted from UTC', {
                utcInput: utcDateObj.toISOString(),
                cdtOffset: cdtOffset,
                localResult: localDate.toISOString()
            }, 'timezone-conversion');
        }

        return localDate;
    }

    /**
     * Get the CDT offset in minutes from UTC
     * Handles both CDT (-5 hours) and CST (-6 hours)
     * @param {Date} date - Date to check DST for
     * @returns {number} Offset in minutes (positive = behind UTC)
     */
    getCDTOffset(date) {
        // Create dates to check if we're in DST
        const year = date.getFullYear();
        
        // DST in US: Second Sunday in March to First Sunday in November
        const dstStart = this.getNthSundayOfMonth(year, 3, 2); // March, 2nd Sunday
        const dstEnd = this.getNthSundayOfMonth(year, 11, 1);  // November, 1st Sunday
        
        const isDST = date >= dstStart && date < dstEnd;
        
        // CDT is UTC-5, CST is UTC-6
        return isDST ? 5 * 60 : 6 * 60; // Return minutes
    }

    /**
     * Get the Nth Sunday of a specific month
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @param {number} n - Which Sunday (1 = first, 2 = second, etc.)
     * @returns {Date} Date of the Nth Sunday
     */
    getNthSundayOfMonth(year, month, n) {
        const firstDay = new Date(year, month - 1, 1);
        const firstSunday = new Date(firstDay);
        firstSunday.setDate(1 + (7 - firstDay.getDay()) % 7);
        
        const nthSunday = new Date(firstSunday);
        nthSunday.setDate(firstSunday.getDate() + (n - 1) * 7);
        
        return nthSunday;
    }

    /**
     * Format a date for display with CDT timezone indicator
     * @param {Date} date - Date to format (assumed to be in CDT)
     * @param {boolean} includeTime - Whether to include time
     * @returns {string} Formatted date string
     */
    formatForDisplay(date, includeTime = true) {
        if (!date) return '';

        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = true;
        }

        const formatted = date.toLocaleString('en-US', options);
        const tzAbbr = this.getTimezoneAbbreviation(date);
        
        return includeTime ? `${formatted} (${tzAbbr})` : `${formatted}`;
    }

    /**
     * Format a date for HTML datetime-local input
     * @param {Date} date - Date to format
     * @returns {string} YYYY-MM-DDTHH:MM format
     */
    formatForInput(date) {
        if (!date) return '';

        // Convert to local timezone first
        const localDate = this.convertFromUTC(date);
        
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const hours = String(localDate.getHours()).padStart(2, '0');
        const minutes = String(localDate.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * Get current timezone abbreviation (CDT or CST)
     * @param {Date} date - Date to check DST for
     * @returns {string} Timezone abbreviation
     */
    getTimezoneAbbreviation(date = new Date()) {
        const isDST = this.getCDTOffset(date) === 5 * 60; // 5 hours = CDT
        return isDST ? 'CDT' : 'CST';
    }

    /**
     * Add timezone indicator to form labels
     * @param {string} labelText - Original label text
     * @returns {string} Label with timezone indicator
     */
    addTimezoneToLabel(labelText) {
        const tzAbbr = this.getTimezoneAbbreviation();
        return `${labelText} (in ${tzAbbr})`;
    }

    /**
     * Validate if a date/time string is valid
     * @param {string} dateTimeString - Date/time string to validate
     * @returns {boolean} True if valid
     */
    isValidDateTime(dateTimeString) {
        if (!dateTimeString) return false;
        const date = new Date(dateTimeString);
        return !isNaN(date.getTime());
    }

    /**
     * Get current date/time in CDT for default values
     * @returns {string} Current date/time in YYYY-MM-DDTHH:MM format
     */
    getCurrentLocalDateTime() {
        const now = new Date();
        return this.formatForInput(now);
    }
}

// Create a global instance
export const timezoneConverter = new TimezoneConverter();

// Make it available globally for easy access
if (typeof window !== 'undefined') {
    window.timezoneConverter = timezoneConverter;
}