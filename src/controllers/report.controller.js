import { createReport } from '../services/report.service.js';

export const submitReport = async (req, res, next) => {
  try {
    const reporterId = req.user.id;
    const { reportedId, reason, details } = req.body;
    await createReport(reporterId, reportedId, reason, details);
    res.status(201).json({ success: true, message: 'Report submitted successfully.' });
  } catch (error) {
    next(error);
  }
};