import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { duplicateNameMessage, isUuid, type Checked, type EntityKind } from "@/domain/rules";

// Shared by the data routes. Clients tell errors apart by status: 400 invalid, 404 not found, 409 duplicate name
// (see src/data/api-data-store.ts).

export function badRequest(message: string, details?: string[]) {
  return NextResponse.json({ error: message, ...(details && { details }) }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

// P2002: a unique constraint failed. P2025: the record to update or delete doesn't exist.
export function isPrismaError(error: unknown, code: "P2002" | "P2025"): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// The JSON body as an object, or null when it isn't one.
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// An id the client made for a new record (optional; the database makes one otherwise).
export function parseClientId(value: unknown): Checked<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return isUuid(value) ? { ok: true, value } : { ok: false, error: "id must be a UUID" };
}

// Creates a uniquely named record once. Repeating a create with the same client id returns the record it already
// made, so retries are safe. A name already in use is a 409.
export async function createOnce<T>(
  kind: EntityKind,
  name: string,
  steps: {
    findById: () => Promise<T | null>;
    nameTaken: () => Promise<boolean>;
    create: () => Promise<T>;
  },
): Promise<{ record: T; created: boolean } | NextResponse> {
  const existing = await steps.findById();
  if (existing) return { record: existing, created: false };
  if (await steps.nameTaken()) return conflict(duplicateNameMessage(kind, name));
  try {
    return { record: await steps.create(), created: true };
  } catch (error) {
    if (!isPrismaError(error, "P2002")) throw error;
    // A retry of the same create can race this one; otherwise the name was taken in the meantime.
    const raced = await steps.findById();
    return raced ? { record: raced, created: false } : conflict(duplicateNameMessage(kind, name));
  }
}
