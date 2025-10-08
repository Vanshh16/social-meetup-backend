import prisma from "../config/db.js";
import { io } from "../socket/socketHandler.js";
import AppError from "../utils/appError.js";
import { calculateAge } from "../utils/helper.js";
import { createChatForMeetup } from "./chat.service.js";

export const createJoinRequest = async (meetupId, senderId) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) throw new AppError("Meetup not found", 404);

  if (meetup.createdBy === senderId) {
    throw new AppError("You cannot join your own meetup", 400);
  }

  const existing = await prisma.joinRequest.findFirst({
    where: { meetupId, senderId },
  });
  if (existing)
    throw new AppError("Already requested to join this meetup", 400);

  const newRequest = await prisma.joinRequest.create({
    data: { meetupId, senderId },
    include: {
      sender: { select: { name: true, profilePhoto: true } },
    },
  });

  // --- EMIT NOTIFICATION TO MEETUP CREATOR ---
  if (io) {
    const eventName = "new_join_request";
    const payload = {
      message: `${newRequest.sender.name} wants to join your meetup!`,
      request: newRequest,
    };
    // Emit to the room named after the meetup creator's ID
    io.to(meetup.createdBy).emit(eventName, payload);
  }

  return newRequest;
};

export const getMeetupRequests = async (meetupId, userId) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) throw new AppError("Meetup not found", 404);
  if (meetup.createdBy !== userId) throw new AppError("Unauthorized", 403);

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
  return requests.map((request) => {
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
    include: {
      meetup: true,
      sender: { select: { id: true, name: true } },
    },
  });
  if (!request) throw new AppError("Request not found", 404);

  if (request.meetup.createdBy !== userId) {
    throw new AppError("Unauthorized", 403);
  }

  let status;
  if (action === "accept") status = "ACCEPTED";
  else if (action === "reject") status = "REJECTED";
  else throw new AppError("Invalid action", 400);

  const updatedRequest = await prisma.joinRequest.update({
    where: { id: requestId },
    data: { status },
  });

  if (status === "ACCEPTED") {
    // --- TRIGGER CHAT CREATION ---
    await createChatForMeetup(request.meetupId, request.meetup.createdBy, request.senderId);
  }
  
  // --- EMIT NOTIFICATION TO THE REQUEST SENDER ---
  if (io) {
    const eventName = "join_request_update";
    const payload = {
      message: `Your request to join the meetup has been ${status.toLowerCase()}.`,
      request: updatedRequest,
    };
    // Emit to the room named after the sender's ID
    io.to(request.senderId).emit(eventName, payload);
  }

  return updatedRequest;
};
