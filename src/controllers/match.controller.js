import { findMatchesForUser } from '../services/match.service.js';

export const findMatches = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matches = await findMatchesForUser(userId);
    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};