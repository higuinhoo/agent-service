"use server";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/index";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { hash } from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "agent", "supervisor"]),
  password: z.string().min(8),
});

export interface ActionResult {
  error?: string;
}

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const actorRole = (session.user as { role: string }).role;

  if (actorRole !== "admin") return { error: "Sem permissão." };

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Dados inválidos." };

  const { name, email, role, password } = parsed.data;

  // Verificar duplicata dentro do tenant
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) return { error: "E-mail já cadastrado." };

  const passwordHash = await hash(password, 12);

  const [created] = await db
    .insert(users)
    .values({ organizationId: orgId, name, email, passwordHash, role })
    .returning({ id: users.id });

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "user.created",
    resourceType: "user",
    ...(created?.id ? { resourceId: created.id } : {}),
    metadata: { name, email, role },
  });

  return {};
}

export async function toggleUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const actorRole = (session.user as { role: string }).role;
  if (actorRole !== "admin") return { error: "Sem permissão." };

  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: isActive ? "user.activated" : "user.deactivated",
    resourceType: "user",
    resourceId: userId,
  });

  return {};
}
