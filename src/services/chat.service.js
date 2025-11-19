import prisma from "../config/db.js";
import AppError from "../utils/appError.js";


/**
 * Creates a new message and saves it to the database.
 * @param {string} chatId - The ID of the chat.
 * @param {string} senderId - The ID of the user sending the message.
 * @param {string} content - The message content.
 * @returns {Promise<object>} The newly created message object with sender details.
 */
export const saveMessage = async (chatId, senderId, content, type = "TEXT") => {

  if (!chatId || !senderId || !content) {
    throw new AppError("chatId, senderId, and content are required.", 400);
  }
  
  try {
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        content, // This will be the text OR the image URL
        type,    // Save the type (TEXT or IMAGE)
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        chatId: true,
        type: true,
        sender: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    return message;
  } catch (error) {
    console.error("Failed to save message:", error);
    throw new Error("Failed to save message.");
  }
};

/**
 * Creates the appropriate chat (one-on-one or group) for a meetup
 * when a join request is accepted.
 * @param {string} meetupId - The ID of the meetup.
 * @param {string} creatorId - The ID of the meetup creator.
 * @param {string} joinerId - The ID of the user who joined.
 */
export const createChatForMeetup = async (meetupId, creatorId, joinerId) => {
    const meetup = await prisma.meetup.findUnique({
        where: { id: meetupId },
        select: { groupSize: true, locationName: true, category: true }
    });

    const isGroupChat = meetup.groupSize > 1;

    // Check if a chat for this meetup already exists
    let chat = await prisma.chat.findUnique({
        where: { meetupId }
    });

    if (chat) {
        // If it's a group chat and the joiner isn't already in it, add them.
        if (isGroupChat) {
            await prisma.chat.update({
                where: { id: chat.id },
                data: { users: { connect: { id: joinerId } } }
            });
        }
    } else {
        // Create a new chat if it doesn't exist
        chat = await prisma.chat.create({
            data: {
                meetupId: meetupId,
                type: isGroupChat ? 'GROUP' : 'ONE_ON_ONE',
                name: isGroupChat ? `Group for: ${meetup.category} (${meetup.locationName})` : null,
                users: {
                    connect: [{ id: creatorId }, { id: joinerId }]
                }
            }
        });
    }
    return chat;
};

/**
 * Fetches all chats for a given user.
 * @param {string} userId - The ID of the logged-in user.
 */
export const getUserChats = async (userId) => {
    return prisma.chat.findMany({
        where: { users: { some: { id: userId } } },
        include: {
            users: { select: { id: true, name: true, profilePhoto: true } },
            messages: { // Get the last message for a preview
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};

/**
 * Fetches the message history for a specific chat room.
 * @param {string} chatId - The ID of the chat.
 * @param {string} userId - The ID of the user requesting the history (for auth).
 */
export const getChatMessages = async (chatId, userId) => {
    const chat = await prisma.chat.findFirst({
        where: { id: chatId, users: { some: { id: userId } } }
    });

    if (!chat) {
        throw new AppError("Chat not found or you are not a member.", 404);
    }

    return prisma.message.findMany({
        where: { chatId },
        include: { sender: { select: { id: true, name: true, profilePhoto: true } } },
        orderBy: { createdAt: 'asc' }
    });
};