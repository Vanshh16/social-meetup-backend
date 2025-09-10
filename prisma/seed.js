import { faker } from '@faker-js/faker';
import prisma from "../src/config/db.js";

// Helper function to generate a referral code
const generateReferralCode = (name) => {
  const namePart = name.split(' ')[0].toUpperCase().substring(0, 5);
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePart}${randomPart}`;
};

async function main() {
  console.log('🌱 Starting to seed the database...');

  // 1. Clean up existing data
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
    data: { key: 'REFERRAL_REWARD_AMOUNT', value: '10' },
  });

  // 3. Seed Categories
  console.log('📚 Seeding categories...');
  const categoriesData = [
    { name: 'Food & Drink', subcategories: ['Coffee', 'Dinner', 'Brunch'] },
    { name: 'Sports & Fitness', subcategories: ['Running', 'Gym', 'Tennis'] },
    { name: 'Outdoors & Adventure', subcategories: ['Hiking', 'Beach Day'] },
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

  // Create an Admin User
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      mobileNumber: '9876543210',
      isVerified: true,
      role: 'ADMIN',
      authMethod: 'GOOGLE',
      googleId: 'admin_google_id_123',
      referralCode: generateReferralCode('Admin'),
    },
  });
  users.push(adminUser);

  // Create 5 Google-authenticated users
  for (let i = 0; i < 5; i++) {
    const name = faker.person.fullName();
    const user = await prisma.user.create({
      data: {
        name,
        email: faker.internet.email().toLowerCase(),
        mobileNumber: faker.phone.number('9#########'),
        isVerified: true,
        authMethod: 'GOOGLE',
        googleId: `google_id_${faker.string.uuid()}`,
        profilePhoto: faker.image.avatar(),
        city: faker.location.city(),
        referralCode: generateReferralCode(name),
      },
    });
    users.push(user);
  }

  // Create 5 OTP-authenticated users
  for (let i = 0; i < 5; i++) {
    const mobileNumber = faker.phone.number('9#########');
    const name = faker.person.fullName();
    const user = await prisma.user.create({
      data: {
        name,
        email: `${mobileNumber}@temp-email.com`,
        mobileNumber: mobileNumber,
        isVerified: true,
        authMethod: 'MOBILE_OTP',
        city: faker.location.city(),
        referralCode: generateReferralCode(name),
      },
    });
    users.push(user);
  }
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

  // 6. Seed a full interaction scenario
  console.log('💬 Seeding a full user interaction scenario...');
  const meetupCreator = users[1]; // A Google user
  const joiner = users[6];       // An OTP user

  // a. Create a Meetup
  const meetup = await prisma.meetup.create({
    data: {
      createdBy: meetupCreator.id,
      category: 'Food & Drink',
      subcategory: 'Coffee',
      location: 'Ranpur, Rajasthan',
      type: 'planned',
      date: faker.date.future(),
      time: '18:00',
      groupSize: 2
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

  // c. Create a successful Payment
  await prisma.payment.create({
    data: {
      joinRequestId: joinRequest.id,
      meetupId: meetup.id,
      purpose: 'JOIN_REQUEST',
      amount: 10000,
      status: 'SUCCESS',
      cashfreeOrderId: `order_${faker.string.alphanumeric(14)}`,
    },
  });

  // d. Create a Chat room
  const chat = await prisma.chat.create({
    data: {
      meetupId: meetup.id,
      users: { connect: [{ id: meetupCreator.id }, { id: joiner.id }] },
    },
  });

  // e. Seed Messages
  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: joiner.id,
      content: 'Hey! Looking forward to meeting up.',
    },
  });

  // 7. Seed a User Report and a Block
  console.log('🛡️  Seeding a report and a block...');
  await prisma.userReport.create({
    data: {
      reporterId: users[2].id,
      reportedId: users[7].id,
      reason: 'SPAM',
    },
  });

  await prisma.userBlock.create({
    data: {
      blockerId: meetupCreator.id,
      blockedId: users[8].id,
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
