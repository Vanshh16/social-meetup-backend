import prisma from '../config/db.js';
import AppError from '../utils/appError.js';

/**
 * Add a new State
 */
export const addState = async (name) => {
  return prisma.state.create({ data: { name } });
};

/**
 * Add a City with Tier and Initial Status
 */
export const addCity = async (data) => {
  const { name, stateId, tier, isActive } = data;
  
  // Default new cities to inactive to prevent "empty room" issues
  return prisma.city.create({
    data: {
      name,
      stateId,
      tier: tier || 'TIER_3', 
      isActive: isActive || false 
    }
  });
};

/**
 * The "Control Switch" - Activate or Deactivate a City
 */
export const toggleCityStatus = async (cityId, isActive) => {
  return prisma.city.update({
    where: { id: cityId },
    data: { isActive }
  });
};

/**
 * Fetch locations for Admin Dashboard with filters
 * Allows admin to see: "Show me all Inactive Tier-1 cities"
 */
export const getLocations = async (query) => {
  const { stateId, tier, isActive } = query;

  const whereClause = {};
  if (stateId) whereClause.stateId = stateId;
  if (tier) whereClause.tier = tier;
  if (isActive !== undefined) whereClause.isActive = (isActive === 'true');

  return prisma.city.findMany({
    where: whereClause,
    include: {
      state: true
    },
    orderBy: [
      { state: { name: 'asc' } },
      { tier: 'asc' } // Show Tier 1 first
    ]
  });
};

/**
 * PUBLIC API: Check if service is available in a user's city
 */
export const checkServiceAvailability = async (cityName) => {
  const city = await prisma.city.findFirst({
    where: { 
      name: { equals: cityName, mode: 'insensitive' },
      isActive: true 
    }
  });

  return !!city; // Returns true if live, false if restricted
};