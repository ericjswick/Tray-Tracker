# Email Notifications System

This document describes how to use the email notification system in TrayTracker.

## API Endpoints

### 1. `/api/notifications/email` (POST)
Send email notifications via SendGrid.

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "text": "Plain text content",
  "html": "<h1>HTML content</h1>",
  "from": "sender@example.com" // optional, defaults to noreply@traytracker.com
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "recipient": "recipient@example.com",
  "subject": "Email Subject"
}
```

### 2. `/api/notifications/test` (POST)
Send a test email to verify the system is working.

**Request Body:**
```json
{
  "email": "test@example.com"
}
```

## JavaScript Usage

### Import the utility:
```javascript
import { emailNotifications } from './utils/EmailNotifications.js';
```

### Send a basic email:
```javascript
await emailNotifications.sendEmail({
  to: 'user@example.com',
  subject: 'Test Email',
  text: 'This is a test email',
  html: '<h1>This is a test email</h1>'
});
```

### Send tray-specific notifications:
```javascript
// Tray check-in notification
await emailNotifications.sendTrayNotification(
  trayData,           // Tray object
  'checked-in',       // Action
  'user@example.com', // Recipient
  { 
    facilityName: 'Hospital A',
    userName: 'John Doe'
  }
);

// Tray assignment notification
await emailNotifications.sendTrayNotification(
  trayData,
  'assigned',
  'user@example.com',
  { userName: 'Admin User' }
);
```

### Send system alerts:
```javascript
await emailNotifications.sendSystemAlert(
  'error',                    // Alert type: 'error', 'warning', 'info'
  'Database connection failed', // Message
  'admin@example.com',        // Recipient
  {                           // Additional details
    server: 'prod-db-1',
    timestamp: new Date().toISOString()
  }
);
```

## Global Access

The email notification system is available globally as:
```javascript
window.app.emailNotifications
```

## Example Usage in TrayManager

```javascript
// In TrayManager.js - when a tray is checked in
async checkinTray(trayId, facilityId, userId) {
  // ... existing checkin logic ...
  
  // Send notification to assigned user
  if (tray.assignedTo) {
    const user = await this.dataManager.getUser(tray.assignedTo);
    if (user && user.email) {
      await window.app.emailNotifications.sendTrayNotification(
        tray,
        'checked-in',
        user.email,
        {
          facilityName: this.getFacilityName(facilityId),
          userName: this.getUserName(userId)
        }
      );
    }
  }
}
```

## Configuration

### Environment Variables

⚠️ **Security Note**: Never commit your actual SendGrid API key to version control. The `.env` file is already in `.gitignore` to prevent accidental commits.

Create a `.env` file in the project root with the following variables:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=noreply@traytracker.com
NOTIFICATION_FROM_NAME=TrayTracker System
```

### For Vercel Deployment

Set these environment variables in your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   - `SENDGRID_API_KEY` = Your SendGrid API key
   - `SENDGRID_FROM_EMAIL` = Your default sender email
   - `NOTIFICATION_FROM_NAME` = Your notification sender name

### Settings
- **SendGrid API Key**: Set via `SENDGRID_API_KEY` environment variable
- **Default Sender**: Set via `SENDGRID_FROM_EMAIL` environment variable (defaults to `noreply@traytracker.com`)
- **CORS**: Enabled for all origins (`*`)

## Error Handling

All email methods throw errors that should be caught:

```javascript
try {
  await emailNotifications.sendEmail(emailData);
  console.log('Email sent successfully');
} catch (error) {
  console.error('Failed to send email:', error.message);
  // Handle error appropriately (show user notification, log, etc.)
}
```

## Testing

Use the test endpoint to verify email functionality:

```bash
curl -X POST https://your-domain.vercel.app/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@example.com"}'
```

Or from the browser console:
```javascript
// Test basic email
await fetch('/api/notifications/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'your-test-email@example.com' })
});

// Test with the utility class
await window.app.emailNotifications.sendEmail({
  to: 'your-test-email@example.com',
  subject: 'Test from Console',
  text: 'This is a test email sent from the browser console'
});
```