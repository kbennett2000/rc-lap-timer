// src/app/api/debug-sql/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { convertBigIntToNumber } from '@/lib/utils';

export async function GET() {
  try {
    // Get database name
    const currentDb = await prisma.$queryRaw`SELECT DATABASE() as current_db`;
    logger.log("Current database:", currentDb);

    // Direct SQL checks using template literals
    const tableInfo = await prisma.$queryRaw`SHOW TABLES`;
    const sessionRequestInfo = await prisma.$queryRaw`DESCRIBE SessionRequest`;
    const statusColumn = await prisma.$queryRaw`SHOW COLUMNS FROM SessionRequest WHERE Field = 'status'`;
    const allRecords = await prisma.$queryRaw`SELECT * FROM SessionRequest`;
    const pendingRecords = await prisma.$queryRaw`SELECT * FROM SessionRequest WHERE status = 'PENDING'`;
    const nonPendingRecords = await prisma.$queryRaw`SELECT * FROM SessionRequest WHERE status != 'PENDING'`;
    const distinctStatuses = await prisma.$queryRaw`SELECT DISTINCT status FROM SessionRequest`;
    const statusCounts = await prisma.$queryRaw`SELECT status, COUNT(*) as count FROM SessionRequest GROUP BY status`;
    const statusHex = await prisma.$queryRaw`SELECT id, HEX(status) as status_hex FROM SessionRequest`;

    // Direct check with explicit equality
    const explicitCheck = await prisma.$queryRaw`
      SELECT *,
        CASE 
          WHEN status = 'PENDING' THEN 'exact_match'
          WHEN BINARY status = 'PENDING' THEN 'binary_match'
          ELSE 'no_match'
        END as match_type
      FROM SessionRequest
    `;

    // Convert all BigInt values before returning
    const responseData = {
      database: convertBigIntToNumber(currentDb),
      schema: {
        tables: convertBigIntToNumber(tableInfo),
        sessionRequest: convertBigIntToNumber(sessionRequestInfo),
        statusDefinition: convertBigIntToNumber(statusColumn)
      },
      data: {
        allRecords: convertBigIntToNumber(allRecords),
        pendingRecords: convertBigIntToNumber(pendingRecords),
        nonPendingRecords: convertBigIntToNumber(nonPendingRecords),
        distinctStatuses: convertBigIntToNumber(distinctStatuses),
        statusCounts: convertBigIntToNumber(statusCounts),
        statusHex: convertBigIntToNumber(statusHex),
        explicitCheck: convertBigIntToNumber(explicitCheck)
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error("Error in SQL debug:", error);
    // Also convert any error response
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}