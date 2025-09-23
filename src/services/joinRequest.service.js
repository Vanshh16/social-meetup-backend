import prisma from "../config/db.js";
import { io } from "../socket/socketHandler.js";
import { calculateAge } from "../utils/helper.js";

export const createJoinRequest = async (meetupId, senderId) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) throw new Error('Meetup not found');

  if (meetup.createdBy === senderId) {
    throw new Error('You cannot join your own meetup');
  }

  const existing = await prisma.joinRequest.findFirst({ where: { meetupId, senderId } });
  if (existing) throw new Error('Already requested to join this meetup');

  const newRequest = await prisma.joinRequest.create({
    data: { meetupId, senderId },
    include: {
        sender: { select: { name: true, profilePhoto: true } }
    }
  });

   // --- EMIT NOTIFICATION TO MEETUP CREATOR ---
  if (io) {
    const eventName = 'new_join_request'; 
    const payload = {
        message: `${newRequest.sender.name} wants to join your meetup!`,
        request: newRequest
    };
    // Emit to the room named after the meetup creator's ID
    io.to(meetup.createdBy).emit(eventName, payload);
  } 

  return newRequest;
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

  const updatedRequest = await prisma.joinRequest.update({
    where: { id: requestId },
    data: { status },
  });

  // --- EMIT NOTIFICATION TO THE REQUEST SENDER ---
  if (io) {
    const eventName = 'join_request_update';
    const payload = {
        message: `Your request to join the meetup has been ${status.toLowerCase()}.`,
        request: updatedRequest
    };
    // Emit to the room named after the sender's ID
    io.to(request.senderId).emit(eventName, payload);
  }

  return updatedRequest;
};