require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Database version:', result);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
