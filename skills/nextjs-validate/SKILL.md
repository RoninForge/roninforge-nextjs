---
name: nextjs-validate
description: "Grep audit for the tracked Next.js 16 anti-patterns: Pages Router APIs (getServerSideProps, pages/api), 'use client' on layouts, sync cookies()/params, useFormState (deprecated), single-arg revalidateTag (TS error in v16), middleware.ts for new code, experimental.ppr/dynamicIO/useCache flags, redirect() inside try/catch, fetch caching assumption, NEXT_PUBLIC_ env leakage, images.domains, next/legacy/image, hardcoded webpack config. Run from repo root; manual triage required for context-sensitive matches."
---

# Validate a Next.js 16 Project

## When to Use

Use when:

- Auditing a project that is claimed to be Next.js 16 ready.
- Reviewing a PR that touches files under `app/`, `proxy.ts`, `next.config.*`, or `lib/dal/`.
- Promoting a build from staging to production.
- Onboarding a codebase you have not seen before and want a quick read on its Next.js 15 -> 16 hygiene.

The audit is grep-based. It finds candidates; you decide which ones are real. Heuristic matches (especially `'use client'` on what looks like a layout) need a human eye.

## Scope

Run from the repo root. Patterns assume the App Router (`app/` directory). If the project has a `src/app/` layout, replace `app/` with `src/app/` in the commands.

Severity tags:

- **CRITICAL**: bug that ships exploits, secrets, or runtime crashes on cold start. Fix before anything else.
- **ERROR**: TypeScript or runtime error in v16. The build is broken or the feature does not work.
- **WARN**: deprecated, fragile, or about to bite. Fix this sprint.

## Grep compatibility note

`grep -P` (Perl-compatible regex) is GNU-only. On macOS the default `grep` is BSD and does not support `-P`. Use the portable `-E` (extended regex) for everything below. Where a pattern genuinely needs PCRE, the section flags it and provides a BSD-friendly alternative.

A handy alias for the session:

```bash
# If you have ripgrep, it works everywhere and is faster:
alias rg='rg --hidden --glob "!node_modules" --glob "!.next" --glob "!build" --glob "!dist"'
```

The skill uses portable `grep` below. Swap in `rg` if you have it.

## CRITICAL: Pages Router APIs

```bash
grep -rEn "getServerSideProps|getStaticProps|getInitialProps" \
  app/ src/ pages/ 2>/dev/null
```

Any hit is a Pages Router pattern. In App Router, convert to an async Server Component with a direct `await`.

```bash
# pages/api remnants
find pages/api -type f 2>/dev/null
```

Any file under `pages/api/` is a Pages Router route handler. Move to `app/<path>/route.ts` with named-export `GET` / `POST` / etc. See the `nextjs-route-handlers` rule.

## CRITICAL: `NEXT_PUBLIC_` env used for secrets

Any env var prefixed `NEXT_PUBLIC_` is inlined into the client bundle at build time. A secret with that prefix is shipped to every browser.

```bash
grep -rEn "NEXT_PUBLIC_[A-Z_]*(SECRET|TOKEN|KEY|PASSWORD|PRIVATE|CREDENTIAL)" \
  app/ src/ lib/ 2>/dev/null
```

Any hit needs triage. Some `NEXT_PUBLIC_*_KEY` values are legitimate (e.g. a Stripe publishable key), but if the name contains `SECRET`, `PRIVATE`, or `PASSWORD`, it is almost certainly a bug. Move to a non-`NEXT_PUBLIC_` env var read only from a `server-only` module.

## CRITICAL: `redirect()` inside `try { ... } catch (e) { ... }`

`redirect()` works by throwing `NEXT_REDIRECT`. A `try / catch` block intercepts that throw and the redirect dies silently.

