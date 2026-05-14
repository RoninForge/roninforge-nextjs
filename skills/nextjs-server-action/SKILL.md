---
name: nextjs-server-action
description: "Scaffold a new Next.js 16 Server Action with: Zod input validation, verifySession + resource ownership re-check (IDOR guard), tagged revalidation (revalidateTag or updateTag), redirect() OUTSIDE try/catch, DTO return values (never raw DB rows), useActionState binding on the client, useFormStatus for submit-button pending state."
---

# Scaffold a New Next.js 16 Server Action

## When to Use

Use when generating a mutating Server Action (`createX`, `updateX`, `deleteX`), or refactoring an existing one that:

- uses `useFormState` from `react-dom` (deprecated in React 19),
- has no input validation,
- has `redirect()` inside a try/catch (silently swallowed),
- trusts page-level auth and skips the action-level session re-check,
- returns raw DB rows (PII leak),
- mutates without `revalidateTag` / `updateTag` (stale UI).

Target: `next@16.0+` on `react@19.2+`. The companion `nextjs-server-actions` rule has the full pattern reference.

## Output

For a `Post` resource with create + update + delete, the scaffold writes the actions file, the Zod schema, the State type, the Client Component form, and the submit button.

```typescript
// app/posts/actions.ts
'use server';

import { z } from 'zod';
import { revalidateTag, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { db } from '@/lib/db';

export type ActionState = {
  errors?: Record<string, string[]>;
  ok?: boolean;
};

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
});

const UpdatePostSchema = CreatePostSchema.extend({
  id: z.string().uuid(),
});

const DeletePostSchema = z.object({
  id: z.string().uuid(),
});

export async function createPost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Authorize (action is reachable as a POST endpoint independent of any page)
  const session = await verifySession();
  if (!session) return { errors: { _form: ['Sign in to post'] } };

  // 2. Validate
  const parsed = CreatePostSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // 3. (no resource ownership to check on create)

  // 4. Mutate (errors returned as state, not thrown)
  try {
    await db.post.create({
      data: { ...parsed.data, authorId: session.userId },
    });
  } catch {
    return { errors: { _form: ['Failed to save'] } };
  }

  // 5. Revalidate, then redirect OUTSIDE the try/catch
  revalidateTag('posts', 'max');
  redirect('/posts');
}

export async function updatePost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await verifySession();
  if (!session) return { errors: { _form: ['Sign in'] } };

  const parsed = UpdatePostSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // 3. Resource ownership: the IDOR guard
  const post = await db.post.findUnique({
    where: { id: parsed.data.id },
    select: { authorId: true },
  });
  if (!post) return { errors: { _form: ['Post not found'] } };
  if (post.authorId !== session.userId) {
    return { errors: { _form: ['Forbidden'] } };
  }

  try {
    await db.post.update({
      where: { id: parsed.data.id },
      data: { title: parsed.data.title, body: parsed.data.body },
    });
  } catch {
    return { errors: { _form: ['Failed to save'] } };
  }

  // Read-your-writes within the same response - user expects to see the change
  updateTag(`post-${parsed.data.id}`);
  updateTag('posts');
  return { ok: true };
}

export async function deletePost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await verifySession();
  if (!session) return { errors: { _form: ['Sign in'] } };

  const parsed = DeletePostSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { errors: { _form: ['Missing post id'] } };

  const post = await db.post.findUnique({
    where: { id: parsed.data.id },
    select: { authorId: true },
  });
  if (!post) return { errors: { _form: ['Post not found'] } };
  if (post.authorId !== session.userId) {
    return { errors: { _form: ['Forbidden'] } };
  }

  try {
    await db.post.delete({ where: { id: parsed.data.id } });
  } catch (e) {
    return { errors: { _form: ['Failed to delete'] } };
  }

  revalidateTag('posts', 'max');
  redirect('/posts');
}
```

The Client Component form binds with `useActionState`. The submit button reads pending state via `useFormStatus`.

```typescript
// app/posts/_components/create-post-form.tsx
'use client';

import { useActionState } from 'react';
import { createPost, type ActionState } from '../actions';
import { SubmitButton } from './submit-button';

const initial: ActionState = {};

export function CreatePostForm() {
  const [state, formAction, pending] = useActionState(createPost, initial);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="grid gap-1">
        <span>Title</span>
        <input name="title" required maxLength={200} />
        {state.errors?.title && (
          <p className="text-red-600">{state.errors.title[0]}</p>
        )}
      </label>

      <label className="grid gap-1">
        <span>Body</span>
        <textarea name="body" required maxLength={50_000} rows={10} />
        {state.errors?.body && (
          <p className="text-red-600">{state.errors.body[0]}</p>
        )}
      </label>

      {state.errors?._form && (
        <p className="text-red-600">{state.errors._form[0]}</p>
      )}

      <SubmitButton label="Publish" pendingLabel="Publishing..." />
      {/* `pending` from useActionState is also available here if you want
          an overall form-disabled state. */}
    </form>
  );
}
```

```typescript
// app/posts/_components/submit-button.tsx
'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  label: string;
  pendingLabel?: string;
};

export function SubmitButton({ label, pendingLabel = 'Saving...' }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
```

## Rules baked into the scaffold

