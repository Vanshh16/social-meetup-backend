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
