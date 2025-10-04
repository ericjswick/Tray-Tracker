// Vercel serverless function for sending tray status SMS notifications via Twilio
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
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

    // Phone number validation function
    function isValidPhoneNumber(phone) {
      if (!phone || typeof phone !== 'string') {
        return false;
      }

      const cleaned = phone.replace(/\D/g, '');

      if (cleaned.length === 10) {
        const areaCode = cleaned.substr(0, 3);
        const exchange = cleaned.substr(3, 3);
        return areaCode[0] >= '2' && areaCode[0] <= '9' &&
               exchange[0] >= '2' && exchange[0] <= '9';
      } else if (cleaned.length === 11 && cleaned[0] === '1') {
        const areaCode = cleaned.substr(1, 3);
        const exchange = cleaned.substr(4, 3);
        return areaCode[0] >= '2' && areaCode[0] <= '9' &&
               exchange[0] >= '2' && exchange[0] <= '9';
      }

      if (phone.trim().startsWith('+')) {
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

      if (cleaned.length === 10) {
        return '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return '+' + cleaned;
      }

      if (phone.trim().startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
        return phone.trim();
      }

      if (cleaned.length >= 10 && cleaned.length <= 15) {
        return '+' + cleaned;
      }

      return null;
    }

    const IS_DO_LIVE_SMS_SENDING = process.env.IS_DO_LIVE_SMS_SENDING === 'true' || false;

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

    if (IS_DO_LIVE_SMS_SENDING) {
      // Live SMS sending enabled - actually send SMS messages
      console.log(`📱 Sending SMS to ${validNumbers.length} users with valid phone numbers (LIVE MODE)`);

      // Check if Twilio credentials are configured
      const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
      const TWILIO_API_SID = process.env.TWILIO_API_SID;
      const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;
      const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

      if (!TWILIO_ACCOUNT_SID || !TWILIO_API_SID || !TWILIO_API_SECRET || !TWILIO_PHONE_NUMBER) {
        return res.status(500).json({
          success: false,
          error: 'Twilio credentials not configured',
          timestamp: new Date().toISOString()
        });
      }

      // Dynamically import Twilio
      const twilio = await import('twilio');
      const twilioClient = twilio.default(TWILIO_API_SID, TWILIO_API_SECRET, {
        accountSid: TWILIO_ACCOUNT_SID
      });

      for (const user of users) {
        try {
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
              from: TWILIO_PHONE_NUMBER,
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

      res.status(200).json({
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

      res.status(200).json({
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
}
