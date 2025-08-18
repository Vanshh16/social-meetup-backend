import prisma from '../config/db.js';

export const createReport = async (reporterId, reportedId, reason, details) => {
  if (reporterId === reportedId) {
    throw new Error('You cannot report yourself.');
  }

  // Verify the user being reported exists
  const reportedUser = await prisma.user.findUnique({ where: { id: reportedId } });
  if (!reportedUser) {
    throw new Error('User to be reported not found.');
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