// backend/src/routes/userRoutes.js

import express from 'express';
import multer from 'multer';
import {
  searchUsers,
  getUserById,
  updateProfile,
  uploadAvatar,
  getUserFollowers,
  getUserFollowing,
  followUser,
  unfollowUser,
  getFollowRequests
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 10MB for avatars
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  }
});

// ✅ CRITICAL: Route order matters in Express!
// More specific routes MUST come BEFORE generic/dynamic routes

// Specific string routes first
router.get('/search', protect, searchUsers);
router.get('/follow-requests', protect, getFollowRequests);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

// Dynamic routes with :userId parameter
router.post('/:userId/follow', protect, followUser);
router.post('/:userId/unfollow', protect, unfollowUser);
router.get('/:userId/followers', protect, getUserFollowers);
router.get('/:userId/following', protect, getUserFollowing);

// Generic :id route MUST be last (catches everything else)
router.get('/:id', protect, getUserById);

export default router;