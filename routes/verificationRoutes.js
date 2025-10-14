import express from 'express';
import {
  submitVerificationRequest,
  getVerificationRequests,
  reviewVerificationRequest,
  getVerificationStatus
} from '../controllers/verificationController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';

const router = express.Router();

// User routes
router.post('/request', protect, submitVerificationRequest);
router.get('/status', protect, getVerificationStatus);

// Admin routes
router.get('/admin/requests', protect, adminOnly, getVerificationRequests);
router.post('/admin/review/:userId', protect, adminOnly, reviewVerificationRequest);

export default router;