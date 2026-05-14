// Gold-standard Next.js 16 Client Component form. Demonstrates:
// 1. 'use client' on the smallest interactive boundary (just the form, not the page)
// 2. useActionState from 'react' (NOT useFormState from 'react-dom' which is deprecated)
// 3. useFormStatus from 'react-dom' on the SubmitButton child for pending UX
// 4. Tuple destructure with three elements (state, action, pending) from React 19
// 5. Error state surfaces inline; no try/catch swallowing the action
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPost, type State } from "../../actions";

const initialState: State = {};

export function CreatePostForm() {
  const [state, formAction, pending] = useActionState(createPost, initialState);

  return (
    <form action={formAction}>
      <label>
        Title
        <input name="title" required />
        {state.errors?.title && (
          <p className="error">{state.errors.title[0]}</p>
        )}
      </label>
      <label>
        Body
        <textarea name="body" required />
        {state.errors?.body && <p className="error">{state.errors.body[0]}</p>}
      </label>
      {state.errors?._form && (
        <p className="error">{state.errors._form[0]}</p>
      )}
      <SubmitButton />
      {pending && <p>Working...</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </button>
  );
}
