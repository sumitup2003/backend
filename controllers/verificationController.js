// backend/controllers/verificationController.js

import User from '../models/User.js';

// @desc    Submit verification request
// @route   POST /api/verification/request
// @access  Private
export const submitVerificationRequest = async (req, res, next) => {
  try {
    const { fullName, reason, category, socialLinks, additionalInfo } = req.body;
    const userId = req.user._id;

    // Check if user already verified
    const user = await User.findById(userId);
    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'Your account is already verified'
      });
    }

    // Check if there's already a pending request
    if (user.verificationRequest?.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending verification request'
      });
    }

    // Update user with verification request
    user.verificationRequest = {
      status: 'pending',
      fullName,
      reason,
      category,
      socialLinks,
      additionalInfo,
      requestedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Verification request submitted successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all verification requests (Admin only)
// @route   GET /api/verification/admin/requests
// @access  Private/Admin
export const getVerificationRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query['verificationRequest.status'] = status;
    } else {
      // Get all except 'none' status
      query['verificationRequest.status'] = { $ne: 'none' };
    }

    const users = await User.find(query)
      .select('name username email avatar verified verificationRequest')
      .sort({ 'verificationRequest.requestedAt': -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review verification request (Admin only)
// @route   POST /api/verification/admin/review/:userId
// @access  Private/Admin
export const reviewVerificationRequest = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const adminId = req.user._id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verificationRequest?.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending verification request for this user'
      });
    }

    // Update verification status
    if (action === 'approve') {
      user.verified = true;
      user.verificationRequest.status = 'approved';
    } else {
      user.verified = false;
      user.verificationRequest.status = 'rejected';
    }

    user.verificationRequest.reviewedAt = new Date();
    user.verificationRequest.reviewedBy = adminId;

    await user.save();

    res.status(200).json({
      success: true,
      message: `Verification request ${action}d successfully`,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's verification status
// @route   GET /api/verification/status
// @access  Private
export const getVerificationStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('verified verificationRequest');

    res.status(200).json({
      success: true,
      data: {
        verified: user.verified,
        request: user.verificationRequest
      }
    });
  } catch (error) {
    next(error);
  }
};