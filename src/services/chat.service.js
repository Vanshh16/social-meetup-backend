import prisma from "../config/db.js";

/**
 * Saves a new message to the database.
 * @param {string} chatId - The ID of the chat room.
 * @param {string} senderId - The ID of the user sending the message.
 * @param {string} content - The message content.
 * @returns {Promise<object>} The newly created message object with sender details.
 */
export const saveMessage = async (chatId, senderId, content) => {
  try {
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
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