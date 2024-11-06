// src/lib/db-utils.ts
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SessionRequestStatus } from '@prisma/client';
import { convertBigIntToNumber } from './utils';

export async function checkDatabaseState() {
  try {
    const checks = {
      // Database info
      database: await prisma.$queryRaw`SELECT DATABASE() as current_db`,
      
      // Table structure
      tableStructure: await prisma.$queryRaw`DESCRIBE SessionRequest`,
      
      // Status column info
      statusInfo: await prisma.$queryRaw`SHOW COLUMNS FROM SessionRequest WHERE Field = 'status'`,
      
      // Record counts
      counts: await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status != 'PENDING' THEN 1 ELSE 0 END) as non_pending
        FROM SessionRequest
      `,
      
      // Status distribution
      statusDistribution: await prisma.$queryRaw`
        SELECT status, COUNT(*) as count 
        FROM SessionRequest 
        GROUP BY status
      `,
      
      // Detailed status check
      statusCheck: await prisma.$queryRaw`
        SELECT id, status,
          HEX(status) as status_hex,
          status = 'PENDING' as is_pending_string,
          BINARY status = 'PENDING' as is_pending_binary
        FROM SessionRequest
      `
    };

    return convertBigIntToNumber(checks);
  } catch (error) {
    logger.error("Database check failed:", error);
    throw error;
  }
}

export async function resetAllStatuses() {
  try {
    const before = await checkDatabaseState();
    
    const resetResult = await prisma.$executeRaw`
      UPDATE SessionRequest 
      SET status = ${SessionRequestStatus.PENDING}
      WHERE status != ${SessionRequestStatus.PENDING}
    `;
    
    const after = await checkDatabaseState();
    
    return convertBigIntToNumber({
      before,
      resetCount: resetResult,
      after
    });
  } catch (error) {
    logger.error("Status reset failed:", error);
    throw error;
  }
}