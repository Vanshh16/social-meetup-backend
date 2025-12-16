import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import {
  createCityController,
  updateCityStatusController,
  getLocationsController,
  checkAvailabilityController
} from '../controllers/location.controller.js';

const router = Router();

// ==========================================
// PUBLIC ROUTES (For User Mobile App)
// ==========================================

/**
 * @route   GET /api/v1/locations/check?city=Mumbai
 * @desc    Checks if service is Live in a specific city
 * @access  Public
 */
router.get('/check', checkAvailabilityController);


// ==========================================
// ADMIN ROUTES (Protected)
// ==========================================

// Apply authentication and Admin role check for all routes below
router.use(requireAuth, requireRole(['ADMIN']));

/**
 * @route   GET /api/v1/locations?tier=TIER_1&isActive=false
 * @desc    Fetch cities with filters (State, Tier, Status)
 */
router.get('/', getLocationsController);

/**
 * @route   POST /api/v1/locations/cities
 * @desc    Add a new city with Tier assignment
 */
router.post('/cities', createCityController);

/**
 * @route   PATCH /api/v1/locations/cities/:id/status
 * @desc    The "Master Switch" - Toggle a city to Live or Coming Soon
 * @body    { "isActive": true }
 */
router.patch('/cities/:id/status', updateCityStatusController);

export default router;