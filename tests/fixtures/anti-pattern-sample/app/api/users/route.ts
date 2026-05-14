// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. Returns raw DB rows (leaks passwordHash, isAdmin, deletedAt, audit columns)
// 2. No session check at all (any caller, no auth)
// 3. Sync params destructure (would be TypeError in v16 if dynamic)

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const users = await db.user.findMany();
  // BAD: includes passwordHash, isAdmin, internal IDs
  return NextResponse.json(users);
}
