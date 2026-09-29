import { db } from "@/lib/db/client";
import {
  users,
  contacts,
  conversations,
  messages,
  organizations,
  auditLogs,
} from "@/lib/db/schema/index";
import { eq, and, desc, asc } from "drizzle-orm";

// Todas as queries garantem filtro por organizationId — nunca retornam dados de outro tenant

export async function getOrganizationById(organizationId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org;
}

export async function updateOrgWahaSession(organizationId: string, sessionName: string) {
  await db
    .update(organizations)
    .set({
      wahaSession: sessionName,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
}

export async function getUsersByOrg(organizationId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .orderBy(users.createdAt);
}

export async function getUserByEmail(email: string, organizationId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.organizationId, organizationId)))
    .limit(1);
  return user;
}

export async function getContactsByOrg(organizationId: string) {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.organizationId, organizationId))
    .orderBy(desc(contacts.createdAt));
}

export async function getContactById(id: string, organizationId: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)))
    .limit(1);
  return contact;
}

export async function getConversationsByOrg(organizationId: string) {
  return db
    .select({
      id: conversations.id,
      status: conversations.status,
      controlVersion: conversations.controlVersion,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      contactId: contacts.id,
      contactName: contacts.name,
      contactPhone: contacts.phone,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.organizationId, organizationId))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversationById(conversationId: string, organizationId: string) {
  const [conv] = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      controlVersion: conversations.controlVersion,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      contactId: contacts.id,
      contactName: contacts.name,
      contactPhone: contacts.phone,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .limit(1);
  return conv;
}

export async function getMessagesByConversation(
  conversationId: string,
  organizationId: string,
  limit = 100,
) {
  return db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversationId), eq(messages.organizationId, organizationId)),
    )
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function getAuditLogsByOrg(organizationId: string, limit = 50) {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
