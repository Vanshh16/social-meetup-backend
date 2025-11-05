import { Cashfree } from "cashfree-pg";
import prisma from "../config/db.js";
import crypto from "crypto";
import AppError from "../utils/appError.js";
import { debitUserWallet, creditUserWallet } from "./wallet.service.js";

// Initialize Cashfree
// Cashfree.XClientId = process.env.CASHFREE_APP_ID;
// Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
// Cashfree.XEnvironment = Cashfree.Environment.SANDBOX; // Use .PRODUCTION in production

// var cashfree = new Cashfree(Cashfree.SANDBOX, process.env.CASHFREE_APP_ID, process.env.CASHFREE_SECRET_KEY)

/**
 * Creates a Cashfree payment order.
 * @param {number} amount - Amount in INR.
 * @param {string} customerId - The user's ID.
 * @param {string} customerEmail - The user's email.
 * @param {string} customerPhone - The user's phone number.
 * @returns {Promise<object>} Cashfree order object containing payment_session_id.
 */
export const createOrder = async (
  amount,
  customerId,
  customerEmail,
  customerPhone
) => {
  const orderId = `order_${Date.now()}`;
  const request = {
    order_amount: amount,
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: customerId,
      customer_email: customerEmail,
      customer_phone: customerPhone,
    },
    order_meta: {
      return_url: `http://localhost:3000/order/status?order_id={order_id}`, // Your frontend success URL
    },
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
    if (payment && payment.payment_status === "SUCCESS") {
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
    throw new AppError("Payment verification failed.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { cashfreeOrderId: order_id },
      data: { status: "SUCCESS" },
      include: { joinRequest: { include: { meetup: true } } },
    });

    if (!payment.joinRequest) {
      throw new AppError(
        "Associated join request not found for this payment.",
        404
      );
    }
    if (!payment.joinRequest.meetup) {
      throw new AppError(
        "Associated meetup not found for this join request.",
        404
      );
    }

    const chat = await tx.chat.create({
      data: {
        meetupId: payment.joinRequest.meetupId,
        users: {
          connect: [
            { id: payment.joinRequest.meetup.createdBy },
            { id: payment.joinRequest.senderId },
          ],
        },
      },
    });

    return { payment, chat };
  });
};

/**
 * Creates a Cashfree order for a user to add money to their wallet.
 * @param {string} userId - The ID of the user.
 * @param {number} amount - The amount to deposit (in INR, e.g., 500).
 */
export const createWalletDepositOrder = async (userId, amount) => {
  if (amount <= 10) {
    // Set a minimum deposit amount
    throw new AppError("Deposit amount must be greater than 10 INR.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, mobileNumber: true },
  });

  // 1. Create the order with Cashfree (reusing your existing function)
//   const order = await createOrder(
//     amount,
//     userId,
//     user.email,
//     user.mobileNumber
//   );

  await creditUserWallet(
    userId,
    amount,
    // `Wallet deposit via Cashfree (Order: ${orderId})`,
    `Wallet deposit via Cashfree`
  );

  const payment = await prisma.payment.create({
    data: {
      userId: userId,
      amount: amount,
      purpose: "WALLET_TOP_UP",
      status: "SUCCESS",
      //   cashfreeOrderId: order.order_id,
      //   paymentSessionId: order.payment_session_id,
    },
  });

  // 2. Create a PENDING payment record
  //   await prisma.payment.create({
  //     data: {
  //       userId: userId,
  //       amount: amount * 100, // Store in paise
  //       purpose: 'WALLET_TOP_UP',
  //       status: 'PENDING',
  //       cashfreeOrderId: order.order_id,
  //       paymentSessionId: order.payment_session_id,
  //     },
  //   });

  // 3. Return payment details to the frontend
//   return order;
return payment;
};

/**
 * Handles incoming webhooks from Cashfree to confirm payments.
 * @param {object} payload - The full request body from Cashfree.
 * @param {string} signature - The 'x-webhook-signature' header.
 */
export const handleCashfreeWebhook = async (payload, signature) => {
  try {
    // 1. Verify the webhook signature (CRITICAL for security)
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET; // Add this to your .env
    const ts = payload.headers["x-webhook-timestamp"];
    const text = ts + JSON.stringify(payload.body);

    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(text);
    const calculatedSignature = hmac.digest("base64");

    if (calculatedSignature !== signature) {
      throw new AppError("Invalid webhook signature.", 401);
    }

    // 2. Process the event
    const eventData = payload.body.data;
    const eventType = payload.body.type;

    // Only proceed if the payment was successful
    if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      const orderId = eventData.order.order_id;
      const orderAmount = eventData.order.order_amount; // This is in INR

      // 3. Find the payment in your DB
      const payment = await prisma.payment.findFirst({
        where: {
          cashfreeOrderId: orderId,
          status: "PENDING",
          purpose: "WALLET_TOP_UP",
        },
      });

      // If we don't find a matching pending payment, just acknowledge the webhook.
      // This prevents double-crediting.
      if (!payment) {
        console.warn(
          `Webhook: Received payment for unknown or completed order: ${orderId}`
        );
        return;
      }

      // 4. Credit the user's wallet in a transaction
      // We use 'payment.amount' (in paise) from our DB, not the webhook payload,
      // as our DB is the "source of truth" for the amount.
      await creditUserWallet(
        payment.userId,
        payment.amount / 100, // Convert paise back to INR for the credit function
        `Wallet deposit via Cashfree (Order: ${orderId})`
      );

      // 5. Update our payment record to 'SUCCESS'
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS" },
      });

      console.log(`Wallet topped up successfully for order: ${orderId}`);
    } else {
      console.log(`Received unhandled Cashfree event: ${eventType}`);
    }
  } catch (error) {
    console.error("Error handling Cashfree webhook:", error.message);
    throw error;
  }
};
