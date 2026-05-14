# Changelog

## v2.0.0 - 2026-05-14

First Next.js 16 release. Complete rebuild from v1.0.1. Pinned to `next@16.0+` on `react@19.2+`.

### Added

- 10 rules:
  - `nextjs-core` - App Router conventions, Server Components, async request APIs, file conventions, v16 deltas vs v15
  - `nextjs-anti-patterns` - 34 LLM regressions with BAD / CORRECT TypeScript pairs (up from 12 in v1.0.1)
  - `nextjs-server-actions` - validate-authorize-mutate-revalidate, Zod, `useActionState` + `useFormStatus`, `redirect()` outside try/catch, DTO returns
  - `nextjs-route-handlers` - named-export shape, async params (`RouteContext<'/...'>`), Zod input validation, webhook HMAC raw-body-first
  - `nextjs-data-access-layer` - `'server-only'`, `cache()`-wrapped `verifySession`, per-domain DTO functions, `taintUniqueValue`
  - `nextjs-cache-components` - `'use cache'` directive, `cacheLife`, `cacheTag`, `revalidateTag(tag, profile)` 2-arg form, `updateTag`, `refresh`
  - `nextjs-proxy-and-auth` - `proxy.ts` rename, three-layer auth (optimistic / secure / per-consumer), popular auth provider shapes
  - `nextjs-error-handling` - boundary scope tree, `reset()`, why `redirect()`/`notFound()` go outside try/catch
  - `nextjs-performance` - `next/image`, `next/font`, `next/dynamic`, `<Suspense>`, React Compiler, React 19.2 features
  - `nextjs-metadata` - static `metadata` vs async `generateMetadata`, file-convention generators, `metadataBase`
- 5 skills: `/nextjs-page`, `/nextjs-server-action`, `/nextjs-dal`, `/nextjs-validate`, `/nextjs-migrate-v15-to-v16`
- 1 reviewer agent (`nextjs-reviewer`) with severity grouping (CRITICAL / ERROR / WARN / SUGGESTION)
- Fixture projects: `anti-pattern-sample` (12+ tracked violations, pinned to `next@^15.0.0`) and `correct-sample` (gold-standard v16 shape)
- POSIX validation script and GitHub Actions CI workflow

### Major changes from v1.0.1

- **Cache Components** replaces the v15 `experimental.ppr` / `experimental.dynamicIO` / `experimental.useCache` flags with the single top-level `cacheComponents: true`. The `'use cache'` directive plus `cacheLife` / `cacheTag` are the new shape.
- **`proxy.ts`** replaces `middleware.ts` at the root. Named export renamed from `middleware` to `proxy`. Node.js runtime only. `middleware.ts` still works for Edge but is deprecated.
- **Async request APIs** fully enforced. `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams`, and the `id` in `generateImageMetadata` are all Promises in v16. Sync access is a TypeError.
- **Data Access Layer** is Vercel's officially recommended 2025+ pattern and now has a dedicated rule + skill. Three-layer auth (`proxy.ts` optimistic, DAL secure, per-consumer re-verify).
- **34 anti-patterns** up from 12. Adds `proxy.ts` rename, `revalidateTag` 2-arg, Cache Components flags, Server Action IDOR, raw DB row returns, `redirect()` in try/catch, NEXT_PUBLIC_ secret leakage, `images.qualities` coercion, custom webpack without `--webpack`, parallel-route `default.js`, Sass tilde imports, more.
- **Reviewer agent** now severity-grouped. Same shape as the `roninforge-playwright` reviewer.
- **Fixtures** are now full Next.js project skeletons (not isolated snippets). The `anti-pattern-sample` is pinned to `next@^15.0.0` to simulate "user has not upgraded yet"; the `correct-sample` is pinned to `next@^16.0.0`.

The v1.0.1 (Next.js 15) plugin is preserved in git history at tag `v1.0.1`.

## v1.0.1 - 2026-04-12

Patch release. See v1.0.0 entry for the feature set.

## v1.0.0 - 2026-04-12

First release. Next.js 15 App Router rules, 12 anti-patterns, 4 skills, 1 reviewer agent. Targeted `next@15` with async request APIs and the v14-to-v15 fetch caching default flip.
