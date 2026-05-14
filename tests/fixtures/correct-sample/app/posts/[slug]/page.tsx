// Gold-standard Next.js 16 page. Demonstrates:
// 1. Async params (v16 requires Promise<{ slug: string }>)
// 2. generateMetadata with async params
// 3. DAL call, not direct db.post.findUnique in the page
// 4. Server Component default (no 'use client')
// 5. Suspense around the slow async child (streamed)
// 6. notFound() OUTSIDE try/catch (it throws)
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostForViewing } from "@/lib/dal/posts";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostForViewing(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.body.slice(0, 160),
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostForViewing(slug);
  if (!post) notFound();

  return (
    <article>
      <h1>{post.title}</h1>
      <p>by {post.authorName}</p>
      <Suspense fallback={<p>Loading comments...</p>}>
        <Comments postId={post.id} />
      </Suspense>
      {/* Sanitize post.body with DOMPurify (or a server-side HTML sanitizer)
          BEFORE rendering raw HTML. Skipping this is a stored-XSS vector. */}
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}

async function Comments({ postId }: { postId: string }) {
  // Slow async work streamed via Suspense; the page renders the title first
  await new Promise((r) => setTimeout(r, 100));
  void postId;
  return <p>0 comments</p>;
}
