import express from 'express';
import { createJoinOrderController, createMeetupOrderController, verifyJoinPaymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/order/meetup', requireAuth, createMeetupOrderController);
router.post('/order/join/:joinRequestId', requireAuth, createJoinOrderController);
router.post('/verify/join', requireAuth, verifyJoinPaymentController);

export default router;