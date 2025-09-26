import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { blockUserController, unblockUserController, getBlockedUsersController, registerFcmTokenController, getUserProfileController, getMyProfileController, updateMyProfileController } from '../controllers/user.controller.js';

const router = Router();

router.use(requireAuth);

// --- Routes for logged-in user's own profile ---
router.get('/me', getMyProfileController);
router.put('/me', updateMyProfileController);

router.get('/:id/profile', getUserProfileController);
router.get('/blocked', getBlockedUsersController);
router.post('/:userId/block', blockUserController);
router.delete('/:userId/unblock', unblockUserController);
router.post('/register-fcm', requireAuth, registerFcmTokenController);

export default router;