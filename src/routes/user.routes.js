import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { blockUserController, unblockUserController, getBlockedUsersController, registerFcmTokenController } from '../controllers/user.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/blocked', getBlockedUsersController);
router.post('/:userId/block', blockUserController);
router.delete('/:userId/unblock', unblockUserController);
router.post('/register-fcm', requireAuth, registerFcmTokenController);

export default router;