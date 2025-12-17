import prisma from "../src/config/db.js";
import bcrypt from 'bcryptjs';

// Helper to pick random item from array
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Helper for random int
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
    console.log('🌱 Starting Seeding Process...');

    // 1. CLEANUP (Order matters for foreign keys)
    // Delete data in reverse order of dependencies
    await prisma.notification.deleteMany();
    await prisma.message.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.walletTransaction.deleteMany();
    await prisma.userWallet.deleteMany();
    await prisma.joinRequest.deleteMany();
    await prisma.meetup.deleteMany();
    await prisma.userReport.deleteMany();
    await prisma.userBlock.deleteMany();
    await prisma.suspensionLog.deleteMany();
    await prisma.banner.deleteMany();
    await prisma.appSettings.deleteMany();
    await prisma.subCategory.deleteMany();
    await prisma.category.deleteMany();
    // We need to unlink users from cities before deleting cities if constraints exist, 
    // but since we delete users first, it's fine.
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();
    await prisma.state.deleteMany();

    console.log('🧹 Database Cleared.');

    // --------------------------------------------------------
    // 2. LOCATIONS (States & Cities with Tiers)
    // --------------------------------------------------------
    console.log('📍 Seeding Locations...');

    const statesData = [
        {
            name: 'Maharashtra',
            cities: [
                { name: 'Mumbai', tier: 'TIER_1', isActive: true },
                { name: 'Pune', tier: 'TIER_1', isActive: true },
                { name: 'Nagpur', tier: 'TIER_2', isActive: false },
                { name: 'Nashik', tier: 'TIER_2', isActive: true },
                { name: 'Solapur', tier: 'TIER_3', isActive: false }
            ]
        },
        {
            name: 'Karnataka',
            cities: [
                { name: 'Bangalore', tier: 'TIER_1', isActive: true },
                { name: 'Mysore', tier: 'TIER_2', isActive: true },
                { name: 'Hubli', tier: 'TIER_2', isActive: false }
            ]
        },
        {
            name: 'Delhi',
            cities: [
                { name: 'New Delhi', tier: 'TIER_1', isActive: true }
            ]
        },
        {
            name: 'Uttar Pradesh',
            cities: [
                { name: 'Lucknow', tier: 'TIER_2', isActive: true },
                { name: 'Kanpur', tier: 'TIER_2', isActive: false },
                { name: 'Varanasi', tier: 'TIER_3', isActive: true } // Tourist spots might be active
            ]
        }
    ];

    // We store created cities in a map to link users later
    const cityMap = {};

    for (const stateData of statesData) {
        const state = await prisma.state.create({
            data: { name: stateData.name }
        });

        for (const cityData of stateData.cities) {
            const city = await prisma.city.create({
                data: {
                    name: cityData.name,
                    tier: cityData.tier,
                    isActive: cityData.isActive,
                    stateId: state.id
                }
            });
            cityMap[city.name] = city;
        }
    }

    // --------------------------------------------------------
    // 3. CATEGORIES & SUBCATEGORIES (With Prices)
    // --------------------------------------------------------
    console.log('🏷️ Seeding Categories...');

    const categories = [
        {
            name: 'Food & Drinks',
            subs: [
                { name: 'Coffee Date', price: 50 },
                { name: 'Fine Dining', price: 500 },
                { name: 'Street Food', price: 10 },
                { name: 'Drinks & Pub', price: 200 }
            ]
        },
        {
            name: 'Activities',
            subs: [
                { name: 'Movie Night', price: 100 },
                { name: 'Morning Walk', price: 0 },
                { name: 'Gym Buddy', price: 0 },
                { name: 'Arcade Gaming', price: 150 }
            ]
        },
        {
            name: 'Travel',
            subs: [
                { name: 'Weekend Trip', price: 1000 },
                { name: 'Long Drive', price: 300 },
                { name: 'Hiking', price: 50 }
            ]
        }
    ];

    const categoryMap = {}; // To quick lookup subcategories later

    for (const cat of categories) {
        const createdCat = await prisma.category.create({
            data: {
                name: cat.name,
                subcategories: {
                    create: cat.subs.map(s => ({ name: s.name, price: s.price }))
                }
            },
            include: { subcategories: true }
        });
        categoryMap[cat.name] = createdCat;
    }

    // --------------------------------------------------------
    // 4. APP SETTINGS & BANNERS
    // --------------------------------------------------------
    console.log('⚙️ Seeding Settings & Banners...');

    await prisma.appSettings.createMany({
        data: [
            { key: 'REFERRAL_REWARD_AMOUNT', value: '50' },
            { key: 'SIGNUP_BONUS', value: '20' },
            { key: 'PLATFORM_FEE_PERCENT', value: '5' }
        ]
    });

    await prisma.banner.createMany({
        data: [
            { title: 'Welcome Offer', imageUrl: 'https://placehold.co/600x200/png', isActive: true },
            { title: 'Summer Sale', imageUrl: 'https://placehold.co/600x200/png', isActive: false },
            { title: 'Premium Plans', imageUrl: 'https://placehold.co/600x200/png', isActive: true }
        ]
    });

    // --------------------------------------------------------
    // 5. USERS (Admins, Moderators, Regular Users)
    // --------------------------------------------------------
    console.log('👥 Seeding Users...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // A. Admin
    const admin = await prisma.user.create({
        data: {
            name: 'Super Admin',
            email: 'admin@meetup.com',
            mobileNumber: '9999999999',
            password: hashedPassword,
            role: 'ADMIN',
            isVerified: true,
            authMethod: 'MOBILE_OTP',
            cityId: cityMap['Mumbai'].id,
            UserWallet: { create: { balance: 100000 } } // Rich admin
        }
    });

    // B. Moderator
    const moderator = await prisma.user.create({
        data: {
            name: 'Content Mod',
            email: 'mod@meetup.com',
            mobileNumber: '8888888888',
            password: hashedPassword,
            role: 'MODERATOR',
            isVerified: true,
            authMethod: 'MOBILE_OTP',
            cityId: cityMap['Bangalore'].id
        }
    });

    // C. Regular Users Generator
    const userPresets = [
        { name: 'Rahul Sharma', gender: 'MALE', religion: 'HINDU', city: 'Mumbai', bio: 'Love coding and coffee.' },
        { name: 'Priya Singh', gender: 'FEMALE', religion: 'SIKH', city: 'New Delhi', bio: 'Travel enthusiast.' },
        { name: 'Amit Verma', gender: 'MALE', religion: 'HINDU', city: 'Pune', bio: 'Gym freak.' },
        { name: 'Zoya Khan', gender: 'FEMALE', religion: 'MUSLIM', city: 'Mumbai', bio: 'Food blogger.' },
        { name: 'John Doe', gender: 'MALE', religion: 'CHRISTIAN', city: 'Bangalore', bio: 'Techie looking for friends.' },
        { name: 'Sneha Gupta', gender: 'FEMALE', religion: 'HINDU', city: 'Mumbai', bio: 'Artist and painter.' },
        { name: 'Vikram Malhotra', gender: 'MALE', religion: 'HINDU', city: 'New Delhi', bio: 'Business owner.' },
        { name: 'Ayesha Siddiqui', gender: 'FEMALE', religion: 'MUSLIM', city: 'Lucknow', bio: 'Literature student.' },
        { name: 'Rohan Das', gender: 'MALE', religion: 'HINDU', city: 'Kolkata', bio: 'Musician.' }, // Kolkata isn't in seed but let's test null city
        { name: 'Suspended User', gender: 'MALE', city: 'Mumbai', isSuspended: true }
    ];

    const users = [];
    for (const [index, u] of userPresets.entries()) {
        const cityId = cityMap[u.city]?.id || null;

        // Random coordinates near city center (very rough approx)
        const lat = cityId ? 19.07 + (Math.random() * 0.1) : null;
        const lng = cityId ? 72.87 + (Math.random() * 0.1) : null;

        const user = await prisma.user.create({
            data: {
                name: u.name,
                email: `user${index}@test.com`,
                mobileNumber: `900000000${index}`,
                password: hashedPassword,
                role: 'USER',
                isVerified: true,
                authMethod: 'GOOGLE',
                gender: u.gender,
                religion: u.religion || 'OTHER',
                dateOfBirth: new Date('1995-05-20'), // ~29 years old
                bio: u.bio || 'Just here to vibe.',
                cityId: cityId,
                latitude: lat,
                longitude: lng,
                isSuspended: u.isSuspended || false,
                relationshipStatus: 'SINGLE',
                hobbies: ['Music', 'Travel', 'Reading'],
                // Create Wallet for everyone
                UserWallet: {
                    create: {
                        balance: randomInt(0, 5000), // Random balance
                        transactions: {
                            create: [
                                { amount: 500, type: 'CREDIT', description: 'Welcome Bonus' },
                                { amount: 50, type: 'DEBIT', description: 'Coffee Meetup Fee' }
                            ]
                        }
                    }
                }
            }
        });
        users.push(user);
    }

    // --------------------------------------------------------
    // 6. MEETUPS
    // --------------------------------------------------------
    console.log('📅 Seeding Meetups...');

    const rahul = users.find(u => u.name === 'Rahul Sharma');
    const priya = users.find(u => u.name === 'Priya Singh');
    const amit = users.find(u => u.name === 'Amit Verma');

    const foodCat = categoryMap['Food & Drinks'];
    const activityCat = categoryMap['Activities'];

    const meetupsData = [
        // 1. Instant Coffee Meet (Rahul)
        {
            createdBy: rahul.id,
            category: foodCat.name,
            subcategory: foodCat.subcategories[0].name, // Coffee Date
            type: 'instant',
            latitude: 19.0760,
            longitude: 72.8777,
            locationName: 'Starbucks, Bandra',
            place: 'Table 4',
            date: new Date(Date.now() + 3600 * 1000), // 1 hour from now
            time: 'Now',
            groupSize: 1,
            preferredGender: 'female',
            distanceRangeKm: 5
        },
        // 2. Planned Movie Night (Priya)
        {
            createdBy: priya.id,
            category: activityCat.name,
            subcategory: activityCat.subcategories[0].name, // Movie Night
            type: 'planned',
            latitude: 28.6139,
            longitude: 77.2090,
            locationName: 'PVR Plaza, CP',
            place: 'Main Entrance',
            date: new Date(Date.now() + 86400 * 1000 * 2), // 2 days later
            time: '18:00',
            groupSize: 4, // Group meetup
            preferredGender: 'any',
            distanceRangeKm: 20
        },
        // 3. Past Gym Meetup (Amit)
        {
            createdBy: amit.id,
            category: activityCat.name,
            subcategory: activityCat.subcategories[2].name, // Gym Buddy
            type: 'planned',
            latitude: 18.5204,
            longitude: 73.8567,
            locationName: 'Gold\'s Gym, Kalyani Nagar',
            date: new Date(Date.now() - 86400 * 1000), // Yesterday
            time: '07:00',
            groupSize: 1,
            preferredGender: 'male',
            distanceRangeKm: 3
        }
    ];

    const createdMeetups = [];
    for (const m of meetupsData) {
        const meetup = await prisma.meetup.create({ data: m });
        createdMeetups.push(meetup);
    }

    // --------------------------------------------------------
    // 7. INTERACTION: Join Requests & Chats
    // --------------------------------------------------------
    console.log('🤝 Seeding Requests & Chats...');

    // A. Zoya joins Rahul's Coffee Meet
    const zoya = users.find(u => u.name === 'Zoya Khan');
    const coffeeMeet = createdMeetups[0]; // Rahul's

    // Create Request
    const joinReq = await prisma.joinRequest.create({
        data: {
            meetupId: coffeeMeet.id,
            senderId: zoya.id,
            status: 'ACCEPTED' // Auto accepted or manual
        }
    });

    // Create 1-on-1 Chat
    const chat = await prisma.chat.create({
        data: {
            meetupId: coffeeMeet.id,
            type: 'ONE_ON_ONE',
            users: { connect: [{ id: rahul.id }, { id: zoya.id }] },
            messages: {
                create: [
                    { senderId: zoya.id, content: 'Hey Rahul! Is the Starbucks crowded?', type: 'TEXT' },
                    { senderId: rahul.id, content: 'Not really, I got a table.', type: 'TEXT' }
                ]
            }
        }
    });

    // B. Amit requests to join Priya's Movie (Pending)
    const movieMeet = createdMeetups[1];
    await prisma.joinRequest.create({
        data: {
            meetupId: movieMeet.id,
            senderId: amit.id,
            status: 'PENDING'
        }
    });

    // --------------------------------------------------------
    // 8. ADMIN LOGS & REPORTS
    // --------------------------------------------------------
    console.log('👮 Seeding Admin Logs...');

    // Suspended User Log
    const suspendedUser = users.find(u => u.name === 'Suspended User');
    if (suspendedUser) {
        await prisma.suspensionLog.create({
            data: {
                userId: suspendedUser.id,
                adminId: admin.id,
                action: 'SUSPEND',
                reason: 'Violated community guidelines repeatedly.'
            }
        });
    }

    // Report: Priya reports Suspended User
    await prisma.userReport.create({
        data: {
            reporterId: priya.id,
            reportedId: suspendedUser.id,
            reason: 'HARASSMENT',
            details: 'Sent inappropriate messages.',
            status: 'RESOLVED' // Admin already acted
        }
    });

    // Block: Zoya blocks Amit (hypothetically)
    await prisma.userBlock.create({
        data: {
            blockerId: zoya.id,
            blockedId: amit.id
        }
    });

    // --------------------------------------------------------
    // 9. NOTIFICATIONS
    // --------------------------------------------------------
    console.log('🔔 Seeding Notifications...');

    await prisma.notification.create({
        data: {
            userId: rahul.id,
            type: 'joinRequest',
            title: 'New Join Request',
            subtitle: 'Zoya wants to join your Coffee Meetup.',
            senderName: zoya.name,
            isRead: true
        }
    });

    await prisma.notification.create({
        data: {
            userId: rahul.id,
            type: 'message',
            title: 'New Message',
            subtitle: 'Zoya sent you a message.',
            isRead: false
        }
    });

    console.log('✅ Seeding Completed Successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });