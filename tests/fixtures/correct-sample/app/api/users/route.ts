// Gold-standard Next.js 16 Route Handler. Demonstrates:
// 1. Async params via RouteContext type
// 2. Auth check via the DAL (not trusting headers from the client)
// 3. DTO response (no raw DB rows)
// 4. Public-API shape for external clients (mobile, webhooks)
//    - if this data is for your own Server Components, call the DAL directly instead
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/dal";

type UserDTO = { id: string; name: string };

export async function GET() {
  try {
    const session = await requireSession();
    // Return a minimal DTO. Never raw DB rows.
    const dto: UserDTO = { id: session.userId, name: "Alice" };
    return NextResponse.json(dto);
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
