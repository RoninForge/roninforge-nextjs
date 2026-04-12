import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Correct: params and searchParams as Promise, awaited
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const cookieStore = await cookies();
  const token = cookieStore.get('auth');

  if (!token) {
    redirect('/login');
  }

  const data = await db.dashboard.getData({
    userId: token.value,
    filter,
  });

  return <div>Dashboard: {JSON.stringify(data)}</div>;
}
