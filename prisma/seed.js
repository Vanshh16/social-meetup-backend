// import { PrismaClient } from '@prisma/client';
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import prisma from "../src/config/db.js";

// Helper function to generate a referral code
const generateReferralCode = (name) => {
  const namePart = name.split(' ')[0].toUpperCase().substring(0, 5);
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePart}${randomPart}`;
};

async function main() {
  console.log('🌱 Starting to seed the database...');

  // 1. Clean up existing data in the correct order to avoid constraint violations
  console.log('🗑️  Cleaning up the database...');
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.joinRequest.deleteMany();
  await prisma.meetup.deleteMany();
  await prisma.subCategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.userWallet.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.userReport.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed App Settings
  console.log('⚙️  Seeding app settings...');
  await prisma.appSettings.create({
    data: {
      key: 'REFERRAL_REWARD_AMOUNT',
      value: '10', // Stored as a string
    },
  });
  await prisma.appSettings.create({
    data: {
      key: 'MEETUP_SEARCH_RADIUS_KM',
      value: '25',
    },
  });

  // 3. Seed Categories and Subcategories
  console.log('📚 Seeding categories and subcategories...');
  const categoriesData = [
    { name: 'Food & Drink', subcategories: ['Coffee', 'Dinner', 'Brunch', 'Bar Hopping'] },
    { name: 'Sports & Fitness', subcategories: ['Running', 'Yoga', 'Gym', 'Tennis'] },
    { name: 'Arts & Culture', subcategories: ['Museum', 'Concert', 'Theater', 'Art Gallery'] },
    { name: 'Outdoors & Adventure', subcategories: ['Hiking', 'Camping', 'Beach Day', 'Cycling'] },
  ];

  for (const cat of categoriesData) {
    await prisma.category.create({
      data: {
        name: cat.name,
        subcategories: {
          create: cat.subcategories.map(sub => ({ name: sub })),
        },
      },
    });
  }

  // 4. Seed Users
  console.log('👤 Seeding users...');
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create a main user to be the first referrer
  const mainUser = await prisma.user.create({
    data: {
      name: 'Alice Smith',
      email: 'alice@example.com',
      mobileNumber: '9999999999',
      password: hashedPassword,
      isVerified: true,
      gender: 'FEMALE',
      dateOfBirth: faker.date.birthdate({ min: 25, max: 35, mode: 'age' }),
      city: 'Lucknow',
      referralCode: generateReferralCode('Alice'),
    },
  });
  users.push(mainUser);

  // Create 10 other users, some referred by Alice
  for (let i = 0; i < 10; i++) {
    const name = faker.person.fullName();
    const user = await prisma.user.create({
      data: {
        name,
        email: faker.internet.email().toLowerCase(),
        mobileNumber: faker.phone.number('9#########'),
        password: hashedPassword,
        isVerified: true,
        gender: faker.helpers.arrayElement(['MALE', 'FEMALE']),
        dateOfBirth: faker.date.birthdate({ min: 18, max: 40, mode: 'age' }),
        city: faker.location.city(),
        bio: faker.lorem.sentence(),
        hobbies: faker.helpers.arrayElements(['Reading', 'Traveling', 'Cooking', 'Gaming', 'Music'], 3),
        referralCode: generateReferralCode(name),
        // First 3 users are referred by Alice
        referredById: i < 3 ? mainUser.id : null,
      },
    });
    users.push(user);
  }

  // Create an Admin User
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      mobileNumber: '9876543210',
      password: hashedPassword,
      isVerified: true,
      role: 'ADMIN',
      referralCode: generateReferralCode('Admin'),
    },
  });
  users.push(adminUser);
  console.log(`Created ${users.length} users in total.`);

  // 5. Seed Wallets for each user
  console.log('💰 Seeding user wallets...');
  for (const user of users) {
    await prisma.userWallet.create({
      data: {
        userId: user.id,
        balance: parseFloat(faker.finance.amount({ min: 0, max: 100, dec: 2 })),
      },
    });
  }
  console.log('Created wallets for all users.');

  // 6. Seed a full interaction scenario
  console.log('💬 Seeding a full user interaction scenario...');
  const meetupCreator = users[0]; // Alice
  const joiner = users[1];
  const anotherUser = users[2];

  // a. Create a Meetup
  const meetup = await prisma.meetup.create({
    data: {
      createdBy: meetupCreator.id,
      category: 'Food & Drink',
      subcategory: 'Coffee',
      location: 'Hazratganj, Lucknow',
      type: 'planned',
      date: faker.date.future(),
      time: '18:00',
      preferredAgeMin: 20,
      preferredAgeMax: 35,
      preferredGender: 'any',
      groupSize: 2,
    },
  });

  // b. Create an accepted Join Request
  const joinRequest = await prisma.joinRequest.create({
    data: {
      meetupId: meetup.id,
      senderId: joiner.id,
      status: 'ACCEPTED',
    },
  });

  // c. Create a successful Payment using Cashfree fields
  await prisma.payment.create({
    data: {
      joinRequestId: joinRequest.id,
      meetupId: meetup.id,
      purpose: 'JOIN_REQUEST',
      amount: 10000, // in paise
      status: 'SUCCESS',
      cashfreeOrderId: `order_${faker.string.alphanumeric(14)}`,
      paymentSessionId: `session_${faker.string.alphanumeric(20)}`,
    },
  });

  // d. Create a Chat room
  const chat = await prisma.chat.create({
    data: {
      meetupId: meetup.id,
      users: {
        connect: [{ id: meetupCreator.id }, { id: joiner.id }],
      },
    },
  });

  // e. Seed Messages
  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: joiner.id,
      content: 'Hey! Looking forward to the meetup.',
    },
  });

  // 7. Seed a User Report and a Block
  console.log('🛡️  Seeding a report and a block...');
  await prisma.userReport.create({
    data: {
      reporterId: anotherUser.id,
      reportedId: users[4].id,
      reason: 'SPAM',
      details: 'This user sent unsolicited messages.',
    },
  });

  await prisma.userBlock.create({
    data: {
      blockerId: meetupCreator.id,
      blockedId: users[5].id,
    },
  });

  console.log('✅ Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
