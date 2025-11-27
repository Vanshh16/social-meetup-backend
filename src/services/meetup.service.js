// import { Cashfree } from 'cashfree-pg';
import prisma from '../config/db.js';
import AppError from '../utils/appError.js';
import { debitUserWallet } from './wallet.service.js';

/**
 * Create a new meetup
 */
export const createMeetup = async (userId, data) => {
  return await prisma.meetup.create({
    data: {
      createdBy: userId, // Correct field name
      category: data.category,
      subcategory: data.subcategory,
      location: data.location, // Field name from schema
      type: data.type,
      date: new Date(data.date),
      time: data.time,
      preferredAgeMin: data.preferredAgeMin, // Field name from schema
      preferredAgeMax: data.preferredAgeMax, // Field name from schema
      preferredGender: data.preferredGender,
      preferredReligion: data.religion, // Field name from schema
      groupSize: data.groupSize,
      distanceRangeKm: data.distanceRange, // Field name from schema
    }
  });
};

// "Meetups I'm Hosting" API
/**
 * Get all meetups created by a specific user
 * @param {string} userId - The ID of the user.
 */
export const getUserMeetups = async (userId) => {
  return prisma.meetup.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: "desc" },
    include: {
        _count: { // Include how many people have joined
            select: { JoinRequest: { where: { status: 'ACCEPTED' } } }
        }
    }
  });
};

// "Meetups I'm Attending" API
/**
 * Fetches all meetups a user has been accepted into.
 * @param {string} userId - The ID of the user.
 */
export const getJoinedMeetups = async (userId) => {
  return prisma.meetup.findMany({
    where: {
      // Find meetups that have at least one JoinRequest
      JoinRequest: {
        some: {
          senderId: userId,
          status: 'ACCEPTED'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: { // Include the host's info
        select: { id: true, name: true, profilePhoto: true }
      }
    }
  });
};

const verifyCashfreePayment = async (orderId) => {
    try {
        const response = await Cashfree.PGOrderFetchPayments("2022-09-01", orderId);
        const payment = response.data[0];
        return payment && payment.payment_status === 'SUCCESS';
    } catch (error) {
        return false;
    }
};

/**
 * Verify payment and create meetup in a transaction
 */
export const verifyPaymentAndCreateMeetup = async (userId, meetupData, paymentDetails) => {
    const { order_id } = paymentDetails;

    // const isVerified = await verifyCashfreePayment(order_id);
    // if (!isVerified) throw new AppError("Payment verification failed.", 400);

    const subCatRecord = await prisma.subCategory.findFirst({
        where: {
            name: meetupData.subCategory,
            category: { name: meetupData.category }
        },
        select: { price: true }
    });

    if (!subCatRecord) {
        throw new AppError("Selected sub-category not found.", 404);
    }
    const meetupPrice = subCatRecord.price;

    if (!meetupData.latitude || !meetupData.longitude) {
    throw new AppError("Latitude and longitude are required to create a meetup.", 400);
  }

  return prisma.$transaction(async (tx) => {

    // const payment = await tx.payment.update({
        //     where: { cashfreeOrderId: order_id },
        //     data: { status: 'SUCCESS' }
        // });

        // 2. Debit the creator's wallet
        if (meetupPrice > 0) {
            try {
                await debitUserWallet(
                    userId, 
                    meetupPrice, 
                    `Fee for creating meetup: ${meetupData.subCategory}`, 
                    tx
                );
            } catch (error) {
                if (error.message.includes('Insufficient wallet balance')) {
                    throw new AppError(`Insufficient balance. Required: ${meetupPrice}`, 400);
                }
                throw error;
            }
        }

        // 3. Create the meetup
        const meetup = await tx.meetup.create({
            data: {
                createdBy: userId,
                ...meetupData 
            }
        });

        return meetup;
    });
};

/**
 * Fetch full details of a single meetup
 */
export const fetchMeetupDetails = async (meetupId, userId) => {
  // Logic to get full details of a single meetup
  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    include: {
      user: { // The creator's public profile
        select: { id: true, name: true, profilePhoto: true, bio: true }
      },
      JoinRequest: { // All accepted participants
        where: { status: 'ACCEPTED' },
        select: {
          sender: {
            select: { id: true, name: true, profilePhoto: true }
          }
        }
      }
    }
  });

  if (!meetup) throw new AppError("Meetup not found.", 404);

  return meetup;
};

/**
 * Fetch history of meetups a user created or joined
 */
export const fetchMeetupHistory = async (userId) => {
  // Fetch meetups created by the user OR meetups they have an accepted request for
  return prisma.meetup.findMany({
    where: {
      OR: [
        { createdBy: userId },
        { JoinRequest: { some: { senderId: userId, status: 'ACCEPTED' } } }
      ]
    },
    include: {
      user: { // Creator's info
        select: { id: true, name: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};


/**
 * Update meetup (only creator can update)
 */
export const updateMeetup = async (meetupId, userId, updateData) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });

  // Authorization check: Only the creator can edit
  if (!meetup || meetup.createdBy !== userId) {
    throw new AppError("Meetup not found or you are not authorized to edit it.", 403);
  }

  return prisma.meetup.update({
    where: { id: meetupId },
    data: updateData, // e.g., { location: 'New Place', time: '20:00' }
  });
};

/**
 * Delete meetup and related entities (only creator can delete)
 */
export const deleteMeetup = async (meetupId, userId) => {
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });

  // Authorization check: Only the creator can delete
  if (!meetup || meetup.createdBy !== userId) {
    throw new AppError('Meetup not found or you are not authorized to delete it.', 403);
  }

  // Use a transaction to delete the meetup and all related join requests
  return prisma.$transaction(async (tx) => {
    await tx.joinRequest.deleteMany({
      where: { meetupId: meetupId },
    });
    // Add deletion for payments and chats if they are directly linked and need cleanup
    await tx.payment.deleteMany({
        where: { meetupId: meetupId },
    });
    await tx.chat.deleteMany({
        where: { meetupId: meetupId },
    });
    await tx.meetup.delete({
      where: { id: meetupId },
    });
  });
};
