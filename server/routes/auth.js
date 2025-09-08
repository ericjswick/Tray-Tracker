const express = require('express');
const router = express.Router();

// POST /api/auth/verify - Verify Firebase token
router.post('/verify', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Token is required',
          statusCode: 400
        }
      });
    }

    // Token verification is handled by the auth middleware
    // This endpoint is mainly for testing token validity
    res.json({
      success: true,
      data: {
        message: 'Token is valid',
        user: req.user
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/user - Get current user info
router.get('/user', async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;