import { findMatchesForUser, searchMeetups, searchMeetupsByDistance } from '../services/match.service.js';

// --- Existing controller function ---
export const findMatches = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matches = await findMatchesForUser(userId);
    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    // return res.status(400).json({ success: false, message: error.message, data: [] });
    next(error);
  }
};


// --- New controller function for search ---
export const searchMeetupsController = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const searchCriteria = req.body; // The search filters from the frontend
        const meetups = await searchMeetupsByDistance(userId, searchCriteria);

        if (meetups.length === 0) {
            return res.status(200).json({ success: true, message: "No meetups found matching your criteria.", data: [] });
        }

        res.status(200).json({ success: true, data: meetups });
    } catch (error) {
        // return res.status(400).json({ success: false, message: error.message, data: [] });
        next(error);
    }
};