---
name: nextjs-dal
description: "Scaffold a Next.js 16 Data Access Layer: server-only module, cache()-wrapped verifySession (memoized per render), per-domain DAL functions that return DTOs, requireSession vs verifySession helpers, taintUniqueValue for high-stakes secrets, the 'getXForViewing' vs 'getXForEditing' naming convention."
---

# Scaffold a Next.js 16 Data Access Layer

## When to Use

Use when:

- Starting a new Next.js project (the DAL is foundational - every Server Component, Server Action, and Route Handler that reads user data goes through it).
- Refactoring an existing project that scatters `verifySession` calls across components, has direct `db.*` queries inside Server Components, or returns raw DB rows from `page.tsx`.
- Adding a new domain (posts, users, billing, ...) to a project that already has a DAL skeleton.

Target: `next@16.0+` on `react@19.2+`. This is Vercel's officially recommended auth + data pattern. The companion `nextjs-data-access-layer` rule has the full pattern reference.

## Output

The scaffold writes the foundation module plus one domain file. For a `posts` domain:

```typescript
// lib/dal/index.ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export type Role = 'user' | 'admin';

export type Session = {
  userId: string;
  role: Role;
  expiresAt: Date;
};

/**
 * Read the session cookie, validate it against the session store, return
 * a typed Session or null.
 *
 * `cache(fn)` from React memoizes this for the duration of a single render
 * pass. 50 components calling verifySession() result in ONE cookie lookup
 * + ONE DB query. Do NOT replace with `unstable_cache` from next/cache -
 * that one caches across requests, which would serve one user's session
 * to other users.
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    select: { userId: true, role: true, expiresAt: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  return session;
});

/** Throws if there is no session. Use when the caller must be authenticated. */
export async function requireSession(): Promise<Session> {
  const session = await verifySession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

/** Throws if there is no session OR the session's role does not match. */
export async function requireRole(role: Role): Promise<Session> {
  const session = await requireSession();
  if (session.role !== role) throw new Error('Forbidden');
  return session;
}
```

```typescript
// lib/dal/posts.ts
import 'server-only';
import { requireSession, verifySession } from './index';
import { db } from '@/lib/db';

export type PostListItem = {
  id: string;
  title: string;
  createdAt: string;
};

export type PostDetail = PostListItem & {
  body: string;
  authorName: string;
};

/**
 * Public read. No auth required. Returns null when the post does not exist.
 * Use this from public pages (article view, OG image generator, etc.).
 *
 * Public routes key on `slug` (the URL-friendly identifier).
 * Owner routes (see getPostForEditing) key on the internal `id`.
 */
export async function getPostForViewing(
  slug: string,
): Promise<PostDetail | null> {
  const post = await db.post.findUnique({
    where: { slug, publishedAt: { not: null } },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
  if (!post) return null;
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    authorName: post.author.name,
  };
}

/**
 * Owner-only read. The caller must be the post's author. Throws Forbidden
 * if a session exists but is not the owner. Returns null if the post
 * does not exist at all.
 *
 * Use this from the edit page. The shape is the same as getPostForViewing
 * but the authorization differs - the function name advertises that
 * difference at every call site.
 */
export async function getPostForEditing(
  id: string,
): Promise<PostDetail | null> {
  const session = await requireSession();

  const post = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });
  if (!post) return null;
  if (post.authorId !== session.userId) throw new Error('Forbidden');

  return {
    id: post.id,
    title: post.title,
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    authorName: post.author.name,
  };
}

/**
 * The current user's own posts. requireSession() throws if unauthenticated,
 * so this never has to handle the null-session case.
 */
export async function getMyPosts(): Promise<PostListItem[]> {
  const session = await requireSession();
  const posts = await db.post.findMany({
    where: { authorId: session.userId },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return posts.map(p => ({
    id: p.id,
    title: p.title,
    createdAt: p.createdAt.toISOString(),
  }));
}
```

For a domain that holds secrets (Stripe keys, OAuth tokens), taint the high-stakes values so an accidental Server-to-Client prop pass throws.

```typescript
// lib/dal/billing.ts
import 'server-only';
import { experimental_taintUniqueValue as taintUniqueValue } from 'react';
import { requireSession } from './index';
import { db } from '@/lib/db';

const stripeKey = process.env.STRIPE_SECRET_KEY!;
taintUniqueValue(
  'Do not pass the Stripe secret key to a Client Component.',
  process,
  stripeKey,
);

export type BillingSummary = {
  customerId: string;
  plan: 'free' | 'pro';
  renewsAt: string | null;
};

export async function getBillingSummary(): Promise<BillingSummary> {
  const session = await requireSession();
  const row = await db.customer.findUnique({
    where: { userId: session.userId },
    select: { stripeCustomerId: true, plan: true, renewsAt: true },
  });
  if (!row) throw new Error('No billing record');
  return {
    customerId: row.stripeCustomerId,
    plan: row.plan,
    renewsAt: row.renewsAt?.toISOString() ?? null,
  };
}
```

## Rules baked into the scaffold

