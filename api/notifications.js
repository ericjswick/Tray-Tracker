// Vercel serverless function for notifications API
const express = require('express');
const cors = require('cors');

// Initialize Twilio client
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized successfully');
  } else {
    console.log('⚠️  Twilio credentials not found in environment variables');
  }
} catch (error) {
  console.error('❌ Error initializing Twilio client:', error.message);
}

// Create Express app for this serverless function
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// GET /api/notifications - Basic info endpoint
app.get('/api/notifications', (req, res) => {
  res.json({
    message: 'TrayTracker Notifications API (Serverless)',
    endpoints: {
      'info': '/api/notifications',
      'sms': '/api/notifications/sms (POST)',
      'sms-test': '/api/notifications/sms-test (POST)',
      'tray-status': '/api/notifications/tray-status (POST)'
    },
    status: 'Notifications API is active',
    services: {
      twilio: twilioClient ? 'Connected' : 'Not configured'
    },
    environment: 'serverless'
  });
});

// POST /api/notifications/sms-test - Test SMS endpoint
app.post('/api/notifications/sms-test', async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(500).json({
        success: false,
        error: 'Twilio SMS service not configured',
        timestamp: new Date().toISOString()
      });
    }

    const { phone } = req.body;
    const testPhone = phone || '+14155552671'; // Twilio test number if no phone provided
    
    const message = await twilioClient.messages.create({
      body: `🧪 TrayTracker SMS Test (Serverless) - ${new Date().toLocaleString()}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhone
    });

    res.json({
      success: true,
      message: 'Test SMS sent successfully',
      details: {
        messageSid: message.sid,
        to: message.to,
        from: message.from,
        status: message.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      twilioError: error.code || 'Unknown',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/notifications/tray-status - Send SMS to all users about tray status change
app.post('/api/notifications/tray-status', async (req, res) => {
  try {
    const IS_DO_LIVE_SMS_SENDING = process.env.IS_DO_LIVE_SMS_SENDING === 'true' || false;
    
    console.log('📢 Tray status SMS notification request received');
    console.log('🔧 Live SMS sending enabled:', IS_DO_LIVE_SMS_SENDING);
    
    const { trayId, trayName, previousStatus, newStatus, changedBy, timestamp, users } = req.body;
    
    // Validate required fields
    if (!trayId || !newStatus) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: trayId and newStatus are required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate users array
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Users array is required and cannot be empty',
        timestamp: new Date().toISOString()
      });
    }

    // Create SMS message
    const statusChange = previousStatus ? `${previousStatus} → ${newStatus}` : newStatus;
    const smsMessage = `🚨 TrayTracker Alert: Tray "${trayName || trayId}" status changed to ${statusChange}${changedBy ? ` by ${changedBy}` : ''}. Check the app for details.`;
    
    let results = [];
    let successCount = 0;
    let failureCount = 0;
    
    if (IS_DO_LIVE_SMS_SENDING && twilioClient) {
      // Live SMS sending enabled - actually send SMS messages
      console.log(`📱 Sending SMS to ${users.length} users (LIVE MODE)`);
      
      for (const user of users) {
        try {
          if (user.phone && user.phone.trim()) {
            // Format phone number
            let formattedPhone = user.phone.replace(/\D/g, '');
            if (!user.phone.startsWith('+')) {
              if (formattedPhone.length === 10) {
                formattedPhone = '+1' + formattedPhone;
              } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
                formattedPhone = '+' + formattedPhone;
              } else {
                formattedPhone = '+' + formattedPhone;
              }
            } else {
              formattedPhone = user.phone;
            }
            
            const message = await twilioClient.messages.create({
              body: smsMessage,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: formattedPhone
            });
            
            results.push({
              userId: user.id,
              name: user.name,
              phone: formattedPhone,
              success: true,
              messageSid: message.sid,
              status: message.status
            });
            successCount++;
            
            console.log(`✅ SMS sent to ${user.name} (${formattedPhone}): ${message.sid}`);
            
          } else {
            results.push({
              userId: user.id,
              name: user.name,
              phone: user.phone || 'N/A',
              success: false,
              error: 'No phone number provided'
            });
            failureCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to send SMS to ${user.name}:`, error.message);
          results.push({
            userId: user.id,
            name: user.name,
            phone: user.phone,
            success: false,
            error: error.message,
            twilioCode: error.code
          });
          failureCount++;
        }
      }
      
      res.json({
        success: true,
        message: `SMS notifications processed: ${successCount} sent, ${failureCount} failed`,
        details: {
          trayId,
          trayName,
          statusChange,
          totalUsers: users.length,
          successCount,
          failureCount,
          message: smsMessage,
          results,
          isLiveSending: true
        },
        timestamp: new Date().toISOString()
      });
      
    } else {
      // Live SMS sending disabled - simulate the process
      console.log(`📱 Simulating SMS to ${users.length} users (TEST MODE)`);
      
      for (const user of users) {
        if (user.phone && user.phone.trim()) {
          results.push({
            userId: user.id,
            name: user.name,
            phone: user.phone,
            success: true,
            simulated: true,
            message: 'SMS would be sent in live mode'
          });
          successCount++;
        } else {
          results.push({
            userId: user.id,
            name: user.name,
            phone: user.phone || 'N/A',
            success: false,
            error: 'No phone number provided'
          });
          failureCount++;
        }
      }
      
      res.json({
        success: true,
        message: `SMS notifications simulated: ${successCount} would be sent, ${failureCount} failed`,
        details: {
          trayId,
          trayName,
          statusChange,
          totalUsers: users.length,
          successCount,
          failureCount,
          message: smsMessage,
          results,
          isLiveSending: false,
          isLiveSendingDisabled: true
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Tray status SMS notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/notifications/sms - Send SMS message
app.post('/api/notifications/sms', async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(500).json({
        success: false,
        error: 'Twilio SMS service not configured',
        timestamp: new Date().toISOString()
      });
    }

    const { to, message, from } = req.body;
    
    // Validate required fields
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to and message are required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate phone number format (basic)
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Use format: +1234567890',
        timestamp: new Date().toISOString()
      });
    }

    // Ensure phone number has country code
    let formattedPhone = to.replace(/\D/g, ''); // Remove non-digits
    if (!to.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+1' + formattedPhone; // Assume US if 10 digits
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        formattedPhone = '+' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    } else {
      formattedPhone = to;
    }

    // Send SMS
    const smsMessage = await twilioClient.messages.create({
      body: message,
      from: from || process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    res.json({
      success: true,
      message: 'SMS sent successfully',
      details: {
        messageSid: smsMessage.sid,
        to: smsMessage.to,
        from: smsMessage.from,
        status: smsMessage.status,
        messageLength: message.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('SMS sending error:', error);
    
    // Handle Twilio-specific errors
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.code) {
      switch (error.code) {
        case 21211:
          errorMessage = 'Invalid phone number';
          statusCode = 400;
          break;
        case 21614:
          errorMessage = 'Phone number is not a valid mobile number';
          statusCode = 400;
          break;
        case 21408:
          errorMessage = 'Permission to send SMS to this number denied';
          statusCode = 403;
          break;
        case 21610:
          errorMessage = 'Message contains prohibited content';
          statusCode = 400;
          break;
        default:
          errorMessage = `Twilio error: ${error.message}`;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      twilioCode: error.code || null,
      timestamp: new Date().toISOString()
    });
  }
});

// Handle all other routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/notifications',
      'POST /api/notifications/sms',
      'POST /api/notifications/sms-test',
      'POST /api/notifications/tray-status'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = app;