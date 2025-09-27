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

/**
 * Creates a DEBIT transaction for a user, ensuring they have sufficient balance.
 * @param {string} userId - The ID of the user initiating the debit.
 * @param {number} amount - The amount to debit.
 * @param {string} description - The reason for the debit.
 */
export const debitUserWallet = async (userId, amount, description) => {
  if (amount <= 0) {
    throw new AppError('Debit amount must be positive.', 400);
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError('User wallet not found.', 404);
    }
    if (wallet.balance < amount) {
      throw new AppError('Insufficient wallet balance.', 400);
    }

    // 1. Decrease the wallet balance
    await tx.userWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    // 2. Record the transaction
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'DEBIT',
        description,
      },
    });

    return transaction;
  });
};