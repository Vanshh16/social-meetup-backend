import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js'; // Assuming this is the correct name
import {
  createMeetupController,
  getMyMeetupsController,
  getMeetupDetailsController,
  getMeetupHistoryController,
  editMeetupController,
  cancelMeetupController,
  getJoinedMeetupsController,
} from '../controllers/meetup.controller.js';

const router = Router();

router.use(requireAuth); // Apply auth to all meetup routes

router.post('/', createMeetupController);
router.get('/my-meetups', getMyMeetupsController);
router.get('/joined', getJoinedMeetupsController);
router.get('/history', getMeetupHistoryController);

// Routes for specific meetups by ID
router.get('/:id', getMeetupDetailsController);
router.put('/:id', editMeetupController);
router.delete('/:id', cancelMeetupController);

export default router;