// js/utils/EmailNotifications.js - Email notification utility for TrayTracker
export class EmailNotifications {
    constructor() {
        // API endpoint will be determined based on current environment
        this.apiEndpoint = this.getApiEndpoint();
    }

    getApiEndpoint() {
        // In production, this will be the Vercel domain
        // In development, it could be localhost or dev environment
        const baseUrl = window.location.origin;
        return `${baseUrl}/api/notifications/email`;
    }

    /**
     * Send an email notification
     * @param {Object} emailData - Email configuration
     * @param {string} emailData.to - Recipient email address
     * @param {string} emailData.subject - Email subject
     * @param {string} emailData.text - Plain text content (optional if html is provided)
     * @param {string} emailData.html - HTML content (optional if text is provided)
     * @param {string} emailData.from - Sender email (optional)
     * @returns {Promise<Object>} - Response from the email API
     */
    async sendEmail(emailData) {
        try {
            console.log('📧 Sending email notification:', {
                to: emailData.to,
                subject: emailData.subject,
                hasText: !!emailData.text,
                hasHtml: !!emailData.html
            });

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Email API error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Email sent successfully:', result);
            return result;

        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw error;
        }
    }

    /**
     * Send a tray status change notification
     * @param {Object} trayData - Tray information
     * @param {string} action - Action performed (e.g., 'checked-in', 'picked-up', 'assigned')
     * @param {string} recipientEmail - Email address to notify
     * @param {Object} additionalInfo - Additional context information
     */
    async sendTrayNotification(trayData, action, recipientEmail, additionalInfo = {}) {
        const trayName = trayData.tray_name || trayData.name || 'Unknown Tray';
        const facility = additionalInfo.facilityName || trayData.facility || 'Unknown Facility';
        const user = additionalInfo.userName || additionalInfo.user || 'System';
        
        let subject, htmlContent, textContent;

        switch (action) {
            case 'checked-in':
                subject = `Tray ${trayName} checked in at ${facility}`;
                textContent = `The tray "${trayName}" has been checked in at ${facility} by ${user}.`;
                htmlContent = `
                    <h3>Tray Check-in Notification</h3>
                    <p>The tray <strong>"${trayName}"</strong> has been checked in at <strong>${facility}</strong> by ${user}.</p>
                    <p><strong>Tray Details:</strong></p>
                    <ul>
                        <li>Status: ${trayData.status || 'Unknown'}</li>
                        <li>Location: ${trayData.location || 'Unknown'}</li>
                        <li>Time: ${new Date().toLocaleString()}</li>
                    </ul>
                `;
                break;

            case 'picked-up':
                subject = `Tray ${trayName} picked up from ${facility}`;
                textContent = `The tray "${trayName}" has been picked up from ${facility} by ${user}.`;
                htmlContent = `
                    <h3>Tray Pickup Notification</h3>
                    <p>The tray <strong>"${trayName}"</strong> has been picked up from <strong>${facility}</strong> by ${user}.</p>
                    <p><strong>Tray Details:</strong></p>
                    <ul>
                        <li>Status: ${trayData.status || 'Unknown'}</li>
                        <li>Previous Location: ${trayData.location || 'Unknown'}</li>
                        <li>Time: ${new Date().toLocaleString()}</li>
                    </ul>
                `;
                break;

            case 'assigned':
                subject = `Tray ${trayName} assigned to you`;
                textContent = `The tray "${trayName}" has been assigned to you by ${user}.`;
                htmlContent = `
                    <h3>Tray Assignment Notification</h3>
                    <p>The tray <strong>"${trayName}"</strong> has been assigned to you by ${user}.</p>
                    <p><strong>Tray Details:</strong></p>
                    <ul>
                        <li>Status: ${trayData.status || 'Unknown'}</li>
                        <li>Location: ${trayData.location || 'Unknown'}</li>
                        <li>Case Type: ${Array.isArray(trayData.case_type_compatibility) ? trayData.case_type_compatibility.join(', ') : 'Unknown'}</li>
                        <li>Time: ${new Date().toLocaleString()}</li>
                    </ul>
                `;
                break;

            default:
                subject = `Tray ${trayName} status updated`;
                textContent = `The tray "${trayName}" status has been updated to: ${action}`;
                htmlContent = `
                    <h3>Tray Status Update</h3>
                    <p>The tray <strong>"${trayName}"</strong> status has been updated to: <strong>${action}</strong></p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                `;
        }

        return await this.sendEmail({
            to: recipientEmail,
            subject: subject,
            text: textContent,
            html: htmlContent
        });
    }

    /**
     * Send a system alert notification
     * @param {string} alertType - Type of alert (e.g., 'error', 'warning', 'info')
     * @param {string} message - Alert message
     * @param {string} recipientEmail - Email address to notify
     * @param {Object} details - Additional details about the alert
     */
    async sendSystemAlert(alertType, message, recipientEmail, details = {}) {
        const subject = `TrayTracker ${alertType.toUpperCase()}: ${message}`;
        
        const textContent = `
TrayTracker System Alert

Type: ${alertType.toUpperCase()}
Message: ${message}
Time: ${new Date().toLocaleString()}

Details:
${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n')}
        `;

        const htmlContent = `
            <h3>TrayTracker System Alert</h3>
            <div style="padding: 10px; border-left: 4px solid ${alertType === 'error' ? '#dc3545' : alertType === 'warning' ? '#ffc107' : '#007bff'}; background-color: #f8f9fa;">
                <p><strong>Type:</strong> ${alertType.toUpperCase()}</p>
                <p><strong>Message:</strong> ${message}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            ${Object.keys(details).length > 0 ? `
                <h4>Details:</h4>
                <ul>
                    ${Object.entries(details).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
                </ul>
            ` : ''}
        `;

        return await this.sendEmail({
            to: recipientEmail,
            subject: subject,
            text: textContent,
            html: htmlContent
        });
    }
}

// Export singleton instance
export const emailNotifications = new EmailNotifications();