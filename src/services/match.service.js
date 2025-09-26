import prisma from "../config/db.js";
import AppError from "../utils/appError.js";
import { calculateAge } from "../utils/helper.js";
import haversine from 'haversine-distance';

export const findMatchesForUser = async (userId) => {
  const userMeetup = await prisma.meetup.findFirst({
    where: { createdBy: userId },
    orderBy: { createdAt: "desc" },
  });

  if (!userMeetup) {
    throw new AppError("You must create a meet-up request to find matches.", 400);
  }

  // 1. Get IDs of users to exclude
  const usersIHaveBlocked = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  const usersWhoHaveBlockedMe = await prisma.userBlock.findMany({
    where: { blockedId: userId },
    select: { blockerId: true },
  });

  const excludedIds = [
    ...usersIHaveBlocked.map(u => u.blockedId),
    ...usersWhoHaveBlockedMe.map(u => u.blockerId),
  ];

  const matches = await prisma.meetup.findMany({
    where: {
      createdBy: {
        notIn: excludedIds,
        not: userId, // Also exclude self
      },
      category: userMeetup.category,
      preferredGender: {
        equals: userMeetup.preferredGender,
        mode: "insensitive",
      },
      user: {
        dateOfBirth: {
          lte: new Date(
            new Date().setFullYear(
              new Date().getFullYear() - userMeetup.preferredAgeMin
            )
          ),
          gte: new Date(
            new Date().setFullYear(
              new Date().getFullYear() - userMeetup.preferredAgeMax
            )
          ),
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
          gender: true,
          bio: true,
          hobbies: true,
          city: true,
          dateOfBirth: true,
        },
      },
    },
    take: 20,
  });

  return matches.map((match) => ({
    ...match,
    user: {
      ...match.user,
      age: calculateAge(match.user.dateOfBirth),
      dateOfBirth: undefined,
    },
  }));
};


// --- New function for direct search ---
/**
 * Searches for meetups based on a user's provided criteria.
 * @param {string} userId - The ID of the user performing the search.
 * @param {object} criteria - An object containing search filters.
 * @returns {Promise<Array>} A list of matching meetups.
 */
export const searchMeetups = async (userId, criteria) => {
    // 1. Get IDs of users to exclude (blocked users)
    const usersIHaveBlocked = await prisma.userBlock.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
    });
    const usersWhoHaveBlockedMe = await prisma.userBlock.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
    });
    const excludedIds = [
        ...usersIHaveBlocked.map(u => u.blockedId),
        ...usersWhoHaveBlockedMe.map(u => u.blockerId),
    ];

    // 2. Build a dynamic "where" clause for the search
    const whereClause = {
        // Exclude the user's own meetups and any from blocked users
        createdBy: {
            notIn: excludedIds,
            not: userId,
        },
    };

    // Add filters to the clause only if they are provided in the criteria
    if (criteria.category) {
        whereClause.category = criteria.category;
    }
    if (criteria.subcategory) {
        whereClause.subcategory = criteria.subcategory;
    }
    if (criteria.preferredGender && criteria.preferredGender !== 'any') {
        whereClause.preferredGender = { in: [criteria.preferredGender, 'any'], mode: 'insensitive' };
    }
    if (criteria.dateStart && criteria.dateEnd) {
        whereClause.date = {
            gte: new Date(criteria.dateStart),
            lte: new Date(criteria.dateEnd),
        };
    }
    if (criteria.preferredAgeMin && criteria.preferredAgeMax) {
        whereClause.preferredAgeMin = { gte: criteria.preferredAgeMin };
        whereClause.preferredAgeMax = { lte: criteria.preferredAgeMax };
    }

    // 3. Execute the search query
    const matches = await prisma.meetup.findMany({
        where: whereClause,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    profilePhoto: true,
                    gender: true,
                    bio: true,
                    hobbies: true,
                    city: true,
                    dateOfBirth: true,
                    pictures: true,
                },
            },
        },
        take: 50, // Limit the number of results
    });

    // 4. Process and return the results
    return matches.map((match) => ({
        ...match,
        user: {
            ...match.user,
            age: calculateAge(match.user.dateOfBirth),
            dateOfBirth: undefined,
        },
    }));
};

/**
 * Searches for meetups based on user's location, chosen radius, and other criteria.
 * @param {string} userId - The ID of the user performing the search.
 * @param {object} criteria - Search filters including user's coords and desired radius.
 * @returns {Promise<Array>} A list of matching meetups, sorted by distance.
 */
export const searchMeetupsByDistance = async (userId, criteria) => {
    const { userLat, userLon, radiusKm, ...otherCriteria } = criteria;

    if (!userLat || !userLon || !radiusKm) {
    throw new AppError("User coordinates and a search radius are required.", 400);
  }

    // 1. Get IDs of users to exclude (blocked users)
    const usersIHaveBlocked = await prisma.userBlock.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
    });
    const usersWhoHaveBlockedMe = await prisma.userBlock.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
    });
    const excludedIds = [
        ...usersIHaveBlocked.map(u => u.blockedId),
        ...usersWhoHaveBlockedMe.map(u => u.blockerId),
    ];


    // Build the initial query based on non-location filters
    const whereClause = {
        createdBy: { not: userId , notIn: excludedIds  },
    };

    if (otherCriteria.category) {
        whereClause.category = otherCriteria.category;
    }
    if (otherCriteria.subcategory) {
        whereClause.subcategory = otherCriteria.subcategory;
    }
    if (otherCriteria.preferredGender && otherCriteria.preferredGender !== 'any') {
        whereClause.preferredGender = { in: [otherCriteria.preferredGender, 'any'], mode: 'insensitive' };
    }
    if (otherCriteria.dateStart && otherCriteria.dateEnd) {
        whereClause.date = {
            gte: new Date(otherCriteria.dateStart),
            lte: new Date(otherCriteria.dateEnd),
        };
    }
    if (otherCriteria.preferredAgeMin && otherCriteria.preferredAgeMax) {
        whereClause.preferredAgeMin = { gte: otherCriteria.preferredAgeMin };
        whereClause.preferredAgeMax = { lte: otherCriteria.preferredAgeMax };
    }

    // Fetch ALL potential meetups that match the non-location criteria
    const potentialMeetups = await prisma.meetup.findMany({
        where: whereClause,
        include: { user: { select: { id: true, name: true, profilePhoto: true, dateOfBirth: true } } },
    });

    // Define the user's location for distance calculation
    const userLocation = { latitude: userLat, longitude: userLon };

    // Calculate distance for each meetup and filter by radius
    const meetupsWithDistance = potentialMeetups.map(meetup => {
        const meetupLocation = { latitude: meetup.latitude, longitude: meetup.longitude };
        const distanceMeters = haversine(userLocation, meetupLocation);
        const distanceKm = distanceMeters / 1000;
        return { ...meetup, distanceKm };
    }).filter(meetup => {
        if (radiusKm === 'more_than_10') {
            return meetup.distanceKm > 10;
        }
        return meetup.distanceKm <= parseInt(radiusKm);
    });

    // Sort the final list by distance (closest first)
    meetupsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    
    // Process and return the results
    return meetupsWithDistance.map((match) => ({
        ...match,
        user: {
            ...match.user,
            age: calculateAge(match.user.dateOfBirth),
            dateOfBirth: undefined,
        },
    }));
};