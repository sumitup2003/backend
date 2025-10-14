//backend/routes/callRoutes.js

import express from 'express';
import {
  saveCall,
  getCallHistory,
  getMissedCallsCount,
  markCallsAsSeen,
  deleteCall
} from '../controllers/callController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/save', protect, saveCall);
router.get('/history', protect, getCallHistory);
router.get('/missed-count', protect, getMissedCallsCount);
router.put('/mark-seen', protect, markCallsAsSeen);
router.delete('/:id', protect, deleteCall);

export default router;