import Story from '../models/Story.js';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Create story
// @route   POST /api/stories
// @access  Private
export const createStory = async (req, res) => {
  try {
    const { caption } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image or video'
      });
    }

    console.log('📸 Uploading story...');

    // Convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'social-media/stories',
      resource_type: 'auto'
    });

    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';

    const story = await Story.create({
      user: req.user._id,
      media: result.secure_url,
      mediaType,
      caption: caption || ''
    });

    await story.populate('user', 'name username avatar verified');

    console.log('✅ Story created');

    res.status(201).json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get stories from following users
// @route   GET /api/stories
// @access  Private
export const getStories = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get stories from following users + own stories
    const stories = await Story.find({
      user: { $in: [...user.following, req.user._id] },
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'name username avatar verified')
      .sort({ createdAt: -1 });

    // Group stories by user
    const groupedStories = {};
    stories.forEach(story => {
      const userId = story.user._id.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user: story.user,
          stories: [],
          hasUnviewed: false
        };
      }
      
      const hasViewed = story.viewers.some(v => v.user.toString() === req.user._id.toString());
      if (!hasViewed) {
        groupedStories[userId].hasUnviewed = true;
      }
      
      groupedStories[userId].stories.push({
        _id: story._id,
        media: story.media,
        mediaType: story.mediaType,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewersCount: story.viewers.length,
        hasViewed
      });
    });

    // Convert to array and sort (unviewed first, then by latest story)
    const result = Object.values(groupedStories).sort((a, b) => {
      if (a.hasUnviewed !== b.hasUnviewed) {
        return a.hasUnviewed ? -1 : 1;
      }
      return new Date(b.stories[0].createdAt) - new Date(a.stories[0].createdAt);
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark story as viewed
// @route   POST /api/stories/:id/view
// @access  Private
export const viewStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    // Check if already viewed
    const alreadyViewed = story.viewers.some(
      v => v.user.toString() === req.user._id.toString()
    );

    if (!alreadyViewed) {
      story.viewers.push({ user: req.user._id });
      await story.save();
    }

    res.status(200).json({
      success: true,
      message: 'Story viewed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete story
// @route   DELETE /api/stories/:id
// @access  Private
export const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await story.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Story deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};