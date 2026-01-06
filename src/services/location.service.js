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
  const {
    page = 1,
    limit = 10,
    search,      // Search by City Name
    stateId,     // Filter by State
    tier,        // Filter by Tier (TIER_1, TIER_2...)
    isActive     // Filter by Status (true/false)
  } = query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const whereClause = {};

  if (search) {
    whereClause.name = { contains: search, mode: 'insensitive' };
  }

  if (stateId && stateId !== 'ALL') {
    whereClause.stateId = stateId;
  }

  if (tier && tier !== 'ALL') {
    whereClause.tier = tier;
  }

  if (isActive !== undefined && isActive !== 'ALL') {
    whereClause.isActive = (isActive === 'true');
  }

  const cities = await prisma.city.findMany({
    where: whereClause,
    include: {
      state: true,
      _count: {
        select: { users: true }
      }
    },
    skip,
    take,
    orderBy: [
      { isActive: 'desc' },
      { tier: 'asc' },
      { name: 'asc' }
    ]
  });

  const total = await prisma.city.count({
    where: whereClause
  });

  // 3. Format response
  const formattedCities = cities.map(city => ({
    id: city.id,
    name: city.name,
    state: city.state.name,
    tier: city.tier,
    isActive: city.isActive,
    userCount: city._count.users // Useful metric for Admin
  }));

  return {
    locations: formattedCities,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / take),
      totalItems: total,
      limit: take,
    }
  };
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