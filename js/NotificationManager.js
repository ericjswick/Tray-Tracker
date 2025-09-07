// js/NotificationManager.js
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class NotificationManager {
    constructor(db) {
        this.db = db;
    }

    async sendNotifications() {
        const recipients = [];
        document.querySelectorAll('#notificationRecipients input:checked').forEach(checkbox => {
            recipients.push(checkbox.value);
        });

        const emailEnabled = document.getElementById('emailNotification').checked;
        const smsEnabled = document.getElementById('smsNotification').checked;
        const message = document.getElementById('notificationMessage').value;

        if (recipients.length === 0) {
            alert('Please select at least one recipient.');
            return;
        }

        try {
            // In a real implementation, you would call a Cloud Function
            // or use a service like SendGrid/Twilio for actual notifications

            // For now, we'll save the notification to Firestore for demo
            const notificationData = {
                recipients,
                emailEnabled,
                smsEnabled,
                message,
                sentBy: window.app.authManager.getCurrentUser()?.uid,
                sentAt: serverTimestamp(),
                status: 'demo-sent'
            };

            await addDoc(collection(this.db, 'notifications'), notificationData);

            alert(`Demo: Notifications sent to ${recipients.length} recipient(s)\nMethods: ${emailEnabled ? 'Email ' : ''}${smsEnabled ? 'SMS' : ''}\nMessage: ${message || 'Standard notification'}`);

            // Clear form
            document.getElementById('notificationMessage').value = '';
            document.querySelectorAll('#notificationRecipients input:checked').forEach(checkbox => {
                checkbox.checked = false;
            });
        } catch (error) {
            console.error('Error sending notifications:', error);
            alert('Error sending notifications: ' + error.message);
        }
    }

    // UI notification methods for showing toast messages
    show(message, type = 'info') {
        this.showNotification(message, type);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Create a toast notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${this.getBootstrapClass(type)} alert-dismissible fade show`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        notification.innerHTML = `
            <strong>${this.getTypeIcon(type)}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    getBootstrapClass(type) {
        switch (type) {
            case 'error': return 'danger';
            case 'success': return 'success';
            case 'warning': return 'warning';
            case 'info': 
            default: return 'info';
        }
    }

    getTypeIcon(type) {
        switch (type) {
            case 'error': return '❌';
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'info':
            default: return 'ℹ️';
        }
    }
}