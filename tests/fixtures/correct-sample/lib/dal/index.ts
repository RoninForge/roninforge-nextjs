// Gold-standard Next.js 16 Data Access Layer. Demonstrates:
// 1. 'server-only' guard - build fails if a Client Component imports this
// 2. cache()-wrapped verifySession - memoized per render pass
// 3. async cookies() (v16 requires await)
// 4. requireSession helper that throws (vs verifySession returning null)
// 5. Returns a typed Session, no leaking of full DB row
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "../db";

export type Session = {
  userId: string;
  role: "user" | "admin";
  expiresAt: Date;
};

export const verifySession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    select: { userId: true, role: true, expiresAt: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  return session;
});

export async function requireSession(): Promise<Session> {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
