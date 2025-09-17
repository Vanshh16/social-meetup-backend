import prisma from "../config/db.js";
import { calculateAge } from "../utils/helper.js";

export const findMatchesForUser = async (userId) => {
  const userMeetup = await prisma.meetup.findFirst({
    where: { createdBy: userId },
    orderBy: { createdAt: "desc" },
  });

  if (!userMeetup) {
    throw new Error("You must create a meet-up request to find matches.");
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