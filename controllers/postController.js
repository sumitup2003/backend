import Post from '../models/Post.js';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (file) => {
  try {
    console.log('📤 Starting upload to Cloudinary...');
    console.log('File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Convert buffer to base64
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'social-media',
      resource_type: 'auto',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
      ]
    });
    
    console.log('✅ Upload successful:', result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw new Error(`Failed to upload media: ${error.message}`);
  }
};

// @desc    Create post with image/video upload
// @route   POST /api/posts
// @access  Private
export const createPost = async (req, res) => {
  try {
    console.log('📝 Create post request received');
    console.log('Body:', req.body);
    console.log('File:', req.file ? 'Yes' : 'No');

    const { content } = req.body;
    let mediaUrl = '';

    // Validate: must have content or file
    if (!content && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Post must have content or media'
      });
    }

    // Handle file upload if present
    if (req.file) {
      try {
        mediaUrl = await uploadToCloudinary(req.file);
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: uploadError.message
        });
      }
    }

    // Create post
    const post = await Post.create({
      user: req.user._id,
      content: content || '',
      image: mediaUrl
    });

    // Populate user details
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name username avatar');

    // Add status fields
    const postWithStatus = {
      ...populatedPost.toObject(),
      isLiked: false,
      isSaved: false,
      likesCount: 0,
      commentsCount: 0
    };

    console.log('✅ Post created successfully');

    res.status(201).json({
      success: true,
      data: postWithStatus
    });
  } catch (error) {
    console.error('❌ Create post error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create post'
    });
  }
};

// @desc    Get feed posts
// @route   GET /api/posts/feed
// @access  Private
export const getFeedPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user._id);

    const posts = await Post.find({
      user: { $in: [...user.following, req.user._id] }
    })
      .populate('user', 'name username avatar verified')
      .populate('comments.user', 'name username avatar verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const postsWithStatus = posts.map(post => ({
      ...post.toObject(),
      isLiked: post.likes.includes(req.user._id),
      isSaved: user.savedPosts.includes(post._id),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    res.status(200).json({
      success: true,
      data: postsWithStatus,
      page,
      totalPages: Math.ceil(posts.length / limit)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user posts
// @route   GET /api/posts/user/:userId
// @access  Private
export const getUserPosts = async (req, res, next) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('user', 'name username avatar verified bio')
      .populate('comments.user', 'name username avatar verified')
      .sort({ createdAt: -1 });

    const user = await User.findById(req.user._id);
    
    const postsWithStatus = posts.map(post => ({
      ...post.toObject(),
      isLiked: post.likes.includes(req.user._id),
      isSaved: user.savedPosts.includes(post._id),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    res.status(200).json({
      success: true,
      data: postsWithStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/Unlike post
// @route   POST /api/posts/:id/like
// @access  Private
export const likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    const likeIndex = post.likes.indexOf(req.user._id);

    if (likeIndex === -1) {
      post.likes.push(req.user._id);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    await post.save();

    res.status(200).json({
      success: true,
      data: {
        isLiked: likeIndex === -1,
        likesCount: post.likes.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save/Unsave post
// @route   POST /api/posts/:id/save
// @access  Private
export const savePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    const user = await User.findById(req.user._id);
    const saveIndex = user.savedPosts.indexOf(req.params.id);

    if (saveIndex === -1) {
      user.savedPosts.push(req.params.id);
    } else {
      user.savedPosts.splice(saveIndex, 1);
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        isSaved: saveIndex === -1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved posts
// @route   GET /api/posts/saved
// @access  Private
export const getSavedPosts = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'savedPosts',
      populate: { 
        path: 'user', 
        select: 'name username avatar verified' 
      }
    });

    const postsWithStatus = user.savedPosts.map(post => ({
      ...post.toObject(),
      isLiked: post.likes.includes(req.user._id),
      isSaved: true,
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    res.status(200).json({
      success: true,
      data: postsWithStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment
// @route   POST /api/posts/:id/comment
// @access  Private
export const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    post.comments.push({
      user: req.user._id,
      text
    });

    await post.save();
    await post.populate('comments.user', 'name username avatar verified');

    res.status(200).json({
      success: true,
      data: post.comments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this post' 
      });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};