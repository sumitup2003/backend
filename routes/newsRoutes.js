// backend/routes/newsRoutes.js

import express from 'express';
import { getHeadlines } from '../controllers/newsController.js';
// import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get news headlines (protected route - requires authentication)
router.get('/headlines', getHeadlines);

export default router;