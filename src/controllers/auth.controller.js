import { registerUser, loginUser, completeUserProfile, verifyUserOtp, sendUserOtp } from '../services/auth.service.js';
import { generateToken } from '../utils/jwt.js';

export const register = async (req, res, next) => {
  try {
    const user = await registerUser(req.body);
    const token = generateToken({ id: user.id, role: user.role });
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
};

export const sendOtp = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;
    const status = await sendUserOtp(mobileNumber);
    res.status(200).json({ status });
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { mobileNumber, otp } = req.body;
    const user = await verifyUserOtp(mobileNumber, otp);
    const token = generateToken({ id: user.id });
    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
};

export const completeProfile = async (req, res, next) => {
  try {
    const profileData = req.body;
    const userId = req.user.id;
    const updatedUser = await completeUserProfile(userId, profileData);
    res.status(200).json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { mobileNumber, password } = req.body;
    const user = await loginUser(mobileNumber, password);
    const token = generateToken({ id: user.id, role: user.role });
    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
};
