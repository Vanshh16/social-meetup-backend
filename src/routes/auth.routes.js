import express from 'express';
import { register, login, verifyOtp, sendOtp, completeProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.put('/complete-profile', requireAuth, completeProfile);

export default router;
