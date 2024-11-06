// src/app/api/session-requests/type-check/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Check the database schema
    const tableInfo = await prisma.$queryRaw`
      SHOW CREATE TABLE SessionRequest
    `;
    logger.log("Table creation SQL:", tableInfo);

    // Check enum definition
    const columnInfo = await prisma.$queryRaw`
      SHOW COLUMNS FROM SessionRequest WHERE Field = 'status'
    `;
    logger.log("Status column info:", columnInfo);

    // Try to compare exact bytes
    const statusBytes = await prisma.$queryRaw`
      SELECT HEX(status) as status_hex FROM SessionRequest
    `;
    logger.log("Status values as hex:", statusBytes);

    return NextResponse.json({
      schema: {
        tableInfo,
        columnInfo,
        statusBytes
      }
    });
  } catch (error) {
    logger.error("Error checking types:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}