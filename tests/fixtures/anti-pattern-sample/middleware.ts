// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. File still named middleware.ts (renamed to proxy.ts in v16; export renamed to proxy)
// 2. Hits the database directly inside the middleware (DB calls in middleware are forbidden;
//    middleware runs on Edge by default, has no DB driver, and adds latency to every request)
// 3. No config.matcher exported, so this runs on /_next/static/*, /api/*, every asset

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function middleware(req: NextRequest) {
  const sessionToken = req.cookies.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  // BAD: DB call inside middleware. Auth must be optimistic at the proxy layer,
  //      secure verification happens in the DAL.
  const session = await db.session.findUnique({ where: { token: sessionToken } });
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
