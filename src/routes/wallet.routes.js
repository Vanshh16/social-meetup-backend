import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { depositToWallet, getWalletDetails, getWalletTransactions, withdrawFromWallet } from '../controllers/wallet.controller.js';

const router = Router();

// All routes in this file require a logged-in user
router.use(requireAuth);

// Get main wallet details (balance + recent transactions)
router.get('/', getWalletDetails);

// Get the full transaction history
router.get('/transactions', getWalletTransactions);

// Route for a user to withdraw from their wallet
router.post('/withdraw', withdrawFromWallet);

// Route for a user to deposit to their wallet
router.post('/deposit', depositToWallet);

export default router;