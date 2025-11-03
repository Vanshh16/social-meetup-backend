import { createOrder, createWalletDepositOrder, handleCashfreeWebhook, verifyJoinPaymentAndUnlockChat } from "../services/payment.service.js";
import prisma from "../config/db.js";

export const createMeetupOrderController = async (req, res, next) => {
    try {
        const { amount } = req.body;
        const user = req.user; // From auth middleware

        const order = await createOrder(amount, user.id, user.email, user.mobileNumber);
        
        await prisma.payment.create({
            data: {
                userId: user.id,
                amount: amount * 100, // Store in paise
                purpose: 'MEETUP_CREATION',
                status: 'PENDING',
                cashfreeOrderId: order.order_id,
                paymentSessionId: order.payment_session_id
            }
        });

        res.status(200).json({ success: true, order });
    } catch (error) {
        next(error);
    }
};

export const createJoinOrderController = async (req, res, next) => {
    try {
        const { joinRequestId } = req.params;
        const { amount } = req.body;
        const user = req.user;

        // ... validation logic for join request ...

        const order = await createOrder(amount, user.id, user.email, user.mobileNumber);

        await prisma.payment.create({
            data: {
                userId: user.id,
                joinRequestId,
                amount: amount * 100,
                purpose: 'JOIN_REQUEST',
                status: 'PENDING',
                cashfreeOrderId: order.order_id,
                paymentSessionId: order.payment_session_id
            }
        });

        res.status(200).json({ success: true, order });
    } catch (error) {
        next(error);
    }
};

export const verifyJoinPaymentController = async (req, res, next) => {
    try {
        // The frontend will send the order_id from the return URL
        const result = await verifyJoinPaymentAndUnlockChat(req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// --- CONTROLLER for creating a deposit order ---
export const createDepositOrderController = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const orderDetails = await createWalletDepositOrder(userId, amount);
    res.status(200).json({ success: true, order: orderDetails });
  } catch (error) {
    next(error);
  }
};

// --- CONTROLLER for handling webhooks ---
export const handleCashfreeWebhookController = async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    await handleCashfreeWebhook(req, signature);
    // Send a 200 OK to Cashfree to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    res.status(400).json({ received: false });
  }
};