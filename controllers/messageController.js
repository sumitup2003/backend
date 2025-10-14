import Message from '../models/Message.js';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';


// @desc    Get messages with a user
// @route   GET /api/messages/:userId
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Check if users follow each other
    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const mutualFollow = currentUser.following.includes(userId) && 
                        targetUser.following.includes(req.user._id);

    if (!mutualFollow) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only message users you both follow' 
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'name username avatar verified')
    .populate('receiver', 'name username avatar verified');

    // Mark messages as read
    await Message.updateMany(
      { sender: userId, receiver: req.user._id, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};


export const uploadMessageMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('📤 Uploading message media...');

    // Convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'social-media/messages',
      resource_type: 'auto'
    });

    console.log('✅ Media uploaded:', result.secure_url);

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url
      }
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all conversations
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get users who follow back (mutual follows)
    const mutualFollows = await User.find({
      _id: { $in: user.following },
      following: req.user._id
    }).select('name username verified avatar isActive lastSeen');

    // Get last message for each conversation
    const conversationsWithMessages = await Promise.all(
      mutualFollows.map(async (contact) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user._id, receiver: contact._id },
            { sender: contact._id, receiver: req.user._id }
          ]
        })
        .sort({ createdAt: -1 })
        .select('text createdAt sender');

        const unreadCount = await Message.countDocuments({
          sender: contact._id,
          receiver: req.user._id,
          read: false
        });

        return {
          ...contact.toObject(),
          lastMessage: lastMessage ? {
            text: lastMessage.text,
            time: lastMessage.createdAt,
            fromMe: lastMessage.sender.toString() === req.user._id.toString()
          } : null,
          unreadCount
        };
      })
    );

    // Sort by last message time
    conversationsWithMessages.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return b.lastMessage.time - a.lastMessage.time;
    });

    res.status(200).json({
      success: true,
      data: conversationsWithMessages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { receiver, text } = req.body;

    // Check mutual follow
    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findById(receiver);

    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const mutualFollow = currentUser.following.includes(receiver) && 
                        targetUser.following.includes(req.user._id);

    if (!mutualFollow) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only message users you both follow' 
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver,
      text
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name username avatar verified')
      .populate('receiver', 'name username avatar verified');

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this message' 
      });
    }

    await message.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};