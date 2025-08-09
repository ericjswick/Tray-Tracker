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
}