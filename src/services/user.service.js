import prisma from '../config/db.js';

export const blockUser = async (blockerId, blockedId) => {
  if (blockerId === blockedId) {
    throw new Error('You cannot block yourself.');
  }
  return prisma.userBlock.create({
    data: {
      blockerId,
      blockedId,
    },
  });
};

export const unblockUser = async (blockerId, blockedId) => {
  return prisma.userBlock.delete({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });
};

export const getBlockedUsers = async (blockerId) => {
  return prisma.userBlock.findMany({
    where: { blockerId },
    select: {
      blocked: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
        },
      },
    },
  });
};