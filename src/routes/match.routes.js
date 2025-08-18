import express from 'express';
import { findMatches } from '../controllers/match.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/find', requireAuth, findMatches);

export default router;