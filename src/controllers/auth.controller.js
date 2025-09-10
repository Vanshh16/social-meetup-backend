import {
  loginOrSignupWithGoogle,
  sendOtpForLoginOrSignup,
  verifyOtpAndLogin,
  completeUserProfile
} from '../services/auth.service.js';
import { generateToken } from '../utils/jwt.js';

/**
 * Handles Google Sign-In.
 */
export const authWithGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const user = await loginOrSignupWithGoogle(idToken);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, mobileNumber: user.mobileNumber });
    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the first step of OTP-based auth: sending the code.
 */
export const authWithOtp = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;
    const message = await sendOtpForLoginOrSignup(mobileNumber);
    res.status(200).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the second step of OTP-based auth: verifying the code and logging in.
 */
export const verifyOtpController = async (req, res, next) => {
  try {
    const { mobileNumber, otp } = req.body;
    const user = await verifyOtpAndLogin(mobileNumber, otp);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, mobileNumber: user.mobileNumber });
    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles profile completion.
 */
export const completeProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updatedUser = await completeUserProfile(userId, req.body);
    res.status(200).json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
};
