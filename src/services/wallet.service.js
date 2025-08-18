import prisma from '../config/db.js';

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
    throw new Error('Wallet not found for this user.');
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
    throw new Error('Wallet not found for this user.');
  }

  return prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: {
      createdAt: 'desc',
    },
  });
};