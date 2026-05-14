// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. Auth check only in the layout; the page below trusts it and hits the DB directly
//    (Server Actions and Route Handlers under /dashboard are NOT protected by this check)
// 2. Sync cookies() (TypeError in v16)

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) {
    redirect('/login');
  }
  return <section>{children}</section>;
}
