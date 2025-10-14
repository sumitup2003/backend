import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings blockedUsers');
    
    res.status(200).json({
      success: true,
      data: user.settings || {
        privacy: {
          privateAccount: false,
          showOnlineStatus: true,
          allowMessagesFromEveryone: false
        },
        notifications: {
          push: true,
          email: true,
          messages: true,
          likes: true,
          comments: true,
          follows: true
        },
        security: {
          twoFactorEnabled: false,
          loginAlerts: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update privacy settings
// @route   PUT /api/settings/privacy
// @access  Private
export const updatePrivacySettings = async (req, res) => {
  try {
    const { privateAccount, showOnlineStatus, allowMessagesFromEveryone } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          'settings.privacy.privateAccount': privateAccount,
          'settings.privacy.showOnlineStatus': showOnlineStatus,
          'settings.privacy.allowMessagesFromEveryone': allowMessagesFromEveryone
        }
      },
      { new: true }
    ).select('settings');

    res.status(200).json({
      success: true,
      data: user.settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private
export const updateNotificationSettings = async (req, res) => {
  try {
    const { push, email, messages, likes, comments, follows } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          'settings.notifications.push': push,
          'settings.notifications.email': email,
          'settings.notifications.messages': messages,
          'settings.notifications.likes': likes,
          'settings.notifications.comments': comments,
          'settings.notifications.follows': follows
        }
      },
      { new: true }
    ).select('settings');

    res.status(200).json({
      success: true,
      data: user.settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Change password
// @route   PUT /api/settings/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Block user
// @route   POST /api/settings/block/:userId
// @access  Private
export const blockUser = async (req, res) => {
  try {
    const userToBlock = req.params.userId;

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: userToBlock }
    });

    res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
}
};

export const unblockUser = async (req, res) => {
try {
const userToUnblock = req.params.userId;
await User.findByIdAndUpdate(req.user._id, {
  $pull: { blockedUsers: userToUnblock }
});

res.status(200).json({
  success: true,
  message: 'User unblocked successfully'
});
} catch (error) {
res.status(500).json({
success: false,
message: error.message
});
}
};
// @desc    Get blocked users
// @route   GET /api/settings/blocked
// @access  Private
export const getBlockedUsers = async (req, res) => {
try {
const user = await User.findById(req.user._id)
.populate('blockedUsers', 'name username avatar');
res.status(200).json({
  success: true,
  data: user.blockedUsers || []
});
} catch (error) {
res.status(500).json({
success: false,
message: error.message
});
}
};
// @desc    Delete account
// @route   DELETE /api/settings/account
// @access  Private
export const deleteAccount = async (req, res) => {
try {
const { password } = req.body;
// Verify password
const user = await User.findById(req.user._id).select('+password');
const isMatch = await bcrypt.compare(password, user.password);

if (!isMatch) {
  return res.status(400).json({
    success: false,
    message: 'Password is incorrect'
  });
}

// Delete user's posts, messages, etc.
await Post.deleteMany({ user: req.user._id });
await Message.deleteMany({ 
  $or: [{ sender: req.user._id }, { receiver: req.user._id }] 
});

// Delete user
await User.findByIdAndDelete(req.user._id);

res.status(200).json({
  success: true,
  message: 'Account deleted successfully'
});
} catch (error) {
res.status(500).json({
success: false,
message: error.message
});
}
};