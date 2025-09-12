// server/routes/notifications.js - Simple notifications route
const express = require('express');
const router = express.Router();

// GET /api/notifications - Basic info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'TrayTracker Notifications API',
    endpoints: {
      'info': '/api/notifications',
      'test': '/api/notifications/test (POST)',
      'email': '/api/notifications/email (POST)'
    },
    status: 'Notifications API is active'
  });
});

// POST /api/notifications/test - Simple test endpoint
router.post('/test', (req, res) => {
  try {
    const { email } = req.body;
    
    res.json({
      success: true,
      message: 'Notifications test endpoint working',
      email: email || 'No email provided',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Notifications test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/notifications/email - Send email using SendGrid
router.post('/email', async (req, res) => {
  try {
    const fetch = require('node-fetch');
    const { to, subject, message, fromName = 'TrayTracker' } = req.body;
    
    // Validate required fields
    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and message are required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get SendGrid configuration from environment
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@traytracker.com';
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'SendGrid API key not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format',
        timestamp: new Date().toISOString()
      });
    }
    
    // Prepare SendGrid API request
    const sendGridPayload = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject
        }
      ],
      from: {
        email: fromEmail,
        name: fromName
      },
      content: [
        {
          type: 'text/plain',
          value: message
        },
        {
          type: 'text/html',
          value: `<p>${message.replace(/\n/g, '<br>')}</p>`
        }
      ]
    };
    
    // Send email via SendGrid API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendGridPayload)
    });
    
    if (response.ok) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        details: {
          to: to,
          subject: subject,
          from: fromEmail,
          messageLength: message.length
        },
        timestamp: new Date().toISOString()
      });
    } else {
      const errorData = await response.text();
      console.error('SendGrid API error:', response.status, errorData);
      
      res.status(response.status).json({
        success: false,
        error: 'Failed to send email',
        details: {
          status: response.status,
          response: errorData
        },
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;