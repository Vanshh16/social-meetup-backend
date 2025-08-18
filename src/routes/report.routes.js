import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { submitReport } from '../controllers/report.controller.js';

const router = Router();

router.post('/', requireAuth, submitReport);

export default router;