---
name: nextjs-migrate-v15-to-v16
description: "Migrate a Next.js 15 codebase to 16. Runs the official Vercel codemod, then the targeted edits: middleware.ts → proxy.ts rename, experimental.{ppr,dynamicIO,useCache} → cacheComponents flag, revalidateTag(tag) → revalidateTag(tag, profile), package.json next lint script removal, images.domains → remotePatterns, webpack config compatibility (use --webpack flag or migrate to turbopack config), parallel route default.js audit. Regenerate types with next typegen. Smoke-test."
---

# Migrate a Next.js 15 Codebase to Next.js 16

## When to Use

Use when ready to move a project from 15.x to 16.x. Status note: 16.0 has been stable since October 2025. The codemod handles the mechanical parts (async cookies/headers, async params, `useFormState` -> `useActionState`); this skill handles the remaining renames, flag collapses, and TypeScript errors that the codemod cannot catch automatically.

Target outcome: `pnpm build` (or `npm run build`) passes on `next@^16.0.0`, `react@^19.2.0`, `react-dom@^19.2.0`, with `next typegen` regenerated and the Turbopack default bundler.

Do this on a branch. The migration touches build config, types, and the entire `middleware.ts` shape - keep a clean rollback path.

## Step 1: pin v16 and run the codemod

```bash
pnpm add next@^16 react@^19.2 react-dom@^19.2
pnpm add -D @types/react@^19.2 @types/react-dom@^19.2

npx @next/codemod@latest upgrade latest
```

What the codemod handles for you:

- `cookies()` / `headers()` / `draftMode()` -> awaited.
- Page / layout / route-handler `params` and `searchParams` -> typed as `Promise<...>` and awaited.
- `useFormState` from `react-dom` -> `useActionState` from `react` (verify - the codemod has edge cases on multi-line imports).
- A few smaller renames.

Review the diff. The codemod is good but not perfect on edge cases:

- Custom `params`-handling helpers it does not recognize.
- Re-exports of `cookies` from a barrel file.
- `useFormState` imported under an alias.

Run `git diff` and patch the misses by hand.

## Step 2: rename `middleware.ts` -> `proxy.ts`

```bash
git mv middleware.ts proxy.ts
```

Inside the file, rename the exported function:

```typescript
// BEFORE - middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

// AFTER - proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  return NextResponse.next();
}
```

In `next.config.ts`, rename the URL-normalize config flag:

```typescript
// BEFORE
const config = {
  skipMiddlewareUrlNormalize: true,
};

// AFTER
const config = {
  skipProxyUrlNormalize: true,
};
```

`middleware.ts` still works in v16 for the Edge-runtime case but is deprecated. New code goes in `proxy.ts`, which runs on the Node.js runtime only. See the `nextjs-proxy-and-auth` rule for the full pattern.

## Step 3: collapse the experimental cache flags

Three flags collapsed into one. If any of the old flags are present, the v16 config validator throws.

```typescript
// BEFORE - next.config.ts
const config = {
  experimental: {
    ppr: true,
    dynamicIO: true,
    useCache: true,
  },
};

// AFTER
const config = {
  cacheComponents: true,
};
```

Search for the route-level escape hatch and remove it too:

```bash
grep -rn "experimental_ppr" app/ src/ 2>/dev/null
```

```typescript
// BEFORE - app/some-route/page.tsx
export const experimental_ppr = true;

// AFTER - delete the line. PPR runs as an internal mechanism with
// cacheComponents enabled.
```

See the `nextjs-cache-components` rule for the v16 caching model.

## Step 4: fix `revalidateTag` arity

In v16 `revalidateTag(tag)` is a TypeScript error. It now requires a profile argument.

Find every call:

```bash
# GNU grep
grep -rEn "revalidateTag\([^,)]+\)" app/ src/ lib/ 2>/dev/null

# BSD grep (macOS default) - same flags work
grep -rEn "revalidateTag\([^,)]+\)" app/ src/ lib/ 2>/dev/null
```

Decide per-call:

```typescript
// BEFORE
revalidateTag('posts');

// AFTER - out-of-band invalidation, next read renders fresh
revalidateTag('posts', 'max');

// AFTER - inline expiry override
revalidateTag('posts', { expire: 3600 });

// AFTER - inside a Server Action where the user expects to see their own write
//          reflected in this same response
updateTag('posts');
```

`'max'` is the safe default - never expires after refresh until the next explicit revalidate. Use `updateTag` for read-your-writes inside a Server Action.

## Step 5: audit parallel routes

Every `@slot/` directory needs a `default.tsx` (or `default.js`). In v15 a missing default was a soft warning; in v16 the build fails.

Find them:

```bash
find app -type d -name '@*'
```

For each, ensure a sibling `default.tsx` exists:

```typescript
// app/@modal/default.tsx
export default function Default() {
  return null; // empty slot is fine; the file just has to exist
}
```

If the slot has dynamic routes (`@modal/(.)photos/[id]/page.tsx` and similar), the `default.tsx` still lives at the slot root, not at each leaf.

## Step 6: package.json cleanup

`next lint` was removed in v16. Run ESLint directly.

```jsonc
// BEFORE
{
  "scripts": {
    "lint": "next lint"
  }
}

// AFTER
{
  "scripts": {
    "lint": "eslint . --max-warnings=0"
  }
}
```

