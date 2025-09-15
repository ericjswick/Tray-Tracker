const express = require('express');
const router = express.Router();

console.log('🚨 NOTIFICATIONS ROUTE - COMPLETELY NEW FILE LOADING');

// Initialize Twilio client
let twilioClient = null;
console.log('📱 Starting Twilio initialization with API Key...');
console.log('📱 TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'Found' : 'Missing');
console.log('📱 TWILIO_API_SID:', process.env.TWILIO_API_SID ? 'Found' : 'Missing');
console.log('📱 TWILIO_API_SECRET:', process.env.TWILIO_API_SECRET ? 'Found' : 'Missing');
console.log('📱 TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? 'Found' : 'Missing');

try {
  if (process.env.TWILIO_API_SID && process.env.TWILIO_API_SECRET && process.env.TWILIO_ACCOUNT_SID) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_API_SID, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID
    });
    console.log('✅ Twilio client initialized with API Key method!');
    console.log('📱 Using Account SID:', process.env.TWILIO_ACCOUNT_SID);
    console.log('📱 Using API SID:', process.env.TWILIO_API_SID);
  } else {
    console.log('⚠️  Missing required Twilio API Key credentials');
    console.log('📱 Need: TWILIO_ACCOUNT_SID, TWILIO_API_SID, TWILIO_API_SECRET');
  }
} catch (error) {
  console.error('❌ Twilio initialization failed:', error.message);
  console.error('❌ Full error:', error);
}

// Phone number validation function
// Validates US/Canada numbers (10-11 digits) and international numbers (+country code)
// Rejects invalid area codes/exchanges that start with 0 or 1
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Check for valid US/Canada phone number patterns
  if (cleaned.length === 10) {
    // 10 digits: 2125551234
    const areaCode = cleaned.substr(0, 3);
    const exchange = cleaned.substr(3, 3);
    // Area code cannot start with 0 or 1, exchange cannot start with 0 or 1
    return areaCode[0] >= '2' && areaCode[0] <= '9' &&
           exchange[0] >= '2' && exchange[0] <= '9';
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // 11 digits starting with 1: 12125551234
    const areaCode = cleaned.substr(1, 3);
    const exchange = cleaned.substr(4, 3);
    return areaCode[0] >= '2' && areaCode[0] <= '9' &&
           exchange[0] >= '2' && exchange[0] <= '9';
  }

  // Check for international format starting with +
  if (phone.trim().startsWith('+')) {
    // Allow international numbers but require minimum length
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  return false;
}

// Format phone number for SMS sending
function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  const cleaned = phone.replace(/\D/g, '');

  // Handle US/Canada numbers
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return '+' + cleaned;
  }

  // For international numbers starting with +, return as-is if valid
  if (phone.trim().startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
    return phone.trim();
  }

  // For other international numbers, add + prefix
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned;
  }

  return null;
}

// Basic info endpoint
router.get('/', (req, res) => {
  console.log('📡 Notifications info endpoint called');
  res.json({
    message: 'TrayTracker Notifications API',
    endpoints: {
      'info': '/api/notifications',
      'test': '/api/notifications/test (POST)',
      'email': '/api/notifications/email (POST)',
      'sms': '/api/notifications/sms (POST)',
      'sms-test': '/api/notifications/sms/test (POST)',
      'tray-status': '/api/notifications/tray-status (POST)'
    },
    status: 'Active with SMS support',
    services: {
      twilio: twilioClient ? 'Connected ✅' : 'Not configured ❌'
    }
  });
});

// POST /api/notifications/tray-status - Send SMS to all users about tray status change
router.post('/tray-status', async (req, res) => {
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
    
    // Validate all phone numbers first and report stats
    const validNumbers = users.filter(user => isValidPhoneNumber(user.phone));
    const invalidNumbers = users.filter(user => !isValidPhoneNumber(user.phone));

    console.log(`📊 Phone validation results: ${validNumbers.length} valid, ${invalidNumbers.length} invalid out of ${users.length} total users`);
    if (invalidNumbers.length > 0) {
      console.log(`⚠️  Users with invalid numbers: ${invalidNumbers.map(u => `${u.name} (${u.phone || 'N/A'})`).join(', ')}`);
    }

    if (IS_DO_LIVE_SMS_SENDING && twilioClient) {
      // Live SMS sending enabled - actually send SMS messages
      console.log(`📱 Sending SMS to ${validNumbers.length} users with valid phone numbers (LIVE MODE)`);
      
      for (const user of users) {
        try {
          // Validate phone number first
          if (isValidPhoneNumber(user.phone)) {
            const formattedPhone = formatPhoneNumber(user.phone);

            if (!formattedPhone) {
              console.warn(`⚠️  Failed to format phone number for ${user.name}: ${user.phone}`);
              results.push({
                userId: user.id,
                name: user.name,
                phone: user.phone,
                success: false,
                error: 'Invalid phone number format'
              });
              failureCount++;
              continue;
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
            console.warn(`⚠️  Invalid phone number for ${user.name}: ${user.phone || 'N/A'}`);
            results.push({
              userId: user.id,
              name: user.name,
              phone: user.phone || 'N/A',
              success: false,
              error: user.phone ? 'Invalid phone number format' : 'No phone number provided'
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
      console.log(`📱 Simulating SMS to ${validNumbers.length} users with valid phone numbers (TEST MODE)`);
      
      for (const user of users) {
        // Validate phone number in simulation mode too
        if (isValidPhoneNumber(user.phone)) {
          const formattedPhone = formatPhoneNumber(user.phone);

          results.push({
            userId: user.id,
            name: user.name,
            phone: formattedPhone || user.phone,
            success: true,
            simulated: true,
            message: 'SMS would be sent in live mode'
          });
          successCount++;
        } else {
          console.warn(`⚠️  [TEST MODE] Invalid phone number for ${user.name}: ${user.phone || 'N/A'}`);
          results.push({
            userId: user.id,
            name: user.name,
            phone: user.phone || 'N/A',
            success: false,
            error: user.phone ? 'Invalid phone number format' : 'No phone number provided'
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

// SMS test endpoint
router.post('/sms/test', async (req, res) => {
  console.log('📱 SMS test endpoint called');
  try {
    if (!twilioClient) {
      return res.status(500).json({
        success: false,
        error: 'Twilio not configured'
      });
    }

    const testPhone = '+14155552671'; // Twilio test number
    const message = await twilioClient.messages.create({
      body: '🧪 TrayTracker SMS Test - Working!',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhone
    });

    res.json({
      success: true,
      message: 'SMS sent successfully!',
      details: {
        messageSid: message.sid,
        to: message.to,
        from: message.from
      }
    });

  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('📱 Notifications route setup complete - SMS endpoints added');
module.exports = router;