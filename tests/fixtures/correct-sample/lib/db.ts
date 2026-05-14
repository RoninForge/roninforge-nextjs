// Placeholder db client - swap for Prisma, Drizzle, or your driver of choice.
// The fixture compiles against this stub.
import "server-only";

type SessionRow = { userId: string; role: "user" | "admin"; expiresAt: Date };
type PostRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  createdAt: Date;
  authorId: string;
  published: boolean;
  author: { name: string };
};

export const db = {
  session: {
    findUnique: async (_args: unknown): Promise<SessionRow | null> => null,
  },
  post: {
    findMany: async (_args: unknown): Promise<PostRow[]> => [],
    findUnique: async (_args: unknown): Promise<PostRow | null> => null,
    create: async (_args: unknown): Promise<PostRow> => ({
      id: "",
      slug: "",
      title: "",
      body: "",
      createdAt: new Date(),
      authorId: "",
      published: false,
      author: { name: "" },
    }),
  },
};
