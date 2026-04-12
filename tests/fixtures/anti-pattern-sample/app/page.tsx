// Anti-pattern: 'use client' on page for data that should be server-fetched
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; // Anti-pattern: Pages Router import

export default function HomePage() {
  // Anti-pattern: useEffect + fetch for server-available data
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // Anti-pattern: fetching own Route Handler from client
    fetch('/api/posts')
      .then(res => res.json())
      .then(setPosts);
  }, []);

  return (
    <div>
      <h1>Posts</h1>
      {posts.map((post: any) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
