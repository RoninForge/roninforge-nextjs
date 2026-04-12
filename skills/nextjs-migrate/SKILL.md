---
name: nextjs-migrate
description: "Migrate a Next.js project from Pages Router to App Router, or from Next.js 14 to 15. Generates a step-by-step migration plan with exact file moves and code changes."
---

# Migrate to Next.js 15 App Router

## When to Use

Use this skill when:
- Upgrading from Next.js 14 to 15 (async API changes)
- Migrating from Pages Router to App Router
- A project has mixed Pages Router and App Router code

## Instructions

### For Next.js 14 to 15 Upgrade:

1. Search all files for sync usage of request APIs:
   - `cookies()` -> must await
   - `headers()` -> must await
   - `params` prop destructured directly -> must await Promise
   - `searchParams` prop accessed directly -> must await Promise

2. Search for caching assumptions:
   - `fetch()` calls relying on default caching (now uncached)
   - GET Route Handlers relying on default caching (now uncached)
   - Add explicit `next: { revalidate: N }` where caching is needed

3. Search for deprecated React patterns:
   - `useFormState` from `react-dom` -> `useActionState` from `react`

4. Generate exact code changes for each file.

### For Pages Router to App Router Migration:

1. Audit the `pages/` directory for all routes.

2. For each page, map to the App Router equivalent:
   - `pages/index.tsx` -> `app/page.tsx`
   - `pages/about.tsx` -> `app/about/page.tsx`
   - `pages/posts/[id].tsx` -> `app/posts/[id]/page.tsx`
   - `pages/api/users.ts` -> `app/api/users/route.ts`
   - `pages/_app.tsx` -> `app/layout.tsx`
   - `pages/_document.tsx` -> `app/layout.tsx` (merge into root layout)
   - `pages/404.tsx` -> `app/not-found.tsx`
   - `pages/500.tsx` -> `app/error.tsx` or `app/global-error.tsx`

3. Convert data fetching:
   - `getServerSideProps` -> async Server Component
   - `getStaticProps` -> async Server Component with revalidate
   - `getStaticPaths` -> `generateStaticParams`

4. Move client-side logic to Client Components with `'use client'`.

5. Convert API routes to Route Handlers.
