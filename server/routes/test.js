const express = require('express');
const router = express.Router();

// Test Firebase connection
router.get('/firebase', async (req, res) => {
    try {
        // Import Firebase Admin SDK
        const admin = require('firebase-admin');
        
        // Check if Firebase is already initialized
        let app;
        try {
            app = admin.app();
        } catch (error) {
            // Initialize Firebase if not already done
            // Log for debugging (remove in production)
            console.log('Firebase env check:', {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY,
                privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length
            });

            const serviceAccount = {
                type: "service_account",
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_CLIENT_ID,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
                universe_domain: "googleapis.com"
            };

            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
            });
        }

        // Test Firestore connection
        const db = admin.firestore();
        
        // Try to read from a test collection
        const testDoc = await db.collection('_test').doc('connection').get();
        
        // Try to write a test document
        const testData = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: 'Firebase connection test successful',
            server_time: new Date().toISOString()
        };
        
        await db.collection('_test').doc('connection').set(testData);

        res.json({
            status: 'success',
            message: 'Firebase connection successful',
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            test_write: 'Completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Firebase test error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Firebase connection failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test Twilio connection
router.get('/twilio', async (req, res) => {
    try {
        const twilio = require('twilio');
        
        // Note: For full Twilio testing, you'd also need Account SID and Auth Token
        // For now, we'll just test if the API key is accessible and validate the format
        const apiKey = process.env.TWILIO_API_KEY;
        
        if (!apiKey) {
            throw new Error('TWILIO_API_KEY not found in environment variables');
        }

        // Validate API key format (should be alphanumeric and specific length)
        if (!/^[A-Z0-9]{20,}$/.test(apiKey)) {
            throw new Error('TWILIO_API_KEY format appears invalid');
        }

        // If you have Account SID and Auth Token, uncomment this to do a real test:
        /*
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        
        if (accountSid && authToken) {
            const client = twilio(accountSid, authToken);
            // Test by fetching account info
            const account = await client.api.accounts(accountSid).fetch();
            
            res.json({
                status: 'success',
                message: 'Twilio connection successful',
                account_sid: accountSid,
                account_status: account.status,
                api_key_configured: true,
                timestamp: new Date().toISOString()
            });
        } else {
            // API key exists but no full credentials for testing
        */
            res.json({
                status: 'partial_success',
                message: 'Twilio API key is configured and format is valid',
                api_key_configured: true,
                api_key_format: 'Valid',
                note: 'Full Twilio test requires Account SID and Auth Token',
                timestamp: new Date().toISOString()
            });
        /*
        }
        */

    } catch (error) {
        console.error('Twilio test error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Twilio test failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test both services at once
router.get('/all', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        tests: {}
    };

    // Test Firebase
    try {
        const firebaseResponse = await fetch('http://localhost:3000/api/test/firebase');
        const firebaseData = await firebaseResponse.json();
        results.tests.firebase = {
            status: firebaseResponse.ok ? 'success' : 'error',
            data: firebaseData
        };
    } catch (error) {
        results.tests.firebase = {
            status: 'error',
            error: error.message
        };
    }

    // Test Twilio
    try {
        const twilioResponse = await fetch('http://localhost:3000/api/test/twilio');
        const twilioData = await twilioResponse.json();
        results.tests.twilio = {
            status: twilioResponse.ok ? 'success' : 'error',
            data: twilioData
        };
    } catch (error) {
        results.tests.twilio = {
            status: 'error',
            error: error.message
        };
    }

    // Overall status
    const allSuccessful = Object.values(results.tests).every(test => test.status === 'success' || test.status === 'partial_success');
    results.overall_status = allSuccessful ? 'success' : 'partial_failure';

    res.json(results);
});

// Test Twilio SMS
router.post('/twilio/sms', async (req, res) => {
    try {
        const twilio = require('twilio');
        
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromPhone = process.env.TWILIO_FROM_PHONE;
        
        if (!accountSid || !authToken || !fromPhone) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required Twilio credentials',
                required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_PHONE'],
                provided: {
                    accountSid: !!accountSid,
                    authToken: !!authToken,
                    fromPhone: !!fromPhone
                },
                timestamp: new Date().toISOString()
            });
        }

        // Get phone number and message from request body or use defaults
        const { to = '3109234078', message = 'Test message from Tray Tracker API - Firebase and Twilio are working!' } = req.body;

        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        const formattedTo = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`;
        
        if (!phoneRegex.test(formattedTo.replace('+', ''))) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number format',
                provided: to,
                formatted: formattedTo,
                timestamp: new Date().toISOString()
            });
        }

        // Initialize Twilio client
        const client = twilio(accountSid, authToken);
        
        // Send SMS
        const messageResult = await client.messages.create({
            body: message,
            from: fromPhone,
            to: formattedTo
        });

        res.json({
            status: 'success',
            message: 'SMS sent successfully',
            details: {
                messageSid: messageResult.sid,
                to: formattedTo,
                from: fromPhone,
                body: message,
                status: messageResult.status,
                dateCreated: messageResult.dateCreated
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Twilio SMS test error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send SMS',
            error: error.message,
            errorCode: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

// Quick SMS test endpoint (GET request for easy browser testing)
router.get('/twilio/sms-quick', async (req, res) => {
    try {
        // Make internal POST request to the SMS endpoint
        const fetch = require('node-fetch');
        
        const response = await fetch('http://localhost:3000/api/test/twilio/sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: '3109234078',
                message: '🚀 Quick test from Tray Tracker! Your Firebase + Twilio integration is working perfectly!'
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            res.json(data);
        } else {
            res.status(response.status).json(data);
        }

    } catch (error) {
        console.error('Quick SMS test error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Quick SMS test failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;