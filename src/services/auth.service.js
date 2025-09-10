import prisma from "../config/db.js";
import { hashPassword, comparePasswords } from "../utils/password.js";
import { fetchReferralReward } from "./admin.service.js";
import twilio from 'twilio';
import { OAuth2Client } from 'google-auth-library';

// --- Setup Clients ---
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SID;

/**
 * Handles login or signup via Google.
 * Verifies the Google ID token, finds an existing user or creates a new one, and returns the user.
 * @param {string} idToken - The ID token received from the frontend Google Sign-In.
 * @returns {Promise<object>} The user object.
 */
export const loginOrSignupWithGoogle = async (idToken) => {
  // Verify the Google ID token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error('Invalid Google token.');
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  // If user exists, log them in. If not, create a new account.
  if (user) {
    // If user exists but signed up with mobile, link their Google ID
    if (!user.googleId) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: payload.sub }
        });
    }
  } else {
    // Create a new user with details from Google
    user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        googleId: payload.sub, // The unique Google ID
        profilePhoto: payload.picture,
        authMethod: 'GOOGLE',
        isVerified: true, // Google accounts are pre-verified
        referralCode: generateReferralCode(payload.name),
      },
    });
    // Create a wallet for the new user
    await prisma.userWallet.create({ data: { userId: user.id } });
  }

  return user;
};


/**
 * Initiates login or signup with mobile OTP.
 * Checks if a user exists. If not, it creates one. Then sends an OTP.
 * @param {string} mobileNumber - The user's mobile number.
 * @returns {Promise<string>} A message indicating the OTP has been sent.
 */
export const sendOtpForLoginOrSignup = async (mobileNumber) => {
  let user = await prisma.user.findUnique({ where: { mobileNumber } });

  // If user doesn't exist, create a new, unverified user
  if (!user) {
    // A temporary email is needed as the field is mandatory.
    // The user should be prompted to complete their profile later.
    const tempEmail = `${mobileNumber}@temp.example.com`;
    const tempName = `User ${mobileNumber.slice(-4)}`;

    user = await prisma.user.create({
      data: {
        name: tempName,
        email: tempEmail,
        mobileNumber: mobileNumber,
        authMethod: 'MOBILE_OTP',
        isVerified: false,
        referralCode: generateReferralCode(tempName),
      },
    });
    // Create a wallet for the new user
    await prisma.userWallet.create({ data: { userId: user.id } });
  }

  // Send OTP via Twilio
  await twilioClient.verify.v2.services(twilioVerifyServiceSid)
    .verifications
    .create({ to: `+91${mobileNumber}`, channel: 'sms' });
    
  return `OTP sent to ${mobileNumber}`;
};


/**
 * Verifies an OTP and marks the user as verified.
 * @param {string} mobileNumber - The user's mobile number.
 * @param {string} otp - The OTP code from the user.
 * @returns {Promise<object>} The verified user object.
 */
export const verifyOtpAndLogin = async (mobileNumber, otp) => {
  const verificationCheck = await twilioClient.verify.v2.services(twilioVerifyServiceSid)
    .verificationChecks
    .create({ to: `+91${mobileNumber}`, code: otp });

  if (verificationCheck.status === 'approved') {
    const user = await prisma.user.update({
      where: { mobileNumber },
      data: { isVerified: true },
    });
    return user;
  } else {
    throw new Error('Invalid OTP. Please try again.');
  }
};


/**
 * Allows a user to complete their profile after signing up.
 * @param {string} userId - The ID of the logged-in user.
 * @param {object} profileData - The data to update.
 */
export const completeUserProfile = async (userId, profileData) => {
  return prisma.user.update({
    where: { id: userId },
    data: profileData,
  });
};

/**
 * Credits a referrer's wallet after a successful referral.
 * @param {string} referrerId - The ID of the user who made the referral.
 */
const creditReferrerWallet = async (referrerId) => {
  const rewardAmount = await fetchReferralReward();

  if (rewardAmount <= 0) {
    console.log('Referral reward is 0 or not set. Skipping credit.');
    return;
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId: referrerId } });
    if (!wallet) return; // Referrer has no wallet, skip

    await tx.userWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: rewardAmount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: rewardAmount,
        type: 'CREDIT',
        description: 'Credit for successful referral',
      },
    });
  });
};