import prisma from '../config/db.js';
import AppError from '../utils/appError.js';

export const createReport = async (reporterId, reportedId, reason, details) => {
  if (reporterId === reportedId) {
    throw new Error('You cannot report yourself.');
  }

  // Verify the user being reported exists
  const reportedUser = await prisma.user.findUnique({ where: { id: reportedId } });
  if (!reportedUser) {
    throw new AppError('User to be reported not found.', 404);
  }

  return prisma.userReport.create({
    data: {
      reporterId,
      reportedId,
      reason,
      details,
    },
  });
};