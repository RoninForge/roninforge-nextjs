// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. 'use client' at the top of a page (forces a route that could be a Server Component to be Client)
// 2. useEffect + fetch for server data (loses streaming, doubles the trip)
// 3. useFormState from react-dom (deprecated in React 19, use useActionState from react)
// 4. useRouter from next/router (Pages Router; App Router uses next/navigation)

'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/router';
import { createPost } from '../actions';

type Post = { id: string; title: string };

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [state, formAction] = useFormState(createPost as any, {});
  const router = useRouter();

  useEffect(() => {
    fetch('/api/posts').then((r) => r.json()).then(setPosts);
  }, []);

  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>{p.title}</li>
        ))}
      </ul>
      <form action={formAction as any}>
        <input name="title" />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
