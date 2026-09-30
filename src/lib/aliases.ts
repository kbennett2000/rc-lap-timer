import type { Prisma, PrismaClient } from "@prisma/client";
import type { RecordKind } from "@/domain/sync/bundle";

// The record an id now stands for: sync may have merged it into another with the same name (src/domain/sync).
export async function resolveId(
  db: PrismaClient | Prisma.TransactionClient,
  kind: RecordKind,
  id: string,
): Promise<string> {
  let current = id;
  for (let hop = 0; hop < 10; hop++) {
    const alias = await db.idAlias.findUnique({ where: { kind_fromId: { kind, fromId: current } } });
    if (!alias) break;
    current = alias.toId;
  }
  return current;
}
