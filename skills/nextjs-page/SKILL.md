---
name: nextjs-page
description: "Scaffold a new Next.js 15 page with correct App Router patterns. Generates page.tsx, loading.tsx, error.tsx, metadata, and Server Component data fetching with async params."
---

# Scaffold Next.js 15 Page

## When to Use

Use this skill when creating a new page or route in a Next.js 15 App Router project.

## Instructions

1. Determine the route path and whether it's static or dynamic.

2. Generate the following files as needed:

   **page.tsx:**
   - Server Component by default (no 'use client')
   - Async if fetching data
   - `params` and `searchParams` typed as `Promise<>` and awaited
   - `generateMetadata` for dynamic pages or `metadata` export for static
   - `generateStaticParams` if pre-rendering is appropriate

   **loading.tsx:**
   - Skeleton UI matching the page layout

   **error.tsx:**
   - Must have `'use client'` directive
   - Accept `error` and `reset` props
   - Show error message and retry button

   **not-found.tsx** (if the page fetches by ID/slug):
   - Friendly 404 with navigation back

3. If the page needs interactive elements, create separate Client Components:
   - Place `'use client'` only on the interactive component, not the page
   - Keep data fetching in the Server Component page
   - Pass data as props to Client Components

4. Ensure all `cookies()`, `headers()` calls are awaited.
5. Use `revalidatePath` or `revalidateTag` if the page has mutations.
