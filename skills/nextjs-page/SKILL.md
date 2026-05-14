---
name: nextjs-page
description: "Scaffold a new Next.js 16 page (Server Component) with async params, generateMetadata, Suspense boundary around the slow async child, loading.tsx, and error.tsx. Server-first by default; pushes 'use client' down to the smallest interactive component."
---

# Scaffold a New Next.js 16 Page

## When to Use

Use when generating a new `page.tsx` under `app/`, or restructuring an existing page that has gone all-client (a `'use client'` at the top, every fetch in `useEffect`, `params` typed as a plain object). The output should be CI-grade from line one: server-first, async params, Suspense around slow children, no Pages Router hangovers.

Target: `next@16.0+` on `react@19.2+`. The companion `nextjs-core` and `nextjs-anti-patterns` rules reject the inverse patterns.

## Output

For a route at `app/posts/[slug]/page.tsx`, the scaffold writes four files:

```typescript
// app/posts/[slug]/page.tsx (Server Component)
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata, PageProps } from 'next';
import { getPostForViewing } from '@/lib/dal/posts';
import { PostBody } from './_components/post-body';
import { CommentsLoader } from './_components/comments-loader';
import { CommentsSkeleton } from './_components/comments-skeleton';

export async function generateMetadata(
  { params }: PageProps<'/posts/[slug]'>,
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostForViewing(slug);
  if (!post) return { title: 'Not found' };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt },
  };
}

export default async function PostPage(
  { params }: PageProps<'/posts/[slug]'>,
) {
  const { slug } = await params;
  const post = await getPostForViewing(slug);
  if (!post) notFound();

  return (
    <article className="prose">
      <h1>{post.title}</h1>
      <PostBody html={post.bodyHtml} />

      {/* Comments are slow; stream them in after the article paints. */}
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsLoader postId={post.id} />
      </Suspense>
    </article>
  );
}
```

```typescript
// app/posts/[slug]/loading.tsx (Server Component)
export default function Loading() {
  return (
    <div className="prose animate-pulse">
      <div className="h-8 w-2/3 bg-neutral-200 rounded mb-4" />
      <div className="h-4 w-full bg-neutral-200 rounded mb-2" />
      <div className="h-4 w-5/6 bg-neutral-200 rounded mb-2" />
      <div className="h-4 w-4/6 bg-neutral-200 rounded" />
    </div>
  );
}
```

```typescript
// app/posts/[slug]/error.tsx (Client Component - error.tsx must be client)
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error tracker (GlitchTip, Sentry, etc.)
    console.error('Post page error:', error);
  }, [error]);

  return (
    <div className="prose">
      <h2>Something went wrong</h2>
      <p>We could not load this post. {error.digest ? `(ref: ${error.digest})` : null}</p>
      <button type="button" onClick={reset}>Try again</button>
    </div>
  );
}
```

