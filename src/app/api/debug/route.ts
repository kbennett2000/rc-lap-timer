// src/app/api/debug/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Helper function to convert BigInt to Number
const convertBigIntToNumber = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntToNumber(obj[key]);
    }
    return converted;
  }
  
  return obj;
};

export async function GET() {
  try {
    // 1. Database connection check
    const dbCheck = await prisma.$queryRaw`SELECT 1 as connection_test`;
    
    // 2. Raw table inspection
    const rawRequests = await prisma.$queryRaw`
      SELECT * FROM SessionRequest
    `;

    // 3. Prisma schema check
    const schemaCheck = await prisma.$queryRaw`
      DESCRIBE SessionRequest
    `;

    // 4. Enum values check
    const enumCheck = await prisma.$queryRaw`
      SHOW COLUMNS FROM SessionRequest WHERE Field = 'status'
    `;

    // 5. Check indexes
    const indexCheck = await prisma.$queryRaw`
      SHOW INDEX FROM SessionRequest
    `;

    // 6. Count by status (using Prisma's built-in count)
    const statusCounts = await prisma.sessionRequest.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    });

    // 7. Environment info
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL?.replace(/[:@/].*$/, '...'),
    };

    // Convert all BigInt values before sending response
    const response = convertBigIntToNumber({
      connectionTest: dbCheck,
      rawRequests,
      schemaInfo: schemaCheck,
      enumInfo: enumCheck,
      indexInfo: indexCheck,
      statusCounts,
      environmentInfo: envInfo,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Debug endpoint error:", error);
    return NextResponse.json(
      { error: 'Debug check failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}