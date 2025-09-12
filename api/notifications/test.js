// Vercel serverless function for testing email notifications
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Return test endpoint info
      return res.status(200).json({
        endpoint: '/api/notifications/test',
        description: 'Test email notification endpoint',
        methods: ['POST'],
        usage: 'Send POST with { "email": "test@example.com" } to send a test email'
      });
    }

    if (req.method === 'POST') {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Missing email field',
          usage: 'Send POST with { "email": "test@example.com" }'
        });
      }

      // Call the email API directly (simulate internal API call)
      const baseUrl = `https://${req.headers.host}`;
      const emailApiUrl = `${baseUrl}/api/notifications/email`;

      const testEmailData = {
        to: email,
        subject: 'TrayTracker Email Test',
        text: 'This is a test email from TrayTracker notification system.',
        html: `
          <h2>TrayTracker Email Test</h2>
          <p>This is a test email from the TrayTracker notification system.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Timestamp: ${new Date().toISOString()}</li>
            <li>Recipient: ${email}</li>
            <li>API Endpoint: ${emailApiUrl}</li>
          </ul>
          <p style="color: #28a745;">✅ If you received this email, the notification system is working correctly!</p>
        `
      };

      console.log('📧 Sending test email to:', email);

      const emailResponse = await fetch(emailApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEmailData)
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json().catch(() => ({ error: 'Unknown error' }));
        return res.status(500).json({
          error: 'Failed to send test email',
          details: errorData
        });
      }

      const emailResult = await emailResponse.json();

      return res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        recipient: email,
        timestamp: new Date().toISOString(),
        emailApiResponse: emailResult
      });
    }

    // Method not allowed
    res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Test email error:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}