```typescript
// app/posts/[slug]/_components/comments-loader.tsx (Server Component)
import { getCommentsForPost } from '@/lib/dal/comments';

export async function CommentsLoader({ postId }: { postId: string }) {
  const comments = await getCommentsForPost(postId);
  return (
    <section>
      <h2>Comments</h2>
      <ul>
        {comments.map(c => (
          <li key={c.id}>
            <strong>{c.authorName}</strong>: {c.body}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

The interactive sliver (if any - e.g. a "like" button) is a separate small Client Component imported by `PostBody`, NOT by the page itself.

## Rules baked into the scaffold

1. **Imports**: `notFound`/`redirect` from `next/navigation`, never `next/router`. `Metadata` and `PageProps`/`LayoutProps`/`RouteContext` from `next` (after `next typegen` once).
2. **Server Component default**: no `'use client'` at the top of `page.tsx`. If a child needs interactivity, that child becomes the Client Component.
3. **Async `params`**: typed as `Promise<{ slug: string }>` (or via `PageProps<'/posts/[slug]'>`) and `await`-ed before destructure. Same shape in `generateMetadata`.
4. **`generateMetadata` with async params**: title, description, OpenGraph derived from the same DAL call the page uses. Returns `Promise<Metadata>`.
5. **DAL call, not direct DB**: the page imports `getPostForViewing` from `@/lib/dal/*`, which does its own auth + DTO shaping. See the `nextjs-data-access-layer` rule.
6. **Suspense around slow children**: the article body renders immediately, comments stream in under a `<Suspense fallback={...}>`. Per-segment loading state lives in `loading.tsx`.
7. **No `'use client'` on the page or layout**: the directive only goes on the smallest interactive component. See the `nextjs-anti-patterns` rule entry #2.
8. **No `useEffect` + fetch for server data**: server reads happen at render time in a Server Component.
9. **No Pages Router APIs**: no `getServerSideProps`, no `getStaticProps`, no `getInitialProps`, no `pages/api`.
10. **Env discipline**: secrets read as `process.env.STRIPE_SECRET_KEY` from a `server-only` module. `NEXT_PUBLIC_*` is reserved for values that are safe to ship to the browser.
11. **`error.tsx` is Client**: the boundary needs `useEffect` + a `reset` button. It catches errors from `page.tsx` and children, NOT from the sibling `layout.tsx`.
12. **`notFound()` for missing resources**: bubbles to the nearest `not-found.tsx`. Don't render a "404" string inside the page.

## Workflow

1. **Identify the route segment.** What is the URL path? Dynamic (`[slug]`, `[...rest]`), or static? Where does it sit in the app's layout tree?
2. **Pick dynamic vs static.** With `cacheComponents: true` (see the `nextjs-cache-components` rule), everything is dynamic by default. If the page's data is genuinely static, wrap the DAL function body in `'use cache'` + `cacheLife`.
3. **Pick auth-required vs public.** If the page requires auth, the DAL function calls `requireSession`. The `proxy.ts` redirect (see the `nextjs-proxy-and-auth` rule) is the optimistic UX layer; the DAL is the security boundary.
4. **Scaffold the four files.** `page.tsx`, `loading.tsx`, `error.tsx`, and one inner Server Component per slow async section.
5. **Place `<Suspense>` only around children that genuinely need it.** The page-level fallback in `loading.tsx` already covers the initial paint; `Suspense` around an inner component lets the rest of the page paint first.
6. **Verify with `tsc --noEmit` and `next build`.** Type errors here mean sync `params` or wrong typed-route literal. Run `next typegen` first if `PageProps<'/posts/[slug]'>` errors.

## Common mistakes to refuse

- **`'use client'` at the top of `page.tsx`.** Pushes every descendant into the client bundle. Move the directive down to the actual interactive component.
- **Sync `params`**: `function Page({ params }: { params: { slug: string } })`. In v16 the destructure throws. Type as `Promise<{ slug: string }>` and `await` before use.
- **Sync `params` in `generateMetadata`**: same fix.
- **Fetching the project's own `/api/posts` route from the page**: wasted HTTP round-trip. Call the DAL function directly. See the `nextjs-anti-patterns` rule entry #16 and the `nextjs-route-handlers` rule.
- **`useFormState` from `react-dom`**: deprecated. Use `useActionState` from `react` (in any Client Component child that has a form).
- **No `<Suspense>` around the slow async child**: the whole page waits on the slowest fetch. Wrap it.
- **Missing `generateMetadata`**: default Next.js metadata is wrong for indexed pages. Add it.
- **`error.tsx` placed at a level meant to catch a layout error**: `error.tsx` does NOT catch errors thrown by the sibling `layout.tsx`. Put it one segment up, or use `global-error.tsx`.
- **`getServerSideProps` / `getStaticProps` / `getInitialProps`**: Pages Router only. Convert to async Server Component with direct `await`.
- **React Context for auth in the Server Component tree**: providers do not propagate to server children. Read the session from the DAL in the page itself.
- **`cookies().set(...)` inside the page**: forbidden during render. Cookie mutations live in Server Actions, Route Handlers, or `proxy.ts`.

## What this skill does NOT scaffold

- The DAL function. See the `nextjs-dal` skill - the page imports from `@/lib/dal/posts`, which must exist first.
- The Server Action for mutations on this page. See the `nextjs-server-action` skill.
- The `not-found.tsx` segment fallback. Add manually when `notFound()` is in play.
- The `default.tsx` parallel-route slot fallback. Required only when this segment has `@modal/` or similar slots; build fails in v16 without it.
