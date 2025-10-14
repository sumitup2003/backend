import express from 'express';
import multer from 'multer'
import {
  getMessages,
  getConversations,
  sendMessage,
  deleteMessage,
  uploadMessageMedia
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();


const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }
});

router.get('/conversations', protect, getConversations);
router.post('/upload', protect, upload.single('media'), uploadMessageMedia);
router.get('/:userId', protect, getMessages);
router.post('/', protect, sendMessage);
router.delete('/:id', protect, deleteMessage);

export default router;