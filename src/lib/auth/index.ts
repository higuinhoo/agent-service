import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db/client";
import { users, organizations } from "@/lib/db/schema/index";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { authConfig } from "./config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials): Promise<AuthUser | null> {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user || !user.isActive) return null;

        // Validar suspensão da organização (Fase 1: suspensão de empresa)
        const [org] = await db
          .select({ id: organizations.id, suspended: organizations.suspended })
          .from(organizations)
          .where(eq(organizations.id, user.organizationId))
          .limit(1);

        if (!org || org.suspended) {
          return null;
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        await writeAuditLog({
          organizationId: user.organizationId,
          actorId: user.id,
          actorEmail: user.email,
          action: "user.login",
          resourceType: "user",
          resourceId: user.id,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as AuthUser;
        token["id"] = u.id;
        token["role"] = u.role;
        token["organizationId"] = u.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, string>;
        u["id"] = token["id"] as string;
        u["role"] = token["role"] as string;
        u["organizationId"] = token["organizationId"] as string;
      }
      return session;
    },
  },
});
