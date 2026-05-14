// Gold-standard Next.js 16 proxy.ts. Demonstrates:
// 1. Renamed from middleware.ts (v16); function name is `proxy` not `middleware`
// 2. Runs on Node.js runtime (proxy.ts is Node-only in v16)
// 3. OPTIMISTIC auth check only - reads cookie, redirects early
// 4. Does NOT hit the database here (proxy runs on prefetched routes too)
// 5. The DAL is the security boundary; this is UX-level only
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const sessionCookie = req.cookies.get("session")?.value;
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
