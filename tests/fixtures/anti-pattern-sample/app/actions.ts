// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. No input validation (FormData values are user-controlled strings, treated as trusted)
// 2. No session check (Server Action is a POST endpoint, reachable by URL; IDOR risk)
// 3. redirect() inside try/catch (NEXT_REDIRECT throw is swallowed by the catch)
// 4. Returns raw DB row (leaks passwordHash, isAdmin, soft-delete flags)
// 5. Uses revalidateTag with a single argument (deprecated in v16, requires (tag, profile))

'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const body = formData.get('body') as string;
  const authorId = formData.get('authorId') as string;

  try {
    const post = await db.post.create({
      data: { title, body, authorId },
    });
    revalidateTag('posts');
    redirect(`/posts/${post.id}`);
    return post;
  } catch (e) {
    console.error(e);
  }
}
