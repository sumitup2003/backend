// backend/middleware/auth.js

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  try {
    // Check for token in multiple places
    // 1. Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('🔑 Token from Authorization header');
    }
    // 2. Cookie (for browser requests)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('🔑 Token from cookie');
    }

    if (!token) {
      console.log('❌ No token found in request');
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified for user:', decoded.id);

    // Get user from database
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      console.log('❌ User not found in database');
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User authenticated:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

export const adminOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (req.user.role !== 'admin') {
      console.log('❌ User is not admin:', req.user.username);
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    console.log('✅ Admin access granted:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};