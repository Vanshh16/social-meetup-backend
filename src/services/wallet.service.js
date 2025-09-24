import prisma from '../config/db.js';
import AppError from '../utils/appError.js';

/**
 * Fetches the wallet details, including balance and recent transactions, for a specific user.
 * @param {string} userId - The ID of the logged-in user.
 */
export const fetchWalletDetails = async (userId) => {
  const wallet = await prisma.userWallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Include the 10 most recent transactions
      },
    },
  });

  if (!wallet) {
    throw new AppError('Wallet not found for this user.', 404);
  }

  return wallet;
};

/**
 * Fetches the complete transaction history for a specific user.
 * @param {string} userId - The ID of the logged-in user.
 */
export const fetchWalletTransactions = async (userId) => {
  const wallet = await prisma.userWallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new AppError('Wallet not found for this user.', 404);
  }

  return prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: {
      createdAt: 'desc',
    },
  });
};