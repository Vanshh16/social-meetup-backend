import { faker } from '@faker-js/faker';
import prisma from "../src/config/db.js";

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

    // 3. Seed NEW Categories and Subcategories
    console.log('📚 Seeding new categories and subcategories...');
    const categoriesData = [
        { name: "Food & Beverage Meetups", subcategories: ["Tea", "Coffee", "Soft Drink", "Pizza", "Fast Food", "Lunch (Veg)", "Dinner (Non-Veg)"] },
        { name: "Social Hangouts & Gupshup", subcategories: ["Kitty Party", "Gupshup", "Chugli", "Club", "Pub", "Hangout"] },
        { name: "Walks & Nature", subcategories: ["Morning Walk", "Evening Walk", "Park", "Marine Drive"] },
        { name: "Travel & Adventure", subcategories: ["Long Drive", "Water Park", "Beach", "Vacation", "Outdoor Trip"] },
        { name: "Entertainment", subcategories: ["Movie", "Amusement Park", "Music Concert", "Carnival / Fair"] },
        { name: "Lifestyle & Personal Interests", subcategories: ["Shopping", "Gym Buddy", "Cafe Explore", "Photo Shoot"] },
        { name: "Spiritual & Faith Meetups", subcategories: ["Temple", "Church", "Gurudwara", "Masjid", "Dargah"] },
        { name: "Spiritual Gathering", subcategories: ["Bhajan Sandhya", "Satsang", "Kirtan"] },
        { name: "Sports & Active Buddies", subcategories: ["Cricket", "Hockey", "Volleyball", "Chess", "Carromboard", "Ludo"] },
        { name: "Learning & Educational Companions", subcategories: ["Group Education Discussion", "Study Together", "Politics Discussion", "Book Reading"] }
    ];

    for (const cat of categoriesData) {
        await prisma.category.create({
            data: {
                name: cat.name,
                subcategories: { create: cat.subcategories.map(sub => ({ name: sub })) },
            },
        });
    }

    // 4. Seed Users
    console.log('👤 Seeding users...');
    const users = [];

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
            pictures: [],
        },
    });
    users.push(adminUser);

    for (let i = 0; i < 20; i++) {
        const name = faker.person.fullName();
        const mobileNumber = faker.phone.number('9#########');
        users.push(await prisma.user.create({
            data: {
                name,
                email: faker.internet.email().toLowerCase(),
                mobileNumber,
                isVerified: true,
                authMethod: i % 2 === 0 ? 'GOOGLE' : 'MOBILE_OTP',
                googleId: i % 2 === 0 ? `google_id_${faker.string.uuid()}` : null,
                profilePhoto: faker.image.avatar(),
                city: 'Lucknow',
                referralCode: generateReferralCode(name),
                pictures: [faker.image.url(), faker.image.url()],
            },
        }));
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

    // 6. Seed Meetups
    console.log('🎉 Seeding meetups...');
    const meetups = [];
    for (let i = 0; i < 15; i++) {
        const creator = users[i + 1];
        const randomCategory = faker.helpers.arrayElement(categoriesData);
        meetups.push(await prisma.meetup.create({
            data: {
                createdBy: creator.id,
                category: randomCategory.name,
                subcategory: faker.helpers.arrayElement(randomCategory.subcategories),
                location: 'Lucknow, Uttar Pradesh',
                type: 'planned',
                date: faker.date.future(),
                time: '19:00',
                groupSize: faker.number.int({ min: 2, max: 5 }),
            },
        }));
    }
    console.log(`Created ${meetups.length} meetups.`);
    
    // 7. Seed Interactions (Join Requests, Payments, Chats for 10 meetups)
    console.log('💬 Seeding full user interaction scenarios...');
    for (let i = 0; i < 10; i++) {
        const meetup = meetups[i];
        const joiner = users[i + 11]; // Use different users to join

        const joinRequest = await prisma.joinRequest.create({
            data: { meetupId: meetup.id, senderId: joiner.id, status: 'ACCEPTED' },
        });

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

        const chat = await prisma.chat.create({
            data: {
                meetupId: meetup.id,
                users: { connect: [{ id: meetup.createdBy }, { id: joiner.id }] },
            },
        });

        await prisma.message.create({
            data: {
                chatId: chat.id,
                senderId: joiner.id,
                content: faker.lorem.sentence(),
            },
        });
    }
    console.log('Created 10 full interaction scenarios.');

    // 8. Seed Reports and Blocks (minimum 10 of each)
    console.log('🛡️  Seeding reports and blocks...');
    for (let i = 0; i < 10; i++) {
        const reporter = users[i + 1];
        const reported = users[i + 11];
        await prisma.userReport.create({
            data: { reporterId: reporter.id, reportedId: reported.id, reason: 'SPAM' },
        });

        const blocker = users[i + 11];
        const blocked = users[i + 1];
        await prisma.userBlock.create({
            data: { blockerId: blocker.id, blockedId: blocked.id },
        });
    }
    console.log('Created 10 reports and 10 blocks.');

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
