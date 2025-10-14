import express from 'express';
import multer from 'multer';
import {
  createPost,
  getFeedPosts,
  getUserPosts,
  likePost,
  savePost,
  getSavedPosts,
  addComment,
  deletePost
} from '../controllers/postController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: {
    fileSize: 40 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    console.log('📎 File filter checking:', file.mimetype);
    
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'), false);
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum size is 10MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  next();
};

router.post('/', protect, upload.single('media'), handleMulterError, createPost);
router.get('/feed', protect, getFeedPosts);
router.get('/saved', protect, getSavedPosts);
router.get('/user/:userId', protect, getUserPosts);
router.post('/:id/like', protect, likePost);
router.post('/:id/save', protect, savePost);
router.post('/:id/comment', protect, addComment);
router.delete('/:id', protect, deletePost);

export default router;