1. **`import 'server-only'` at the top of EVERY DAL file.** Throws at build time if a Client Component ever imports the module - prevents leaking server code and secrets into the browser bundle.
2. **`verifySession` is `cache()`-wrapped** with `cache` from `react`. Per-render memoization. The cookie lookup + DB query runs once even if 50 components call it.
3. **Never use `unstable_cache` for session memoization.** `unstable_cache` from `next/cache` persists across requests, so user A's session would be served to user B. `cache()` from `react` is the right tool here.
4. **`verifySession` returns `Session | null`. `requireSession` throws.** Pick the right one at the call site: components that conditionally render use `verifySession`; components that should never run unauthenticated use `requireSession` (and a parent redirects first).
5. **Every user-scoped DAL function calls `verifySession` or `requireSession` internally.** Layout-level or `proxy.ts`-level auth does NOT carry into the DAL. Defense in depth lives at the data source.
6. **Resource ownership check** before returning data tied to a specific row (the edit path, not the view path).
7. **Return DTOs, not raw DB rows.** Project + map. The DTO is the project's contract with the rest of the app: it never leaks `passwordHash`, soft-delete flags, internal IDs you don't want in URLs, audit fields, etc. Serialize `Date` to ISO strings up-front so the return value crosses the Server-Component-to-Client-Component boundary cleanly.
8. **Naming convention encodes the access shape.** `getXForViewing` = public read. `getXForEditing` = owner-only. `getMyX` = current user's own. The function name tells the caller what authorization happened.
9. **`taintUniqueValue` for high-stakes secrets.** Stripe keys, session tokens, OAuth refresh tokens. If the value ever lands in a Client Component prop, React throws.
10. **The DAL does NOT do mutations.** Mutations live in Server Actions; the action calls the DAL for the read side of a write (verify session, fetch the resource, check ownership) and does the write itself.
11. **The DAL does NOT do caching by default.** Per-user data is dynamic. Pair the DAL with `'use cache'` only for non-user-scoped reads (product catalog, public prices, etc.) - and even then, the cache key must include enough of the args that two callers do not share an entry. See the `nextjs-cache-components` rule.

## Workflow

1. **Pick the domain.** Posts, users, billing, comments, organizations - one file per domain under `lib/dal/`.
2. **Identify the access patterns** the domain needs:
   - Public read (no auth needed)
   - Owner-only read (must be logged in AND own the resource)
   - Owner-only write (handled by a Server Action that calls into the DAL)
   - Admin-only read
3. **Write one DAL function per access pattern.** Avoid one giant `getPost(id, options)` function that branches on auth state - the function name should advertise its access shape.
4. **Project to a DTO.** `select: { ... }` exactly the fields the UI needs. Map `Date` to ISO strings. Drop internal IDs that should not appear in URLs or props.
5. **Add `taintUniqueValue` for any secrets** read at module load.
6. **Verify with `tsc --noEmit`.** Catches `await cookies()` mistakes, wrong DTO shape, missing `Promise<>` returns.
7. **Smoke-test the negative cases.** A request with no session cookie reaches `getMyPosts` -> `requireSession()` throws. A request with a valid session but the wrong `userId` reaches `getPostForEditing` -> `Forbidden`. The tests should cover both paths.

## Common mistakes to refuse

- **Missing `import 'server-only'`.** Without it a Client Component can import the DAL and either bundle server code into the browser or - worse - bundle a hardcoded secret read from `process.env`.
- **No `cache()` on `verifySession`.** Each component re-runs the cookie lookup + DB query. With 30 components in a render tree, that is 30 round trips for one page render.
- **`unstable_cache` for the session.** Caches across requests. One user's session is served to other users. CRITICAL bug. Use `cache()` from `react`.
- **Returning raw DB rows.** Leaks every column on the model. Always project + map to a DTO.
- **No ownership check on a function named `getXForEditing` or `updateX`.** IDOR vulnerability. The function name promises an authorization that the body never delivers.
- **Layouts as the auth boundary.** Layouts in App Router can be cached and do not always re-render on every navigation. The DAL must re-verify. See the `nextjs-proxy-and-auth` rule entry on the three-layer model.
- **`verifySession` called from a Client Component.** It calls `cookies()`, which is server-only. Pass minimal session info down as props from a Server Component instead.
- **One function that takes `{ asOwner?: boolean }` and branches.** Splits into two functions with explicit names. The branching version is the shape where authorization bugs hide.
- **DAL function that imports `next/server`, `next/navigation`, or React.** The DAL stays portable. The only `next/*` imports it needs are `cookies` and `headers` from `next/headers`.
- **Caching a per-user read with `'use cache'` and no user-scoped cache key.** Two users hit the same entry; the second user sees the first user's data. If you cache user-scoped data, the function's args must include the user ID and `cacheTag` must be user-scoped.

## What this skill does NOT scaffold

- The database client (`lib/db.ts`). Bring your own Prisma, Drizzle, Kysely, raw driver, etc. The scaffold assumes a `db` export with `.findUnique` / `.findMany` shaped like Prisma; adapt to your ORM.
- The auth library (Auth.js, Clerk, Better Auth, Supabase, WorkOS). The scaffold ships a hand-rolled session-table lookup. If you use Auth.js, replace the body of `verifySession` with `await auth()`; keep the `cache()` wrapper and the rest of the pattern intact.
- The Server Action that consumes the DAL. See the `nextjs-server-action` skill.
- The page that consumes the DAL. See the `nextjs-page` skill.
