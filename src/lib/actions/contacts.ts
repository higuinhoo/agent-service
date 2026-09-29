"use server";

import { db } from "@/lib/db/client";
import { contacts } from "@/lib/db/schema/index";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

const createContactSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  phone: z.string().min(8, "Telefone inválido").max(20),
  notes: z.string().max(500).optional(),
});

export interface ContactActionResult {
  error?: string;
  success?: boolean;
}

export async function createContactAction(formData: FormData): Promise<ContactActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;

  const parsed = createContactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { name, phone, notes } = parsed.data;

  // Garantir unicidade ou verificação por telefone dentro do tenant
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.organizationId, orgId), eq(contacts.phone, phone)))
    .limit(1);

  if (existing) {
    return { error: "Já existe um contato cadastrado com este telefone nesta organização." };
  }

  const [created] = await db
    .insert(contacts)
    .values({
      organizationId: orgId,
      name,
      phone,
      ...(notes !== undefined ? { notes } : {}),
    })
    .returning({ id: contacts.id });

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "contact.created",
    resourceType: "contact",
    ...(created?.id ? { resourceId: created.id } : {}),
    metadata: { name, phone },
  });

  return { success: true };
}

export async function deleteContactAction(contactId: string): Promise<ContactActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;

  // Apenas deleta se pertencer à mesma organização (isolamento rigoroso)
  const [deleted] = await db
    .delete(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.organizationId, orgId)))
    .returning({ id: contacts.id, name: contacts.name });

  if (!deleted) {
    return { error: "Contato não encontrado ou permissão negada." };
  }

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "contact.deleted",
    resourceType: "contact",
    resourceId: contactId,
    metadata: { name: deleted.name },
  });

  return { success: true };
}