```bash
# Heuristic: any file that has both `redirect(` and a try/catch, then human-triage.
# This will have false positives - manual review required.
grep -rEln "redirect\(" app/ src/ 2>/dev/null \
  | xargs -I {} grep -lE "try\s*\{" {} 2>/dev/null
```

For each candidate file, open it and verify whether the `redirect()` call sits inside the try-block. If it does, move it after the try/catch. See the `nextjs-server-actions` rule entry on this pattern.

## CRITICAL: hardcoded credentials in committed files

```bash
grep -rEn "(sk_live_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xoxb-[A-Za-z0-9-]+|-----BEGIN .* PRIVATE KEY-----)" \
  app/ src/ lib/ 2>/dev/null
```

Any hit is a leaked secret. Rotate the credential and remove from git history (`git filter-repo` or BFG), not just from the working tree.

## ERROR: sync `cookies()` / `headers()` / `draftMode()`

These have been async since v15. In v16 the sync form is a TypeScript error. The codemod catches most of these, but custom wrappers slip through.

```bash
# Sync .get / .set / .has / .delete chained directly off the function call.
# Excludes the legitimate `await cookies()` / `(await cookies())` form.
grep -rEn "(^|[^a-zA-Z_])(cookies|headers|draftMode)\(\)\.(get|set|has|delete|entries|getAll)" \
  app/ src/ lib/ 2>/dev/null \
  | grep -vE "await\s+(cookies|headers|draftMode)\(\)"
```

Replace with the awaited form:

```typescript
// BEFORE
const theme = cookies().get('theme')?.value;

// AFTER
const cookieStore = await cookies();
const theme = cookieStore.get('theme')?.value;
```

## ERROR: sync `params` destructure

```bash
# Heuristic: page / layout / route props typed as { params: { ... } } without Promise<...>
grep -rEn "params:\s*\{[^}]*:\s*string" app/ src/ 2>/dev/null
```

Any hit where `params` is typed as a plain object rather than `Promise<...>` is a v16 TypeError. Fix:

```typescript
// BEFORE
export default async function Page({ params }: { params: { slug: string } })

// AFTER
export default async function Page({ params }: { params: Promise<{ slug: string }> })
const { slug } = await params;

// OR (after next typegen)
import type { PageProps } from 'next';
export default async function Page({ params }: PageProps<'/blog/[slug]'>)
```

Same shape for `searchParams`, for `route.ts` handler `ctx.params`, and for the `id` argument in `generateImageMetadata` callbacks.

## ERROR: `useFormState` from `react-dom`

Deprecated in React 19 and moved to `react` as `useActionState`.

```bash
grep -rEn "from\s+['\"]react-dom['\"];?[^}]*\buseFormState\b|\buseFormState\b[^}]*from\s+['\"]react-dom['\"]" \
  app/ src/ 2>/dev/null
```

A simpler scan that catches most cases:

```bash
grep -rEn "useFormState" app/ src/ 2>/dev/null
```

Replace:

```typescript
// BEFORE
import { useFormState } from 'react-dom';
const [state, formAction] = useFormState(action, initial);

// AFTER
import { useActionState } from 'react';
const [state, formAction, pending] = useActionState(action, initial);
```

## ERROR: single-arg `revalidateTag`

In v16 the call requires a profile or inline expiry.

```bash
# Match revalidateTag( ... ) with NO comma between the parens.
grep -rEn "revalidateTag\([^,)]+\)" app/ src/ lib/ 2>/dev/null
```

Fix:

```typescript
// BEFORE
revalidateTag('posts');

// AFTER
revalidateTag('posts', 'max');
revalidateTag('posts', { expire: 3600 });
// OR, inside a Server Action with read-your-writes:
updateTag('posts');
```

## ERROR: `fetch()` cached-by-default assumption

Starting v15, `fetch()` does NOT cache by default. With `cacheComponents: true` (v16), nothing caches unless you opt in.

```bash
# Heuristic: fetch() calls inside DAL / lib files without an adjacent 'use cache'.
# Manual review required - many calls are correctly un-cached.
grep -rEnB 2 -A 5 "fetch\(" lib/ app/ 2>/dev/null \
  | grep -B 6 "fetch\(" \
  | grep -v "'use cache'"
```

This one has false positives. Look at the call site: if the function is expected to be cached (product catalog, public prices, etc.) but has neither `'use cache'` nor `{ next: { revalidate: ... } }`, that is a bug. See the `nextjs-cache-components` rule.

## ERROR: `experimental.ppr` / `experimental.dynamicIO` / `experimental.useCache` flags

Removed in v16. Setting any of them is a config error.

```bash
grep -rEn "experimental_ppr|experimental\.\s*(ppr|dynamicIO|useCache)" \
  next.config.* app/ src/ 2>/dev/null
```

Replace at the top level:

```typescript
// BEFORE
const config = { experimental: { ppr: true, dynamicIO: true, useCache: true } };

// AFTER
const config = { cacheComponents: true };
```

And remove route-level escape hatches:

```typescript
// app/some-route/page.tsx
export const experimental_ppr = true; // DELETE
```

## ERROR: `useEffect` + `fetch` for server data

```bash
# Heuristic: a 'use client' file with both useEffect and fetch in close proximity.
# Manual review required.
grep -rEln "^'use client'" app/ src/ 2>/dev/null \
  | xargs -I {} sh -c "grep -lE 'useEffect' {} 2>/dev/null && grep -lE 'fetch\\(' {} 2>/dev/null" \
  | sort -u
```

For each candidate, check whether the fetch could be done in a Server Component instead. SWR / TanStack Query for genuinely client-side dynamic data is fine; `useEffect(() => fetch('/api/own-route'))` for static-shaped server data is the bug.

## WARN: `'use client'` on layouts (heuristic)

A `'use client'` at the top of a `layout.tsx` forces the entire subtree client-side. The grep is a candidate finder; manual review confirms.

```bash
# Find layouts and check whether they start with 'use client'.
find app -name 'layout.tsx' -o -name 'layout.jsx' 2>/dev/null \
  | xargs grep -lE "^'use client'" 2>/dev/null
```

For each hit, decide:

- The layout is a client wrapper for context providers - acceptable IF the providers genuinely need to wrap the whole subtree (theme, query client, error boundary).
- The layout could be a Server Component with a small Client Component child - refactor. See the `nextjs-anti-patterns` rule entry #2.

Same heuristic for `page.tsx`:

```bash
find app -name 'page.tsx' -o -name 'page.jsx' 2>/dev/null \
  | xargs grep -lE "^'use client'" 2>/dev/null
```

A `'use client'` on a `page.tsx` is almost always wrong - push the directive to the smallest interactive component inside the page.

## WARN: `middleware.ts` for new code

The file was renamed to `proxy.ts` in v16. `middleware.ts` still works for the Edge-runtime case but is deprecated.

```bash
ls middleware.ts middleware.js 2>/dev/null
ls proxy.ts proxy.js 2>/dev/null
```

If `middleware.ts` exists and there is no specific Edge-runtime reason for it, run `git mv middleware.ts proxy.ts` and rename the exported function (`middleware` -> `proxy`). Also check:

```bash
grep -rEn "skipMiddlewareUrlNormalize" next.config.* 2>/dev/null
```

That flag is renamed to `skipProxyUrlNormalize`. The old flag silently does nothing in v16. See the `nextjs-migrate-v15-to-v16` skill for the full sequence.

## WARN: `images.domains`

Deprecated in v15, removed in v16.

```bash
grep -rEn "images:\s*\{[^}]*domains" next.config.* 2>/dev/null
```

Replace with `images.remotePatterns`:

```typescript
// BEFORE
images: { domains: ['cdn.example.com'] }

// AFTER
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
  ],
}
```

## WARN: `next/legacy/image` import

```bash
grep -rEn "from\s+['\"]next/legacy/image['\"]" app/ src/ 2>/dev/null
```

Replace with `next/image`.

## WARN: `next lint` in scripts

Removed in v16.

```bash
grep -En '"lint":\s*"next lint"' package.json 2>/dev/null
```

Replace with `eslint .` directly. A codemod is available:

```bash
npx @next/codemod@latest next-lint-to-eslint-cli
```

## WARN: custom `webpack` config without `--webpack`

Turbopack is the default. A `webpack: (config) => ...` block in `next.config.ts` causes `next build` to fail unless you run with `--webpack`.

```bash
grep -rEn "webpack:\s*\(?[a-zA-Z_]" next.config.* 2>/dev/null
grep -En "next build.*--webpack" package.json 2>/dev/null
```

If the first command hits and the second does not, the build is broken. Either add `--webpack` to the build script or migrate the customization to a top-level `turbopack` config. See the `nextjs-migrate-v15-to-v16` skill.

## WARN: `serverRuntimeConfig` / `publicRuntimeConfig`

Removed in v16.

```bash
grep -rEn "serverRuntimeConfig|publicRuntimeConfig|next/config" \
  app/ src/ lib/ next.config.* 2>/dev/null
```

Replace with `process.env.*` reads.

## Output format

For each finding, write one line:

```
<file>:<line> - <severity> - <problem> - <fix>
```

Example:

```
app/blog/[slug]/page.tsx:12 - ERROR - sync params destructure - type as Promise<...> and await
app/posts/actions.ts:34 - ERROR - revalidateTag single-arg - add 'max' or migrate to updateTag
next.config.ts:8 - ERROR - experimental.ppr flag - replace with top-level cacheComponents: true
proxy.ts: missing - WARN - new code lives in proxy.ts; this repo has middleware.ts - rename
```

End the report with a summary count:

```
3 CRITICAL, 7 ERROR, 4 WARN
```

If there are zero CRITICAL and zero ERROR findings, the project clears the v16 build gate. WARN items are sprint work, not blockers.

## What this skill does NOT catch

- **Suspense placement quality.** Whether the `<Suspense>` boundary wraps the right child requires reading the page's data-flow, not a grep.
- **DAL coverage completeness.** Whether every Server Component that reads user data goes through the DAL needs a code-review pass, not a pattern match.
- **Real auth bugs inside actions.** The grep finds `verifySession` calls but cannot verify the ownership check is correct for the resource being mutated. See the `nextjs-server-actions` and `nextjs-data-access-layer` rules.
- **Logic errors.** A correctly-shaped Server Action with bad business logic looks fine to the validator.
- **Performance issues that require benchmarks.** This is a static audit. For Core Web Vitals work, use a real performance tool against a built artifact.
- **Cache-key correctness for per-user data.** A `'use cache'` function that captures `userId` from a closure rather than taking it as an argument is a bug the audit does not flag.

## Companion rules

- `nextjs-core` for the v16 deltas vs v15.
- `nextjs-anti-patterns` for the inverse-pattern reference.
- `nextjs-cache-components` for the `cacheComponents` opt-in caching model.
- `nextjs-server-actions` for the action-level pattern.
- `nextjs-data-access-layer` for DAL coverage requirements.
- `nextjs-proxy-and-auth` for the three-layer auth model.
- `nextjs-route-handlers` for `app/**/route.ts` shape.
