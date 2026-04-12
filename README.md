# roninforge-nextjs

[![Validate Plugin](https://github.com/RoninForge/roninforge-nextjs/actions/workflows/validate.yml/badge.svg)](https://github.com/RoninForge/roninforge-nextjs/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/RoninForge/roninforge-nextjs)](https://github.com/RoninForge/roninforge-nextjs/releases)

Cursor plugin for Next.js 15 App Router. Prevents Pages Router hallucinations, teaches async request APIs, Server Components, Server Actions, the 4-tier caching system, and React 19 patterns.

## The Problem

Next.js 15 shipped with breaking changes that LLMs don't know about:

- **`cookies()`, `headers()`, `params`, `searchParams` are now async** (must await, crashes without it)
- **`fetch()` is NOT cached by default** (was cached in 14, silently returns stale data)
- **GET Route Handlers are NOT cached by default** (was cached in 14)
- **`useFormState` is deprecated** (use `useActionState` from React 19)
- LLMs generate **Pages Router patterns** (`getServerSideProps`, `getStaticProps`, `next/router`) in App Router projects
- LLMs place **`'use client'` on layouts and pages** (makes entire subtree client-rendered)
- LLMs use **`useEffect` + `fetch`** for data that should be server-fetched
- LLMs **fetch their own Route Handlers** from Server Components (unnecessary network hop)
- LLMs put **`redirect()` inside try/catch** (it throws internally)
- LLMs skip **revalidation after mutations** (data stays stale)

## Install

```bash
git clone https://github.com/RoninForge/roninforge-nextjs.git ~/.cursor/plugins/local/roninforge-nextjs
```

Or copy into your project:

```bash
git clone https://github.com/RoninForge/roninforge-nextjs.git
cp -r roninforge-nextjs/rules/* your-project/.cursor/rules/
cp -r roninforge-nextjs/skills/* your-project/.cursor/skills/
cp -r roninforge-nextjs/agents/* your-project/.cursor/agents/
```

## What's Included

### Rules (5 files)

| Rule | Scope | What it does |
|------|-------|-------------|
| `nextjs-15-core` | Always active | Async APIs, caching defaults, Server Components, Server Actions, React 19 |
| `nextjs-15-anti-patterns` | Always active | 12 AI mistakes: Pages Router patterns, "use client" misplacement, stale caching |
| `nextjs-15-server` | Action files | Server Component data fetching, Server Action patterns, "use client" boundary strategy |
| `nextjs-15-routing` | Page/route files | File conventions, metadata API, dynamic routes, loading/error states |
| `nextjs-15-caching` | Agent-requested | 4-tier caching system, revalidation patterns, v14 vs v15 defaults |

### Skills (4 commands)

| Skill | Command | What it does |
|-------|---------|-------------|
| Page | `/nextjs-page` | Scaffold page with async params, metadata, loading/error states |
| API | `/nextjs-api` | Generate Route Handler with caching config |
| Validate | `/nextjs-validate` | Scan for Pages Router and v14 patterns |
| Migrate | `/nextjs-migrate` | Pages Router to App Router or v14 to v15 migration |

### Agent (1 subagent)

| Agent | What it does |
|-------|-------------|
| `nextjs-reviewer` | Reviews for async API usage, caching, component boundaries, Server Action security |

## What Makes This Different

**vs. the 10+ community .cursorrules:**
- **Zero community rules cover Next.js 15 async APIs** (the #1 runtime crash)
- **Zero community rules cover the caching default flip** (fetch uncached in 15)
- **Zero community rules cover React 19 hooks** (useActionState replacing useFormState)
- We provide the complete 4-tier caching decision tree, not just "use caching"
- Migration skill for both Pages->App Router and v14->v15

## License

MIT - see [LICENSE](LICENSE)

## Links

- [Next.js 15 Blog](https://nextjs.org/blog/next-15)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Vercel: Common App Router Mistakes](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)
- [Cursor Plugin Documentation](https://docs.cursor.com/plugins)
- [RoninForge](https://roninforge.org)
