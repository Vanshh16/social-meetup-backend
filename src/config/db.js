// import {PrismaClient } from './generated/prisma/index.js'

// const prisma = new PrismaClient()


import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL 
});
const prisma = new PrismaClient({ adapter });

export default prisma;
