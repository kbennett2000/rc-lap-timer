// src/app/api/session-requests/reset/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { convertBigIntToNumber } from '@/lib/utils';
import { SessionRequestStatus } from '@prisma/client';

interface StatusCount {
  status: string;
  count: bigint;
}

export async function POST() {
  try {
    // Get current state
    const beforeState = await prisma.$queryRaw<StatusCount[]>`
      SELECT status, COUNT(*) as count 
      FROM SessionRequest 
      GROUP BY status
    `;
    logger.log("Before reset:", beforeState);

    // Reset all non-PENDING records
    const resetResult = await prisma.$executeRaw`
      UPDATE SessionRequest 
      SET status = ${SessionRequestStatus.PENDING}
      WHERE status != ${SessionRequestStatus.PENDING}
    `;

    // Get state after reset
    const afterState = await prisma.$queryRaw<StatusCount[]>`
      SELECT status, COUNT(*) as count 
      FROM SessionRequest 
      GROUP BY status
    `;
    logger.log("After reset:", afterState);

    return NextResponse.json({
      success: true,
      debug: {
        beforeState: convertBigIntToNumber(beforeState),
        resetCount: convertBigIntToNumber(resetResult),
        afterState: convertBigIntToNumber(afterState)
      }
    });
  } catch (error) {
    logger.error("Error resetting statuses:", error);
    return NextResponse.json(
      { error: 'Reset failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}