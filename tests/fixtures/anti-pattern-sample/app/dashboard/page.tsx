// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. Trusts the layout's auth check (no re-verification in the page; partial-render bypass)
// 2. Returns raw DB rows directly into the rendered tree (no DTO shaping)
// 3. Component is not async despite awaiting data (would compile but the synchronous
//    return type forbids top-level await)

import { db } from '@/lib/db';

export default async function DashboardPage() {
  const allUsers = await db.user.findMany();
  return (
    <div>
      <h1>Dashboard</h1>
      <pre>{JSON.stringify(allUsers, null, 2)}</pre>
    </div>
  );
}
