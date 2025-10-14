import express from 'express';
import multer from 'multer';
import {
  createStory,
  getStories,
  viewStory,
  deleteStory
} from '../controllers/storyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/', protect, upload.single('media'), createStory);
router.get('/', protect, getStories);
router.post('/:id/view', protect, viewStory);
router.delete('/:id', protect, deleteStory);

export default router;