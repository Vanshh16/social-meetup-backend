import prisma from "../config/db.js";
import { calculateAge } from "../utils/helper.js";

export const createJoinRequest = async (meetupId, senderId) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) throw new Error('Meetup not found');

  if (meetup.createdBy === senderId) {
    throw new Error('You cannot join your own meetup');
  }

  const existing = await prisma.joinRequest.findFirst({ where: { meetupId, senderId } });
  if (existing) throw new Error('Already requested to join this meetup');

  return prisma.joinRequest.create({
    data: { meetupId, senderId },
  });
};

export const getMeetupRequests = async (meetupId, userId) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) throw new Error('Meetup not found');
  if (meetup.createdBy !== userId) throw new Error('Unauthorized');

  const requests = await prisma.joinRequest.findMany({
    where: { meetupId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          gender: true,
          dateOfBirth: true, // Fetch dateOfBirth instead of age
          city: true,
          profilePhoto: true,
        },
      },
    },
  });

  // Manually calculate age and transform the response
  return requests.map(request => {
    const { dateOfBirth, ...sender } = request.sender;
    return {
      ...request,
      sender: {
        ...sender,
        age: calculateAge(dateOfBirth),
      },
    };
  });
};

export const respondToRequest = async (requestId, userId, action) => {
  const request = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: { meetup: true },
  });
  if (!request) throw new Error('Request not found');

  if (request.meetup.createdBy !== userId) {
    throw new Error('Unauthorized');
  }

  let status;
  if (action === 'accept') status = 'ACCEPTED';
  else if (action === 'reject') status = 'REJECTED';
  else throw new Error('Invalid action');

  return prisma.joinRequest.update({
    where: { id: requestId },
    data: { status },
  });
};