'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createPost(prevState: any, formData: FormData) {
  // 1. Authenticate
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (!session) {
    return { error: 'Not authenticated' };
  }

  // 2. Validate
  const title = formData.get('title') as string;
  if (!title || title.length < 3) {
    return { error: 'Title must be at least 3 characters' };
  }

  // 3. Mutate
  const post = await db.post.create({
    data: { title, authorId: session.userId },
  });

  // 4. Revalidate
  revalidatePath('/posts');
  revalidateTag('posts');

  // 5. Redirect
  redirect(`/posts/${post.id}`);
}
