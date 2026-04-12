import { revalidateTag } from 'next/cache';

// Correct: params typed as Promise, explicit caching
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  const users = await fetch(
    `https://api.example.com/users?page=${page}&limit=${limit}`,
    { next: { revalidate: 60, tags: ['users'] } },
  ).then(r => r.json());

  return Response.json(users);
}

// Correct: mutation with revalidation
export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.user.create({ data: body });

  revalidateTag('users');

  return Response.json(user, { status: 201 });
}
