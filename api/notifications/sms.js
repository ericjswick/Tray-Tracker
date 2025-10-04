// Vercel serverless function for sending SMS notifications via Twilio
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
    // Validate required fields
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'message']
      });
    }

    // Phone number validation function
    function isValidPhoneNumber(phone) {
      if (!phone || typeof phone !== 'string') {
        return false;
      }

      const cleaned = phone.replace(/\D/g, '');

      // Check for valid US/Canada phone number patterns
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

      // Check for international format starting with +
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

    // Validate phone number
    if (!isValidPhoneNumber(to)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        field: 'to'
      });
    }

    const formattedPhone = formatPhoneNumber(to);

    if (!formattedPhone) {
      return res.status(400).json({
        error: 'Failed to format phone number',
        field: 'to'
      });
    }

    // Twilio configuration from environment variables
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_API_SID = process.env.TWILIO_API_SID;
    const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;
    const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
    const IS_DO_LIVE_SMS_SENDING = process.env.IS_DO_LIVE_SMS_SENDING === 'true' || false;

    // Check if Twilio credentials are configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_SID || !TWILIO_API_SECRET || !TWILIO_PHONE_NUMBER) {
      return res.status(500).json({
        error: 'Twilio credentials not configured',
        message: 'TWILIO_ACCOUNT_SID, TWILIO_API_SID, TWILIO_API_SECRET, and TWILIO_PHONE_NUMBER environment variables are required'
      });
    }

    if (IS_DO_LIVE_SMS_SENDING) {
      // Live SMS sending enabled - actually send SMS
      console.log('📱 Sending SMS to', formattedPhone, '(LIVE MODE)');

      // Dynamically import Twilio
      const twilio = await import('twilio');
      const twilioClient = twilio.default(TWILIO_API_SID, TWILIO_API_SECRET, {
        accountSid: TWILIO_ACCOUNT_SID
      });

      try {
        const twilioMessage = await twilioClient.messages.create({
          body: message,
          from: TWILIO_PHONE_NUMBER,
          to: formattedPhone
        });

        console.log('✅ SMS sent successfully:', twilioMessage.sid);

        res.status(200).json({
          success: true,
          message: 'SMS sent successfully',
          details: {
            to: formattedPhone,
            messageSid: twilioMessage.sid,
            status: twilioMessage.status,
            isLiveSending: true
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Twilio API error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          twilioCode: error.code,
          timestamp: new Date().toISOString()
        });
      }

    } else {
      // Live SMS sending disabled - simulate
      console.log('📱 Simulating SMS to', formattedPhone, '(TEST MODE)');

      res.status(200).json({
        success: true,
        message: 'SMS simulated successfully',
        details: {
          to: formattedPhone,
          simulated: true,
          message: 'SMS would be sent in live mode',
          isLiveSending: false
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ SMS notification error:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
