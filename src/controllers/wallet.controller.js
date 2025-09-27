import { debitUserWallet, fetchWalletDetails, fetchWalletTransactions } from '../services/wallet.service.js';

export const getWalletDetails = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const wallet = await fetchWalletDetails(userId);
    res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
};

export const getWalletTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const transactions = await fetchWalletTransactions(userId);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

export const withdrawFromWallet = async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    const transaction = await debitUserWallet(req.user.id, amount, description);
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};