import express from 'express';
import {
  getSettings,
  updatePrivacySettings,
  updateNotificationSettings,
  changePassword,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteAccount
} from '../controllers/settingsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/privacy', protect, updatePrivacySettings);
router.put('/notifications', protect, updateNotificationSettings);
router.put('/password', protect, changePassword);
router.post('/block/:userId', protect, blockUser);
router.delete('/block/:userId', protect, unblockUser);
router.get('/blocked', protect, getBlockedUsers);
router.delete('/account', protect, deleteAccount);

export default router;