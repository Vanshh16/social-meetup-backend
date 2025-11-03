import express from 'express';
import { createDepositOrderController, createJoinOrderController, createMeetupOrderController, handleCashfreeWebhookController, verifyJoinPaymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/order/meetup', requireAuth, createMeetupOrderController);
router.post('/order/join/:joinRequestId', requireAuth, createJoinOrderController);
router.post('/verify/join', requireAuth, verifyJoinPaymentController);

// User-facing API to create a deposit order
// router.post('/deposit/order', requireAuth, createDepositOrderController);

// Server-facing API for Cashfree to send webhooks
// This MUST be public (no requireAuth)
router.post('/webhook/cashfree', handleCashfreeWebhookController);

export default router;