1. **`'use server'` at file level** when the file holds only actions. If the file mixes helpers with actions, switch to function-level `'use server'`.
2. **Five-step shape** in every action: authorize -> validate -> authorize resource -> mutate -> revalidate / redirect.
3. **Re-verify session inside the action.** Page-level auth and `proxy.ts` redirects do NOT cover the action. Actions are addressable POST endpoints.
4. **Zod-validate every `FormData` field.** Values arrive as strings (or `File`); shape and bounds are not guaranteed.
5. **Resource ownership check before update / delete.** Authentication ("you are logged in") is not authorization ("you own this row"). This is the IDOR guard. See the `nextjs-server-actions` rule entry on IDOR.
6. **Return DTOs only.** Action return values are serialized to the client - never return raw DB rows with `passwordHash`, `isAdmin`, soft-delete flags, audit fields.
7. **`revalidateTag(tag, profile)` 2-arg form.** Single-arg is a TypeScript error in v16. Either `revalidateTag('posts', 'max')` for out-of-band invalidation, or `updateTag('posts')` for read-your-writes within the same response.
8. **`redirect()` OUTSIDE try/catch.** `redirect()` throws `NEXT_REDIRECT`; a `catch` block swallows it. If you must catch other errors, re-throw any error whose message matches `^NEXT_(REDIRECT|NOT_FOUND)$`. Do NOT import `isRedirectError` from `next/dist/...` - it is not a stable API.
9. **`useActionState` (not `useFormState`).** Renamed in React 19 and moved from `react-dom` to `react`. Three-tuple return: `[state, formAction, pending]`.
10. **`useFormStatus` for the submit button.** Lives in `react-dom`. Only works inside a child of `<form>`. Disables the button while the action is in flight, blocking double-submit.
11. **Errors returned as state, never thrown for validation.** Throwing prevents `useActionState` from showing the error. Throw only for genuinely exceptional cases (DB connection lost, etc.).
12. **Rate limit if the action is reachable unauthenticated** (signup, contact form, anything that sends email or hits a paid API). See the `nextjs-server-actions` rule.

## Workflow

1. **Pick the operation.** Create, update, or delete? Update and delete need the resource-ownership check.
2. **Wire the validation schema.** Zod is the path of least resistance. Mirror the form's field names exactly.
3. **Write the DAL call.** If the mutation reads first (e.g. ownership check), call the existing DAL function. See the `nextjs-dal` skill.
4. **Write the action.** Follow the five steps in order. Keep the `try / catch` tight around the DB write only; everything else (auth, validation, redirect, revalidate) lives outside.
5. **Wire the form.** Client Component, `useActionState`, named inputs that match the schema, error rendering at each field, `_form` error at the bottom.
6. **Smoke-test the action endpoint directly.** Server Actions are reachable as POST endpoints. From the network tab, copy the action's encrypted ID and `curl` it with no auth - the response should be an error state, not a 200 with the action succeeding.

```bash
# In dev. Replace the action ID with the one from your network tab.
curl -X POST http://localhost:3000/posts \
  -H "Next-Action: <encrypted-action-id>" \
  -H "Content-Type: multipart/form-data; boundary=----test" \
  --data-binary $'------test\r\nContent-Disposition: form-data; name="title"\r\n\r\nhi\r\n------test--\r\n'
# Expect an error state response, NOT a 200 with the post created
```

7. **Run `tsc --noEmit`.** Catches `useFormState` misimports, missing `Promise<>` on `params`, single-arg `revalidateTag`.

## Common mistakes to refuse

- **`redirect('/posts')` inside `try { ... } catch (e) { ... }`.** The catch intercepts `NEXT_REDIRECT` and the redirect dies silently. Move `redirect()` after the try/catch.
- **No `verifySession()` inside the action.** "But the page already checked auth" - the action is a separate POST endpoint reachable directly.
- **No resource ownership check on update / delete.** IDOR vulnerability: any logged-in user can mutate any row.
- **`return user` where `user` is the raw `db.user.update(...)` return.** Leaks `passwordHash`, audit fields, internal flags. Project to a `UserDTO`.
- **`useFormState` from `react-dom`.** Deprecated since React 19. Replace with `useActionState` from `react`.
- **Submit button with no `useFormStatus`.** User double-clicks; the action runs twice; you get duplicate writes. Add `disabled={pending}`.
- **No Zod (or equivalent) validation.** The action trusts `FormData.get('id') as string`. Forgery is trivial.
- **`revalidateTag('posts')` single-arg.** TypeScript error in v16. Add the second argument: `'max'`, `'hours'`, `'days'`, or `{ expire: 3600 }`.
- **Mutation with no revalidation at all.** The cached read still serves the stale value. Add `revalidateTag` or `updateTag`.
- **`'use server'` at file level when the file has non-action exports.** Every export becomes an action, including helpers that were never meant to be reachable. Switch to function-level `'use server'`.
- **Throwing for validation failures.** `useActionState` never gets the error. Return `{ errors: { ... } }` as state.
- **No rate limit on signup / contact / public actions.** Free DoS vector. Wrap with `@upstash/ratelimit` or similar.

## What this skill does NOT scaffold

- The DAL function the action calls. See the `nextjs-dal` skill - the action imports `verifySession` from `@/lib/dal` and that file must exist.
- The page that renders the form. See the `nextjs-page` skill.
- The auth library itself (Auth.js, Clerk, Better Auth, etc.). The `verifySession` shape in the scaffold is the canonical hand-rolled version. Adapt to the auth library's session-getter shape.
- The rate-limiter setup (Upstash / Redis). Add when the action is reachable unauthenticated.
