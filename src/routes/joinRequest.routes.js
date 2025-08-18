import { Router } from 'express';
import { sendJoinRequest, listMeetupRequests, respondToJoinRequest } from '../controllers/joinRequest.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Send a request to join a specific meetup
router.post('/:meetupId', requireAuth, sendJoinRequest);

// List all pending requests for a specific meetup (for the host)
router.get('/:meetupId/requests', requireAuth, listMeetupRequests);

// Respond to a specific join request by its ID
router.put('/respond/:id', requireAuth, respondToJoinRequest);

export default router;