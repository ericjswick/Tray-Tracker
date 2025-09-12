// Vercel serverless function for sending email notifications via SendGrid
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
    const { to, subject, text, html, from } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'subject', 'text or html']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        error: 'Invalid email format',
        field: 'to'
      });
    }

    // SendGrid configuration from environment variables
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

    // Check if SendGrid API key is configured
    if (!SENDGRID_API_KEY) {
      return res.status(500).json({
        error: 'SendGrid API key not configured',
        message: 'SENDGRID_API_KEY environment variable is required'
      });
    }

    // Default sender email from environment or fallback
    const defaultFrom = from || process.env.SENDGRID_FROM_EMAIL || 'noreply@traytracker.com';

    // Prepare SendGrid payload
    const payload = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject
        }
      ],
      from: { email: defaultFrom },
      content: []
    };

    // Add content based on what's provided
    if (text) {
      payload.content.push({
        type: 'text/plain',
        value: text
      });
    }

    if (html) {
      payload.content.push({
        type: 'text/html',
        value: html
      });
    }

    console.log('📧 Sending email via SendGrid:', {
      to,
      subject,
      from: defaultFrom,
      hasText: !!text,
      hasHtml: !!html
    });

    // Send email via SendGrid API
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ SendGrid API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });

      return res.status(500).json({
        error: 'Failed to send email',
        details: `SendGrid API returned ${response.status}: ${response.statusText}`,
        sendgridError: errorData
      });
    }

    const responseData = await response.text();
    console.log('✅ Email sent successfully via SendGrid');

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      timestamp: new Date().toISOString(),
      recipient: to,
      subject: subject
    });

  } catch (error) {
    console.error('❌ Email notification error:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}