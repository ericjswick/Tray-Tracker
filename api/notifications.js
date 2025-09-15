// Vercel serverless function for notifications API

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

// Phone number validation function (matching Express server logic)
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

// Format phone number for SMS sending (matching Express server logic)
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

// Main handler function for Vercel
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Parse request body for POST requests
    let body = {};
    if (req.method === 'POST' && req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    // Route handling based on URL path
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log('🔍 Request:', req.method, pathname);

    // GET /api/notifications - Basic info endpoint
    if (req.method === 'GET' && pathname === '/api/notifications') {
      return res.status(200).json({
        message: 'TrayTracker Notifications API (Serverless)',
        endpoints: {
          'info': '/api/notifications',
          'sms': '/api/notifications/sms (POST)',
          'sms-test': '/api/notifications/sms-test (POST)',
          'tray-status': '/api/notifications/tray-status (POST)'
        },
        status: 'Active with SMS support',
        services: {
          twilio: twilioClient ? 'Connected ✅' : 'Not configured ❌'
        },
        environment: 'serverless',
        authentication: 'API Key method'
      });
    }

    // POST /api/notifications/sms-test - SMS Test endpoint
    if (req.method === 'POST' && pathname === '/api/notifications/sms-test') {
      if (!twilioClient) {
        return res.status(500).json({
          success: false,
          error: 'Twilio SMS service not configured',
          timestamp: new Date().toISOString()
        });
      }

      const { phone } = body;
      const testPhone = phone || '+14155552671'; // Twilio test number if no phone provided

      const message = await twilioClient.messages.create({
        body: `🧪 TrayTracker SMS Test (Serverless) - ${new Date().toLocaleString()}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: testPhone
      });

      return res.status(200).json({
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
    }

    // POST /api/notifications/tray-status - Tray Status SMS endpoint
    if (req.method === 'POST' && pathname === '/api/notifications/tray-status') {
      const IS_DO_LIVE_SMS_SENDING = process.env.IS_DO_LIVE_SMS_SENDING === 'true' || false;

      console.log('📢 Tray status SMS notification request received');
      console.log('🔧 Live SMS sending enabled:', IS_DO_LIVE_SMS_SENDING);

      const { trayId, trayName, previousStatus, newStatus, changedBy, timestamp, users } = body;

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

        return res.status(200).json({
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

        return res.status(200).json({
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
    }

    // POST /api/notifications/sms - Direct SMS endpoint
    if (req.method === 'POST' && pathname === '/api/notifications/sms') {
      if (!twilioClient) {
        return res.status(500).json({
          success: false,
          error: 'Twilio SMS service not configured',
          timestamp: new Date().toISOString()
        });
      }

      const { to, message, from } = body;

      // Validate required fields
      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to and message are required',
          timestamp: new Date().toISOString()
        });
      }

      // Validate and format phone number
      if (!isValidPhoneNumber(to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format',
          timestamp: new Date().toISOString()
        });
      }

      const formattedPhone = formatPhoneNumber(to);
      if (!formattedPhone) {
        return res.status(400).json({
          success: false,
          error: 'Unable to format phone number',
          timestamp: new Date().toISOString()
        });
      }

      // Send SMS
      const smsMessage = await twilioClient.messages.create({
        body: message,
        from: from || process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      return res.status(200).json({
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
    }

    // Handle 404 for unknown routes
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      availableEndpoints: [
        'GET /api/notifications (info)',
        'POST /api/notifications/sms',
        'POST /api/notifications/sms-test',
        'POST /api/notifications/tray-status'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Notifications API error:', error);

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

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      twilioCode: error.code || null,
      timestamp: new Date().toISOString()
    });
  }
}