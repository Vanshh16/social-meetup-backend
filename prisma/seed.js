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
    await prisma.banner.deleteMany();
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
    console.log('📚 Seeding new categories and subcategories...');
    const categoriesData = [
        { name: "Food & Beverage Meetups", subcategories: ["Tea", "Coffee", "Soft Drink", "Pizza", "Fast Food", "Lunch (Veg)", "Dinner (Non-Veg)"] },
        { name: "Social Hangouts & Gupshup", subcategories: ["Kitty Party", "Gupshup", "Chugli", "Club", "Pub", "Hangout"] },
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
            name: 'Admin User', email: 'admin@example.com', mobileNumber: '9876543210', isVerified: true, role: 'ADMIN', authMethod: 'GOOGLE', googleId: 'admin_google_id_123', referralCode: generateReferralCode('Admin'), pictures: [], fcmTokens: []
        },
    });
    users.push(adminUser);

    for (let i = 0; i < 20; i++) {
        const name = faker.person.fullName();
        users.push(await prisma.user.create({
            data: {
                name, email: faker.internet.email().toLowerCase(), mobileNumber: faker.phone.number('9#########'), isVerified: true, authMethod: i % 2 === 0 ? 'GOOGLE' : 'MOBILE_OTP', googleId: i % 2 === 0 ? `google_id_${faker.string.uuid()}` : null, profilePhoto: faker.image.avatar(), city: 'Lucknow', referralCode: generateReferralCode(name), pictures: [faker.image.url()], fcmTokens: [`fake_fcm_token_${i}`]
            },
        }));
    }
    console.log(`Created ${users.length} users in total.`);

    // 5. Seed Wallets
    console.log('💰 Seeding user wallets...');
    for (const user of users) {
        await prisma.userWallet.create({
            data: { userId: user.id, balance: parseFloat(faker.finance.amount({ min: 0, max: 100, dec: 2 })) },
        });
    }

    // 6. Seed Meetups
    console.log('🎉 Seeding meetups...');
    const meetups = [];
    const baseLat = 26.8467;
    const baseLon = 80.9462;
    for (let i = 0; i < 15; i++) {
        const creator = users[i + 1];
        const randomCategory = faker.helpers.arrayElement(categoriesData);
        meetups.push(await prisma.meetup.create({
            data: {
                createdBy: creator.id, category: randomCategory.name, subcategory: faker.helpers.arrayElement(randomCategory.subcategories), locationName: `A spot in ${faker.location.street()}`, latitude: faker.location.latitude({ min: baseLat - 0.1, max: baseLat + 0.1 }), longitude: faker.location.longitude({ min: baseLon - 0.1, max: baseLon + 0.1 }), type: 'planned', date: faker.date.future(), time: '19:00', groupSize: faker.number.int({ min: 1, max: 5 }), // Include groupSize 1 for one-on-one chats
            },
        }));
    }
    console.log(`Created ${meetups.length} meetups.`);
    
    // 7. Seed Interactions
    console.log('💬 Seeding full user interaction scenarios...');
    for (let i = 0; i < 10; i++) {
        const meetup = meetups[i];
        const joiner = users[i + 11];
        const joinRequest = await prisma.joinRequest.create({ data: { meetupId: meetup.id, senderId: joiner.id, status: 'ACCEPTED' } });
        await prisma.payment.create({ data: { joinRequestId: joinRequest.id, meetupId: meetup.id, purpose: 'JOIN_REQUEST', amount: 10000, status: 'SUCCESS', cashfreeOrderId: `order_${faker.string.alphanumeric(14)}` } });
        
        // --- UPDATED CHAT CREATION ---
        const isGroupChat = meetup.groupSize > 1;
        const chat = await prisma.chat.create({
            data: {
                meetupId: meetup.id,
                type: isGroupChat ? 'GROUP' : 'ONE_ON_ONE',
                name: isGroupChat ? `Group for: ${meetup.locationName}` : null,
                users: { connect: [{ id: meetup.createdBy }, { id: joiner.id }] },
            },
        });

        await prisma.message.create({ data: { chatId: chat.id, senderId: joiner.id, content: faker.lorem.sentence() } });
    }
    console.log('Created 10 full interaction scenarios.');

    // 8. Seed Banners
    console.log('🖼️ Seeding banners...');
    await prisma.banner.createMany({
        data: [
            { title: "Weekend Bonanza", imageUrl: faker.image.urlLoremFlickr({ category: 'food' }) },
            { title: "New User Offer", imageUrl: faker.image.urlLoremFlickr({ category: 'people' }) },
        ]
    });
    console.log('Created sample banners.');

    // 9. Seed Reports and Blocks
    console.log('🛡️  Seeding reports and blocks...');
    for (let i = 0; i < 10; i++) {
        const reporter = users[i + 1];
        const reported = users[i + 11];
        if (reporter && reported && reporter.id !== reported.id) {
            await prisma.userReport.create({ data: { reporterId: reporter.id, reportedId: reported.id, reason: 'SPAM' } });
        }
        const blocker = users[i + 11];
        const blocked = users[i + 1];
        if (blocker && blocked && blocker.id !== blocked.id) {
            await prisma.userBlock.create({ data: { blockerId: blocker.id, blockedId: blocked.id } });
        }
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
