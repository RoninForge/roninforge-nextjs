---
name: nextjs-api
description: "Generate a Next.js 15 Route Handler (API endpoint) with async params, correct caching configuration, and proper response patterns."
---

# Generate Next.js 15 Route Handler

## When to Use

Use this skill when creating an API endpoint for external clients (mobile apps, third-party integrations, webhooks). For internal data access from Server Components, use direct data fetching instead.

## Instructions

1. Create the route handler at `app/api/<resource>/route.ts`.

2. For each HTTP method (GET, POST, PUT, DELETE):
   - Type `params` as `Promise<>` and await it
   - Use `Response.json()` for responses
   - Set appropriate status codes (201 for creation, 404 for not found)
   - Handle errors with proper HTTP status codes

3. For query parameters, use `new URL(request.url).searchParams`.

4. Caching:
   - GET handlers are NOT cached by default in Next.js 15
   - Add `export const revalidate = N` to opt into caching
   - Use `export const dynamic = 'force-static'` for build-time generation

5. For mutations (POST, PUT, DELETE):
   - Validate input
   - Use `revalidateTag` or `revalidatePath` after data changes
   - Return the created/updated resource

6. Add authentication checks where needed.
