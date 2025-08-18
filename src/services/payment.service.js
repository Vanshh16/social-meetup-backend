import { Cashfree } from 'cashfree-pg';
import prisma from "../config/db.js";
import crypto from 'crypto';

// Initialize Cashfree
Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
Cashfree.XEnvironment = Cashfree.Environment.SANDBOX; // Use .PRODUCTION in production

/**
 * Creates a Cashfree payment order.
 * @param {number} amount - Amount in INR.
 * @param {string} customerId - The user's ID.
 * @param {string} customerEmail - The user's email.
 * @param {string} customerPhone - The user's phone number.
 * @returns {Promise<object>} Cashfree order object containing payment_session_id.
 */
export const createOrder = async (amount, customerId, customerEmail, customerPhone) => {
    const orderId = `order_${Date.now()}`;
    const request = {
        "order_amount": amount,
        "order_currency": "INR",
        "order_id": orderId,
        "customer_details": {
            "customer_id": customerId,
            "customer_email": customerEmail,
            "customer_phone": customerPhone
        },
        "order_meta": {
            "return_url": `http://localhost:3000/order/status?order_id={order_id}` // Your frontend success URL
        }
    };

    try {
        const response = await Cashfree.PGCreateOrder("2022-09-01", request);
        return response.data;
    } catch (error) {
        console.error("Error creating Cashfree order:", error.response.data);
        throw new Error("Could not create payment order.");
    }
};

/**
 * Verifies a Cashfree payment signature.
 * @param {object} paymentDetails - Contains order_id and payment_session_id.
 * @returns {Promise<boolean>} True if the payment is successful.
 */
const verifyCashfreePayment = async (orderId) => {
    try {
        const response = await Cashfree.PGOrderFetchPayments("2022-09-01", orderId);
        const payment = response.data[0];
        if (payment && payment.payment_status === 'SUCCESS') {
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error verifying Cashfree payment:", error.response.data);
        return false;
    }
};

// This function is now specific to verifying join payments
export const verifyJoinPaymentAndUnlockChat = async (paymentDetails) => {
    const { order_id } = paymentDetails;

    const isVerified = await verifyCashfreePayment(order_id);
    if (!isVerified) {
        throw new Error("Payment verification failed.");
    }
    
    return prisma.$transaction(async (tx) => {
        const payment = await tx.payment.update({
            where: { cashfreeOrderId: order_id },
            data: { status: 'SUCCESS' },
            include: { joinRequest: { include: { meetup: true } } }
        });

        if (!payment.joinRequest) {
            throw new Error("Associated join request not found for this payment.");
        }
        
        const chat = await tx.chat.create({
            data: {
                meetupId: payment.joinRequest.meetupId,
                users: {
                    connect: [
                        { id: payment.joinRequest.meetup.createdBy },
                        { id: payment.joinRequest.senderId }
                    ],
                },
            },
        });

        return { payment, chat };
    });
};