// Gold-standard Next.js 16 DAL domain file. Demonstrates:
// 1. 'server-only' guard
// 2. Returns DTOs, never raw DB rows
// 3. Auth + ownership check inside every user-scoped function
// 4. Naming convention: getXForViewing (public read) vs getXForEditing (owner only)
import "server-only";
import { requireSession, verifySession } from "./index";
import { db } from "../db";

export type PostListItem = {
  id: string;
  title: string;
  createdAt: string;
};

export type PostDetail = PostListItem & {
  body: string;
  authorName: string;
};

export async function getMyPosts(): Promise<PostListItem[]> {
  const session = await requireSession();
  const rows = await db.post.findMany({
    where: { authorId: session.userId },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getPostForViewing(slug: string): Promise<PostDetail | null> {
  const post = await db.post.findUnique({
    where: { slug, published: true },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
  if (!post) return null;
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    authorName: post.author.name,
  };
}

export async function getPostForEditing(id: string): Promise<PostDetail | null> {
  const session = await requireSession();
  const post = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });
  if (!post) return null;
  // Resource ownership check - prevents IDOR
  if (post.authorId !== session.userId) {
    throw new Error("Forbidden");
  }
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    authorName: post.author.name,
  };
}
