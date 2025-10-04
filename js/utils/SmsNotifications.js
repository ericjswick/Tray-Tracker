// js/utils/SmsNotifications.js - SMS notification utility for TrayTracker
export class SmsNotifications {
    constructor() {
        // API endpoint will be determined based on current environment
        this.apiEndpoint = this.getApiEndpoint();
    }

    getApiEndpoint() {
        // In production, this will be the production domain
        // In development, it could be localhost or dev environment
        const baseUrl = window.location.origin;
        return `${baseUrl}/api/notifications`;
    }

    /**
     * Send an SMS notification
     * @param {Object} smsData - SMS configuration
     * @param {string} smsData.to - Recipient phone number (E.164 format preferred)
     * @param {string} smsData.message - SMS message content
     * @returns {Promise<Object>} - Response from the SMS API
     */
    async sendSMS(smsData) {
        try {
            console.log('📱 Sending SMS notification:', {
                to: smsData.to,
                messageLength: smsData.message?.length
            });

            const response = await fetch(`${this.apiEndpoint}/sms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(smsData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`SMS API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ SMS sent successfully:', result);
            return result;

        } catch (error) {
            console.error('❌ Failed to send SMS:', error);
            throw error;
        }
    }

    /**
     * Send a tray status change notification via SMS
     * @param {Object} trayData - Tray information
     * @param {string} previousStatus - Previous tray status
     * @param {string} newStatus - New tray status
     * @param {Array<Object>} users - Array of user objects with phone numbers
     * @param {Object} additionalInfo - Additional context information
     */
    async sendTrayStatusNotification(trayData, previousStatus, newStatus, users, additionalInfo = {}) {
        try {
            console.log('📢 Sending tray status SMS notifications to users:', {
                trayId: trayData.id,
                trayName: trayData.tray_name,
                statusChange: `${previousStatus} → ${newStatus}`,
                userCount: users.length
            });

            const response = await fetch(`${this.apiEndpoint}/tray-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    trayId: trayData.id,
                    trayName: trayData.tray_name || trayData.name,
                    previousStatus,
                    newStatus,
                    changedBy: additionalInfo.userName || additionalInfo.changedBy,
                    timestamp: new Date().toISOString(),
                    users: users.map(user => ({
                        id: user.id,
                        name: user.name,
                        phone: user.phone
                    }))
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Tray status SMS API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Tray status SMS notifications sent:', result);
            return result;

        } catch (error) {
            console.error('❌ Failed to send tray status SMS notifications:', error);
            throw error;
        }
    }

    /**
     * Send SMS to multiple recipients
     * @param {Array<string>} phoneNumbers - Array of phone numbers
     * @param {string} message - SMS message content
     * @returns {Promise<Array>} - Array of results for each SMS sent
     */
    async sendBulkSMS(phoneNumbers, message) {
        const results = [];

        for (const phoneNumber of phoneNumbers) {
            try {
                const result = await this.sendSMS({
                    to: phoneNumber,
                    message: message
                });
                results.push({
                    phoneNumber,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    phoneNumber,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Test SMS sending functionality
     * @returns {Promise<Object>} - Test result
     */
    async testSMS() {
        try {
            console.log('🧪 Testing SMS functionality...');

            const response = await fetch(`${this.apiEndpoint}/sms/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`SMS test API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ SMS test completed:', result);
            return result;

        } catch (error) {
            console.error('❌ SMS test failed:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const smsNotifications = new SmsNotifications();
