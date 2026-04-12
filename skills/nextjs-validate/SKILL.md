---
name: nextjs-validate
description: "Scan a Next.js project for Pages Router patterns, Next.js 14 caching assumptions, sync API usage, and common App Router mistakes."
---

# Validate Next.js 15 Project

## When to Use

Use this skill when auditing a Next.js project for correctness, upgrading from 14 to 15, or checking for common AI-generated mistakes.

## Instructions

1. Check for Pages Router patterns in App Router:
   - `getServerSideProps`, `getStaticProps`, `getStaticPaths` (use async Server Components + generateStaticParams)
   - `import { useRouter } from 'next/router'` (use `next/navigation`)
   - `pages/` directory coexisting with `app/` (potential confusion)

2. Check for Next.js 14 sync API usage:
   - `cookies()` without `await` (must await in 15)
   - `headers()` without `await` (must await in 15)
   - `params` accessed as sync object (must await in 15)
   - `searchParams` accessed as sync object (must await in 15)
   - `params` typed as `{ id: string }` instead of `Promise<{ id: string }>`

3. Check for caching assumptions:
   - `fetch()` without explicit `next.revalidate` or `cache` option (not cached in 15)
   - GET Route Handlers without `revalidate` export (not cached in 15)
   - Mutations without `revalidatePath`/`revalidateTag` (stale data)
   - `revalidatePath`/`revalidateTag` called during render (throws in 15)

4. Check for component pattern issues:
   - `'use client'` on layout.tsx or page.tsx (should be on leaf components)
   - `useEffect` + `fetch` for server-available data (use Server Component)
   - Server Component fetching its own Route Handler (unnecessary hop)
   - `useContext` in Server Components (not supported)
   - `useFormState` usage (deprecated, use `useActionState`)

5. Check for Server Action issues:
   - Missing authentication/authorization checks
   - Missing revalidation after mutations
   - `redirect()`/`notFound()` inside try/catch blocks

6. Check for metadata issues:
   - `generateMetadata` not awaiting `params`
   - Missing `metadata` or `generateMetadata` on pages
   - Same metadata across all pages

7. Produce a summary report with issue count, severity, file locations, and fixes.