A codemod is available if you have a custom `next lint` config:

```bash
npx @next/codemod@latest next-lint-to-eslint-cli
```

It migrates the ESLint config to a flat-config-ready shape.

## Step 7: `images.domains` -> `images.remotePatterns`

Deprecated in v15, removed in v16.

```typescript
// BEFORE
const config = {
  images: {
    domains: ['cdn.example.com', 'images.unsplash.com'],
  },
};

// AFTER
const config = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
};
```

Also check `<Image>` usages for `quality={N}` where `N` is not in the default `images.qualities` array (`[75]`). In v16 the value is coerced silently. Either add the value to `images.qualities` or drop the prop.

## Step 8: webpack config compatibility

Turbopack is the default bundler in v16. A `webpack: (config) => { ... }` block in `next.config.ts` causes `next build` to fail unless you explicitly opt in to webpack.

```typescript
// PRESENT - any custom webpack config
const config = {
  webpack: (cfg) => {
    cfg.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return cfg;
  },
};
```

Two options:

```jsonc
// OPTION A - keep webpack, explicitly. Slowest, simplest migration.
// package.json
{ "scripts": { "build": "next build --webpack", "dev": "next dev --webpack" } }
```

```typescript
// OPTION B - migrate the customization to the top-level turbopack config.
const config = {
  turbopack: {
    resolveAlias: { '@': './src' },
    rules: {
      // SVG-as-component, etc.
    },
  },
};
```

If the project uses SCSS with tilde imports (`@import "~bootstrap/..."`), Turbopack does not resolve those. Drop the tilde: `@import "bootstrap/scss/bootstrap"`. Or stay on webpack with `--webpack`.

## Step 9: regenerate types

```bash
npx next typegen
```

This regenerates `.next/types/...` and unlocks the typed-route helpers:

```typescript
import type { PageProps, LayoutProps, RouteContext } from 'next';

export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params;
  // ...
}
```

If you use the explicit typed-route helpers, this step is mandatory. If you stick with hand-written `{ params: Promise<{ slug: string }> }` types, `next typegen` is still nice-to-have.

## Step 10: smoke-test

In order:

1. **`pnpm build`** (or `npm run build`). Should pass with Turbopack. TypeScript errors here usually mean a missed `revalidateTag` arity fix or a sync `params` destructure the codemod missed.
2. **Boot the dev server.** `pnpm dev`. Hit the home page, hit a dynamic route, hit a route that uses cookies.
3. **`proxy.ts` smoke**: log in, log out, hit a protected route while logged out (should redirect), hit `/login` while logged in (should redirect). All the previous `middleware.ts` paths.
4. **Cached pages**: any page with `'use cache'` or that previously used `experimental.ppr`. Verify the cache headers, verify the page paints.
5. **Server Actions**: submit one create form, one update form, one delete form. Verify the `revalidateTag` runs, verify `redirect()` after the try/catch still navigates.
6. **Route Handlers**: any external-facing endpoint, especially webhook receivers. Async `params` destructure is the most common miss.
7. **Playwright / E2E suite** if you have one. Run it.

## Rollback plan

The migration is one branch. To roll back:

```bash
git checkout main
git branch -D feat/migrate-to-next-16     # or whatever you named the branch
pnpm install                              # restores the v15 lockfile
```

If the migration is partially merged and a production rollback is needed:

```bash
# Pin back to v15.x in package.json
pnpm add next@~15.5 react@~19.0 react-dom@~19.0
# Restore the v15-shaped config flags
# Restore middleware.ts (the proxy.ts -> middleware.ts inverse)
```

Keep the v15 lockfile in the rollback PR. Do not try a half-and-half repo with some routes on the v16 shape and some on v15.

## What NOT to do

- **Do not mix v15 and v16 patterns in one repo.** A `revalidateTag('posts')` single-arg call sitting next to a `revalidateTag('posts', 'max')` call is a TypeScript error, not a smooth transition.
- **Do not disable Turbopack via webpack config without the `--webpack` flag.** A `webpack: (config) => ...` block alone is not enough; the script must pass `--webpack`.
- **Do not edit the codemod's work without re-running it.** If the codemod missed a file (rare), patch by hand. If it changed a file incorrectly (very rare), revert that file and re-run the codemod after fixing the upstream cause.
- **Do not skip `next typegen`.** The typed-route helpers (`PageProps<'/blog/[slug]'>`, `RouteContext<'/users/[id]'>`) depend on the generated types. Skipping leaves you with `Property 'slug' does not exist on type 'unknown'` errors that look like real bugs.
- **Do not roll out v16 to production without smoking the proxy.ts redirects.** The middleware -> proxy rename is the most likely place for a regression that is invisible in local dev (e.g. a typo in the new export name silently falls back to "no proxy at all").
- **Do not keep `middleware.ts` "for the Edge runtime case" without a concrete reason.** New code goes in `proxy.ts`. Keeping the old file around guarantees the LLM you ask to add a new redirect will generate it in the wrong file.

## Companion rules

- `nextjs-core` for the v15 -> v16 deltas at a glance.
- `nextjs-anti-patterns` for the inverse patterns the migration eliminates.
- `nextjs-cache-components` for the new caching model.
- `nextjs-proxy-and-auth` for `proxy.ts` shape and the three-layer auth model.
- `nextjs-server-actions` for the `revalidateTag` arity and `updateTag` semantics.
