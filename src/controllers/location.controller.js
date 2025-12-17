import * as LocationService from '../services/location.service.js';

// --- Admin Only ---

export const createCityController = async (req, res, next) => {
  try {
    const city = await LocationService.addCity(req.body);
    res.status(201).json({ success: true, data: city });
  } catch (error) {
    next(error);
  }
};

export const updateCityStatusController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body; // { isActive: true } to go LIVE
    const city = await LocationService.toggleCityStatus(id, isActive);
    res.status(200).json({ success: true, data: city });
  } catch (error) {
    next(error);
  }
};

export const getLocationsController = async (req, res, next) => {
  try {
    const result = await LocationService.getLocations(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// --- Public / User App ---

export const checkAvailabilityController = async (req, res, next) => {
  try {
    const { city } = req.query;
    const isLive = await LocationService.checkServiceAvailability(city);
    
    if (isLive) {
      res.status(200).json({ 
        success: true, 
        message: "Service is live in this area.", 
        isAvailable: true 
      });
    } else {
      // This response allows the frontend to show a "Join Waitlist" screen
      res.status(200).json({ 
        success: true, 
        message: "We are coming soon to your city!", 
        isAvailable: false 
      });
    }
  } catch (error) {
    next(error);
  }
};