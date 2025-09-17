import express from 'express';
import { findMatches, searchMeetupsController } from '../controllers/match.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/find', requireAuth, findMatches);
router.post('/search', requireAuth, searchMeetupsController);

export default router;
