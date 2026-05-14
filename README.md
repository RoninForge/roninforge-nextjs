# roninforge-nextjs

[![Validate Plugin](https://github.com/RoninForge/roninforge-nextjs/actions/workflows/validate.yml/badge.svg)](https://github.com/RoninForge/roninforge-nextjs/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/RoninForge/roninforge-nextjs)](https://github.com/RoninForge/roninforge-nextjs/releases)

Cursor plugin for Next.js 16 (`next@16.0+`) on React 19.2+. Teaches the App Router conventions, Server Components first with `'use client'` pushed down, async-only request APIs (`cookies`/`headers`/`params`/`searchParams` are Promises in v16), the Vercel-recommended Data Access Layer pattern with `cache()`-memoized `verifySession`, Server Actions that validate-authorize-mutate-revalidate (Zod + `verifySession` + ownership re-check + `redirect()` OUTSIDE try/catch + DTO return), `useActionState` + `useFormStatus`, Cache Components opt-in (`'use cache'` directive, `cacheLife`, `cacheTag`, `revalidateTag(tag, profile)` 2-arg form), `proxy.ts` (renamed from `middleware.ts`), and the v16 deltas a 2024-trained LLM still gets wrong. Catches 34 LLM regressions with BAD / CORRECT TypeScript pairs.

## The Problem

LLMs trained on Next.js 12 / 13 / 14 (and Pages Router tutorials) emit code that does not run on App Router v16. They write:

- **`getServerSideProps` / `getStaticProps`** in `app/**` (Pages Router APIs, never run)
- **`pages/api/*.ts`** for new routes instead of `app/<path>/route.ts`
- **`'use client'` on `layout.tsx`** so the entire subtree is client-rendered
- **`useEffect` + `fetch`** to load server data into a Client Component instead of awaiting in a Server Component
- **`cookies().get(...)`** sync (TypeError in v16, `cookies()` returns `Promise`)
- **`headers()`** / **`draftMode()`** sync (same shape, also `Promise` in v16)
- **`{ params: { slug } }`** destructure (TypeError in v16, `params` is `Promise<{ slug: string }>`)
- **`useFormState` from `react-dom`** (deprecated, use `useActionState` from `react`)
- **`revalidateTag('posts')`** single-arg (TS error in v16, requires `(tag, profile)`)
- **`experimental.ppr` / `experimental.dynamicIO` / `experimental.useCache`** in `next.config.ts` (all three removed, collapsed into `cacheComponents: true`)
- **`middleware.ts`** with `export function middleware(...)` for new code (renamed `proxy.ts` with `export function proxy(...)`)
- **`redirect()` inside `try { ... } catch (e) { ... }`** (the catch swallows the `NEXT_REDIRECT` throw)
- **Server Action with no input validation** (`FormData` values are user-controlled strings)
- **Server Action with no authorization re-check** (page-level auth does NOT protect the action; IDOR)
- **Returning raw DB rows from Server Actions** (leaks `passwordHash`, `isAdmin`, soft-delete flags)
- **`fetch('/api/posts')` from a Server Component** to call your own Route Handler (wasteful round-trip)
- **`useEffect`-based redirect** for auth gating from a Client Component (flash of unauthenticated content)
- **Hardcoded `process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY`** (secrets behind `NEXT_PUBLIC_` are inlined into the client bundle)
- **`useRouter` from `next/router`** (Pages Router; App Router uses `next/navigation`)
- **`serverRuntimeConfig` / `publicRuntimeConfig`** (removed in v16)
- **`next lint`** script in `package.json` (removed in v16, run ESLint or Biome directly)
- **`images.domains: [...]`** (deprecated, use `images.remotePatterns`)
- **`next/legacy/image`** import (deprecated)
- **`<Image quality={90}>`** without 90 in `images.qualities` config (silently coerced to 75)
- **React Context for auth in a Server Component** (Context does not propagate to server children)
- **`error.tsx` next to `layout.tsx`** expecting to catch the layout's throws (it does not)
- **Missing `default.tsx`** in a parallel route slot (build fails in v16)
- **Missing `'use client'`** on `error.tsx` (error boundaries must be Client Components)
- **Custom `webpack` config** in `next.config` without `next build --webpack` (Turbopack is the v16 default)
- **Sass tilde imports** (`@import "~bootstrap/..."`) (Turbopack does not resolve webpack tilde)
- **`useFormStatus` missing** on submit buttons (no pending state, user double-clicks submit)
- **Ad-hoc `revalidatePath`** where a tag-scoped `revalidateTag(tag, 'max')` would be precise
- **Sync `id`** in `generateImageMetadata` callbacks (Promise in v16, was string in v15)

## Why this plugin (vs the existing community Next.js rules)

A short Next.js rule already lives on cursor.directory. It is shallow: a few prompt-style bullets, no BAD / CORRECT TypeScript pairs, no fixtures, no version awareness, and it was last updated for Next.js 13 / 14. This plugin is the depth play, pinned to v16:

- **10 focused rules** - core, anti-patterns, Server Actions, Route Handlers, DAL, Cache Components, proxy + auth, error handling, performance, metadata
- **34 documented anti-patterns** with BAD / CORRECT TypeScript snippets (the existing rule has zero)
- **Vercel's official 2025+ DAL pattern** - `'server-only'`, `cache()`-memoized `verifySession`, per-domain DTOs, `getXForViewing` vs `getXForEditing` naming
- **Three-layer auth model** - `proxy.ts` (optimistic), DAL (`verifySession`, secure), per-consumer re-verify
- **Cache Components** - `'use cache'` directive, `cacheLife` named profiles, `cacheTag`, `revalidateTag(tag, profile)` 2-arg form, `updateTag` for read-your-writes, `refresh` for uncached
- **v16 deltas annotated inline** - every entry tags when the BAD form stopped working (`Removed in v16`, `Renamed in v16`, etc.) so the LLM does not have to guess
- **Reviewer agent** with severity grouping (CRITICAL / ERROR / WARN / SUGGESTION)
- **Compilable fixtures** - `anti-pattern-sample` (12+ tracked violations) and `correct-sample` (gold-standard v16 shape)

## Install

Copy the rules, skills, and agent into your project's Cursor configuration. Back up your existing files first - the plain `cp -r` will overwrite same-named rules.

```bash
git clone https://github.com/RoninForge/roninforge-nextjs.git

# Use -n to avoid clobbering an existing customised rule of the same name.
cp -rn roninforge-nextjs/rules/*  your-project/.cursor/rules/
cp -rn roninforge-nextjs/skills/* your-project/.cursor/skills/
cp -rn roninforge-nextjs/agents/* your-project/.cursor/agents/
```

Or vendor the whole repo as a git submodule under `your-project/.cursor/plugins/`. Refer to the [Cursor plugin docs](https://docs.cursor.com/plugins) for the current global-install path on your Cursor version.

## What's Included

### Rules (10 files)

| Rule | Scope | What it does |
|------|-------|-------------|
| `nextjs-core` | Always active | App Router conventions, Server Components first, `'use client'` boundary, async request APIs, DAL outline, Server Actions outline, Cache Components opt-in, route segment config, file conventions, v16 deltas vs v15 |
| `nextjs-anti-patterns` | Always active | 34 LLM regressions with BAD / CORRECT pairs. Severity-tagged. Each entry annotates when the BAD form stopped working |
| `nextjs-server-actions` | `**/actions.ts`, `**/actions/**/*.ts`, `**/_actions/**/*.ts` | Validate-authorize-mutate-revalidate shape, Zod, `useActionState` + `useFormStatus`, `redirect()` outside try/catch, DTO returns, allowedOrigins, rate limiting |
| `nextjs-route-handlers` | `**/route.ts` | Named-export shape, `RouteContext<'/...'>` typed params (async), `NextResponse.json` / streaming, Zod input validation, DAL session check, CORS + OPTIONS, webhook raw-body-before-JSON for HMAC |
| `nextjs-data-access-layer` | `**/lib/dal/**/*.ts`, `**/lib/auth/**/*.ts`, `**/lib/data/**/*.ts`, `**/_dal/**/*.ts` | `'server-only'`, `cache()`-wrapped `verifySession`, DTO returns, `getXForViewing` vs `getXForEditing` naming, `taintUniqueValue` |
| `nextjs-cache-components` | `next.config.*`, `app/**/page.tsx`, `app/**/layout.tsx`, `app/**/route.ts`, `app/**/actions.ts`, `**/lib/dal/**/*.ts` | `'use cache'` directive, `cacheLife` profiles, `cacheTag`, `revalidateTag(tag, profile)`, `updateTag`, `refresh`, migrating from `unstable_cache` |
| `nextjs-proxy-and-auth` | `**/proxy.ts`, `**/middleware.ts`, `**/auth/**/*.ts`, `**/lib/auth/**/*.ts` | `proxy.ts` rename, three-layer auth (optimistic / secure / per-consumer), cookie discipline, popular auth provider shapes (Auth.js v5, Clerk, Better Auth, WorkOS, Stack Auth, Supabase, Stytch) |
| `nextjs-error-handling` | `app/**/error.tsx`, `app/**/global-error.tsx`, `app/**/not-found.tsx` | Boundary scope rules with ASCII tree, `reset()` callback, why `redirect()` / `notFound()` go outside try/catch, error logging to Sentry / GlitchTip |
| `nextjs-performance` | `app/**/*.tsx`, `components/**/*.tsx`, `next.config.*` | `next/image` (priority, sizes, fill, remotePatterns, qualities), `next/font`, `next/dynamic`, `<Suspense>`, `loading.tsx`, React Compiler opt-in, React 19.2 `<ViewTransition>`, `useEffectEvent`, `<Activity>` |
| `nextjs-metadata` | `app/**/layout.tsx`, `app/**/page.tsx`, `app/**/opengraph-image.tsx`, `app/**/twitter-image.tsx`, `app/**/icon.tsx`, `app/**/sitemap.ts`, `app/**/robots.ts`, `app/**/manifest.ts` | Static `metadata` vs async `generateMetadata`, async params + searchParams in v16, `metadataBase`, file-convention generators, paginated sitemaps, robots `index: false` for staging |

### Skills (5 commands)

| Skill | Command | What it does |
|-------|---------|-------------|
| New page | `/nextjs-page` | Scaffold a Server Component page with async params, `generateMetadata`, Suspense boundary around the slow async child, `loading.tsx`, `error.tsx`. Pushes `'use client'` down |
| New Server Action | `/nextjs-server-action` | Scaffold an action with Zod input validation, `verifySession` + resource ownership re-check, `revalidateTag(tag, 'max')` or `updateTag`, `redirect()` outside try/catch, DTO return, `useActionState` + `useFormStatus` binding |
| New DAL module | `/nextjs-dal` | Scaffold a `lib/dal/<domain>.ts` with `'server-only'`, `cache()`-wrapped `verifySession`, `requireSession`, per-domain DTO functions, `taintUniqueValue` on high-stakes values |
| Validate | `/nextjs-validate` | Grep audit for the tracked anti-patterns: Pages Router APIs, sync `cookies()`/`params`, `useFormState`, single-arg `revalidateTag`, `middleware.ts`, `experimental.ppr`, `redirect()` inside try/catch, `NEXT_PUBLIC_` secret leakage, `images.domains`, `next/legacy/image` |
| Migrate v15 to v16 | `/nextjs-migrate-v15-to-v16` | Runs the official Vercel codemod, then the targeted edits: `middleware.ts` -> `proxy.ts`, `experimental.{ppr,dynamicIO,useCache}` -> `cacheComponents`, `revalidateTag(tag)` -> `revalidateTag(tag, profile)`, `next lint` script removal, `images.domains` -> `remotePatterns`, webpack compat, parallel-route `default.js` audit, `next typegen` |

### Agent (1 subagent)

| Agent | What it does |
|-------|-------------|
| `nextjs-reviewer` | Reviews Next.js 16 + React 19.2 code by severity: critical (security, data loss, app-broken), error (won't compile or wrong runtime), warn (regressions vs modern idioms), suggestion (style + future-proofing) |

## Fixtures

`tests/fixtures/anti-pattern-sample/` is a minimal Next.js project pinned to `next@^15.0.0` (simulating "user has not upgraded yet"). It bundles 12+ tracked violations across the same surface a small App Router app touches: `next.config.ts` with `experimental.ppr`, `experimental.dynamicIO`, `images.domains`, and a custom `webpack` block; `middleware.ts` (v15 name) hitting the DB inline; `app/page.tsx` with sync `cookies()`, sync `params`, hardcoded `process.env.NEXT_PUBLIC_API_SECRET`; `app/posts/[slug]/page.tsx` with sync params and a Pages-Router-style `getServerSideProps`; `app/api/users/route.ts` returning raw DB rows; `app/actions.ts` with no validation, no session check, `redirect()` inside try/catch; `app/posts/page.tsx` with `'use client'` + `useEffect`+`fetch` + `useFormState`; `app/dashboard/layout.tsx` doing the auth check that `app/dashboard/page.tsx` then trusts. Each file is headed with `// Anti-pattern sample. DO NOT use as a template.` plus a numbered list of violations.

`tests/fixtures/correct-sample/` is the same shape rewritten for `next@^16.0.0` + `react@^19.2.0`: `next.config.ts` with `cacheComponents: true` and `images.remotePatterns`; `proxy.ts` (renamed) doing only an optimistic cookie read + redirect; `lib/dal/index.ts` with `'server-only'`, `cache()`-wrapped `verifySession`, `requireSession`; `lib/dal/posts.ts` with `getMyPosts`, `getPostForViewing`, `getPostForEditing` returning DTOs; `app/posts/[slug]/page.tsx` with async params, async-params `generateMetadata`, DAL call, `<Suspense>` around the slow child; `app/api/users/route.ts` with DAL auth + DTO return; `app/actions.ts` with Zod, `verifySession`, ownership check, `revalidateTag('posts', 'max')`, `redirect()` OUTSIDE try/catch, DTO return; `app/posts/new/page.tsx` (Server Component) rendering a Client `<CreatePostForm>` that uses `useActionState` + `useFormStatus`.

## Versioning

Rules target `next@16.0+` on `react@19.2+`. Most patterns work back to 15.x with the deltas called out inline (`Removed in v16`, `Renamed in v16`, `Required 2-arg in v16`). Where the rule cites a feature version (`useActionState` 19.0, `<ViewTransition>` 19.2, Cache Components stable 16.0, `proxy.ts` 16.0, `revalidateTag` 2-arg 16.0), verify against the changelog for the version you have installed before adopting.

## License

MIT - see [LICENSE](LICENSE)

## Links

- [Next.js docs](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)
- [Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [Data Access Layer](https://nextjs.org/docs/app/guides/authentication#data-access-layer-dal)
- [Server Actions](https://nextjs.org/docs/app/api-reference/functions/server-actions)
- [proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Cursor Plugin Documentation](https://docs.cursor.com/plugins)
- [RoninForge](https://roninforge.org)
