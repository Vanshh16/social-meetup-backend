import prisma from "../config/db.js";
import { io } from "../socket/socketHandler.js";
import AppError from "../utils/appError.js";
import { calculateAge } from "../utils/helper.js";
import { createChatForMeetup } from "./chat.service.js";
import { createNotification } from "./notification.service.js";
import { debitUserWallet } from "./wallet.service.js";

// Helper to get price by SubCategory name + Category name
const getSubCategoryPrice = async (categoryName, subCategoryName) => {
  if (!categoryName || !subCategoryName) return 0;
  
  const subCat = await prisma.subCategory.findFirst({
    where: {
        name: subCategoryName,
        category: { name: categoryName }
    },
    select: { price: true }
  });
  
  return subCat?.price || 0;
};

export const createJoinRequest = async (meetupId, senderId) => {
  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { 
      id: true, 
      createdBy: true, 
      category: true,
      subcategory: true
    }
  });
  if (!meetup) throw new AppError("Meetup not found", 404);

  if (meetup.createdBy === senderId) {
    throw new AppError("You cannot join your own meetup", 400);
  }

  const existing = await prisma.joinRequest.findFirst({
    where: { meetupId, senderId },
  });
  if (existing)
    throw new AppError("Already requested to join this meetup", 400);

  // --- Balance Check ---
  // const joinPrice = meetup.category?.price ?? 0;

  const joinPrice = await getSubCategoryPrice(meetup.category, meetup.subcategory);

  if (joinPrice > 0) {
    // 2. Fetch sender's wallet balance
    const wallet = await prisma.userWallet.findUnique({
      where: { userId: senderId },
      select: { balance: true },
    });

    // 3. Compare balance
    if (!wallet || wallet.balance < joinPrice) {
      throw new AppError(
        `Insufficient wallet balance to send request. Required: ${joinPrice}`,
        400
      );
    }
  }

  const newRequest = await prisma.joinRequest.create({
    data: { meetupId, senderId, status: "PENDING" },
    include: {
      sender: { select: { name: true, profilePhoto: true } },
    },
  });

  // --- NEW: Trigger Notification ---
  try {
    await createNotification({
      userId: meetup.createdBy, // The host receives this
      type: 'joinRequest',
      title: 'New Join Request',
      subtitle: `${newRequest.sender.name} wants to join your meetup.`,
      senderName: newRequest.sender.name,
      profileImage: newRequest.sender.profilePhoto,
      data: { meetupId: meetupId, requestId: newRequest.id }
    });
  } catch (err) { console.error('Failed to create join request notification:', err); }
  
  // --- EMIT NOTIFICATION TO MEETUP CREATOR ---
  // if (io) {
  //   const eventName = "new_join_request";
  //   const payload = {
  //     message: `${newRequest.sender.name} wants to join your meetup!`,
  //     request: newRequest,
  //   };
  //   // Emit to the room named after the meetup creator's ID
  //   io.to(meetup.createdBy).emit(eventName, payload);
  // }

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

  // To fix typescript error (Optional)
  /** @type {import('@prisma/client').Prisma.JoinRequestGetPayload<{include: {meetup: {select: {id: true, createdBy: true, category: {select: {price: true, name: true}}}}, sender: {select: {id: true, name: true}}}}>} */
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

  if (request.status !== "PENDING")
    throw new AppError(`Request already ${request.status.toLowerCase()}`, 400);

  if (action === "accept") {
    const joinPrice = await getSubCategoryPrice(request.meetup.category, request.meetup.subcategory);
    
    return prisma.$transaction(async (tx) => {
      // 1. Debit the JOINER's wallet (This happens *now*)
      if (joinPrice > 0) {
        try {
          // Use the debit function, passing the transaction client 'tx'
          await debitUserWallet(
            request.senderId,
            joinPrice,
            `Fee for joining meetup: ${request.meetup.subcategory}`,
            tx
          );
        } catch (error) {
          // Even though we checked earlier, double-check in case balance changed
          if (error.message.includes("Insufficient wallet balance")) {
            throw new AppError(
              `Joiner no longer has sufficient balance. Required: ${joinPrice}`,
              400
            );
          }
          throw error; // Re-throw other errors
        }
      }

      // 2. Update the request status
      const updatedRequest = await tx.joinRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      // 3. Create the chat
      await createChatForMeetup(
        request.meetupId,
        request.meetup.createdBy,
        request.senderId,
        tx
      );

      // --- NEW: Trigger Notification ---
      try {
        await createNotification({
          userId: request.senderId, // The joiner receives this
          type: 'joinRequest',
          title: 'Request Accepted',
          subtitle: `Your request to join the meetup has been accepted!`,
          data: { meetupId: request.meetupId, request: updatedRequest  }
        });
      } catch (err) { console.error('Failed to create accept notification:', err); }

      // 4. Emit socket notification
      // if (io) {
      //   const eventName = "join_request_update";
      //   const payload = {
      //     message: `Your request to join the meetup has been accepted`,
      //     request: updatedRequest,
      //   };
      //   // Emit to the room named after the sender's ID
      //   io.to(request.senderId).emit(eventName, payload);
      // }

      return updatedRequest;
    });
  } else if (action === "reject") {
    const updatedRequest = await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });


    try {
      await createNotification({
        userId: request.senderId, // The joiner receives this
        type: 'joinRequest',
        title: 'Request Rejected',
        subtitle: `Your request to join the meetup was rejected.`,
        data: { meetupId: request.meetupId }
      });
    } catch (err) { console.error('Failed to create reject notification:', err); }

    // Emit socket notification for rejection
    // if (io) {
    //   const eventName = "join_request_update";
    //   const payload = {
    //     message: `Your request to join the meetup has been rejected`,
    //     request: updatedRequest,
    //   };
    //   // Emit to the room named after the sender's ID
    //   io.to(request.senderId).emit(eventName, payload);
    // }
    
    return updatedRequest;
  } else {
    throw new AppError("Invalid action", 400);
  }
};
