// Anti-pattern sample. DO NOT use as a template.
// Violations:
// 1. Sync params destructure (TypeError in v16)
// 2. getServerSideProps export in App Router (Pages Router API, never runs)
// 3. Component is not async despite needing server data

type Post = { id: string; slug: string; title: string; body: string };

// BAD - Pages Router data fetching, does nothing in App Router
export async function getServerSideProps(ctx: { params: { slug: string } }) {
  const res = await fetch(`https://api.example.com/posts/${ctx.params.slug}`);
  const post = await res.json();
  return { props: { post } };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  return (
    <article>
      <h1>Post: {params.slug}</h1>
    </article>
  );
}
