import { cookies } from 'next/headers';

// Anti-pattern: params as sync object (must be Promise in 15)
export default function DashboardPage({
  params,
  searchParams,
}: {
  params: { tab: string };         // Anti-pattern: not Promise
  searchParams: { filter: string }; // Anti-pattern: not Promise
}) {
  // Anti-pattern: sync cookies (must await in 15)
  const cookieStore = cookies();
  const token = cookieStore.get('auth');

  return <div>Dashboard: {params.tab}, filter: {searchParams.filter}</div>;
}
