// Gold-standard Next.js 16 page rendering a Client form. Demonstrates:
// 1. Server Component default (no 'use client' on the page)
// 2. Server Component does auth gating with requireSession + redirect
// 3. Renders a small Client Component sibling that owns the form interactivity
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { CreatePostForm } from "./create-post-form";

export default async function NewPostPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  return (
    <main>
      <h1>New post</h1>
      <CreatePostForm />
    </main>
  );
}
