// backend/src/controllers/userController.js

import User from '../models/User.js';
import FollowRequest from '../models/FollowRequest.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('name username verified avatar bio followers following')
    .limit(20);

    // Check follow status for each user
    const usersWithFollowStatus = users.map(user => ({
      ...user.toObject(),
      isFollowing: req.user.following.some(id => id.toString() === user._id.toString()),
      isFollower: user.followers.some(id => id.toString() === req.user._id.toString()),
      followsYou: user.following.some(id => id.toString() === req.user._id.toString())
    }));

    res.status(200).json({
      success: true,
      data: usersWithFollowStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'name username avatar verified')
      .populate('following', 'name username avatar verified');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if users follow each other
    const isFollowing = req.user.following.some(id => id.toString() === user._id.toString());
    const followsYou = user.following.some(id => id.toString() === req.user._id.toString());
    const mutualFollow = isFollowing && followsYou;

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        isFollowing,
        followsYou,
        mutualFollow
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, bio } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, bio },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload avatar
// @route   POST /api/users/avatar
// @access  Private
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload an image' 
      });
    }

    console.log('📸 Uploading avatar...');

    // Convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'social-media/avatars',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' }
      ]
    });

    const avatarUrl = result.secure_url;
    console.log('✅ Avatar uploaded:', avatarUrl);

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload avatar'
    });
  }
};

// @desc    Get follow requests
// @route   GET /api/users/follow-requests
// @access  Private
export const getFollowRequests = async (req, res, next) => {
  try {
    const requests = await FollowRequest.find({
      to: req.user._id,
      status: 'pending'
    }).populate('from', 'name username avatar verified bio');

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's followers
// @route   GET /api/users/:userId/followers
// @access  Private
export const getUserFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'name username avatar bio verified isActive');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user.followers
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user's following
// @route   GET /api/users/:userId/following
// @access  Private
export const getUserFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', 'name username avatar bio verified isActive');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user.following
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Follow a user
// @route   POST /api/users/:userId/follow
// @access  Private
export const followUser = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    console.log('📍 Follow request:', { 
      targetUserId, 
      currentUserId: currentUserId.toString() 
    });

    // Validate user ID
    if (!targetUserId || targetUserId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Can't follow yourself
    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    const userToFollow = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following
    const isAlreadyFollowing = currentUser.following.some(
      id => id.toString() === targetUserId
    );

    if (isAlreadyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Add to following and followers
    currentUser.following.push(targetUserId);
    userToFollow.followers.push(currentUserId);

    await currentUser.save();
    await userToFollow.save();

    console.log('✅ User followed successfully');

    res.status(200).json({
      success: true,
      message: 'User followed successfully',
      data: {
        followersCount: userToFollow.followers.length,
        followingCount: currentUser.following.length
      }
    });
  } catch (error) {
    console.error('❌ Follow user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to follow user'
    });
  }
};

// @desc    Unfollow a user
// @route   POST /api/users/:userId/unfollow
// @access  Private
export const unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    console.log('📍 Unfollow request:', { 
      targetUserId, 
      currentUserId: currentUserId.toString() 
    });

    // Validate user ID
    if (!targetUserId || targetUserId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Can't unfollow yourself
    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot unfollow yourself'
      });
    }

    const userToUnfollow = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if actually following
    const isFollowing = currentUser.following.some(
      id => id.toString() === targetUserId
    );

    if (!isFollowing) {
      return res.status(400).json({
        success: false,
        message: 'You are not following this user'
      });
    }

    // Remove from following and followers
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== targetUserId
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUserId.toString()
    );

    await currentUser.save();
    await userToUnfollow.save();

    console.log('✅ User unfollowed successfully');

    res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
      data: {
        followersCount: userToUnfollow.followers.length,
        followingCount: currentUser.following.length
      }
    });
  } catch (error) {
    console.error('❌ Unfollow user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to unfollow user'
    });
  }
};