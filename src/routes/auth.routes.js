import express from 'express';
import { authWithGoogle, authWithOtp, verifyOtpController, completeProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/google', authWithGoogle);
router.post('/otp', authWithOtp);
router.post('/otp/verify', verifyOtpController);
router.put('/complete-profile', requireAuth, completeProfile);

export default router;
