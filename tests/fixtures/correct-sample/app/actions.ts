// Gold-standard Next.js 16 Server Action. Demonstrates:
// 1. 'use server' at file level
// 2. Zod input validation
// 3. requireSession + resource ownership check (IDOR guard)
// 4. Mutation inside try/catch (returns error state on failure)
// 5. revalidateTag with required 2-arg form (v16)
// 6. redirect() OUTSIDE the try/catch (it throws)
// 7. Typed State return value; DTOs not raw rows
"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/dal";
import { db } from "@/lib/db";

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
});

export type State = {
  errors?: Record<string, string[]>;
  ok?: boolean;
};

export async function createPost(
  _prev: State,
  formData: FormData,
): Promise<State> {
  // 1. Authorize - re-verify, page-level auth does NOT extend to actions
  const session = await requireSession();

  // 2. Validate - FormData values are always untyped strings
  const parsed = CreatePostSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // 3. Mutate inside try/catch so we can return errors as state
  try {
    await db.post.create({
      data: { ...parsed.data, authorId: session.userId },
    });
  } catch (e) {
    return { errors: { _form: ["Failed to save"] } };
  }

  // 4. Revalidate the cache (2-arg form is required in v16)
  revalidateTag("posts", "max");

  // 5. Redirect OUTSIDE the try/catch (redirect() throws internally)
  redirect("/posts");
}
