// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. Sync cookies() (TypeError in v16, cookies() returns Promise)
// 2. Sync params destructure (TypeError in v16, params is Promise<{...}>)
// 3. Hardcoded NEXT_PUBLIC_API_SECRET (secrets behind NEXT_PUBLIC_ are inlined into the client bundle)
// 4. Function is not async despite reading async-only request APIs

import { cookies } from 'next/headers';

type PageProps = { params: { locale: string }; searchParams: { ref?: string } };

export default function HomePage({ params, searchParams }: PageProps) {
  const theme = cookies().get('theme')?.value ?? 'light';
  const ref = searchParams.ref ?? 'direct';

  const apiKey = process.env.NEXT_PUBLIC_API_SECRET;
  fetch(`https://api.example.com/visits?ref=${ref}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return (
    <main data-theme={theme}>
      <h1>Home ({params.locale})</h1>
    </main>
  );
}
