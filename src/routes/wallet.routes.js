import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { getWalletDetails, getWalletTransactions } from '../controllers/wallet.controller.js';

const router = Router();

// All routes in this file require a logged-in user
router.use(requireAuth);

// Get main wallet details (balance + recent transactions)
router.get('/', getWalletDetails);

// Get the full transaction history
router.get('/transactions', getWalletTransactions);

export default router;