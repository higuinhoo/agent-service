"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  deleteCalendarConnection,
  getCalendarConnectionByResource,
  updateCalendarConnectionTokens,
} from "@/lib/db/queries";
import { queryGoogleFreeBusy, refreshGoogleAccessToken } from "@/lib/calendar";

export interface CalendarActionResult {
  error?: string;
  success?: boolean;
}

async function requireCalendarManager() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as {
    id?: string;
    email?: string | null;
    organizationId: string;
    role: string;
  };
  if (user.role !== "admin" && user.role !== "supervisor") {
    throw new Error("Você não tem permissão para gerenciar integrações de agenda.");
  }
  return user;
}

export async function disconnectCalendarAction(resourceId: string): Promise<CalendarActionResult> {
  const user = await requireCalendarManager();

  const conn = await getCalendarConnectionByResource(user.organizationId, resourceId);
  if (!conn) {
    return { error: "Conexão de calendário não encontrada." };
  }

  await deleteCalendarConnection(user.organizationId, conn.id);

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id ?? null,
    actorEmail: user.email ?? "",
    action: "calendar.disconnected",
    resourceType: "calendar_connection",
    resourceId: conn.id,
    metadata: { resourceId, accountEmail: conn.accountEmail },
  });

  revalidatePath("/dashboard/schedule");
  return { success: true };
}

export async function testCalendarSyncAction(resourceId: string): Promise<CalendarActionResult> {
  const user = await requireCalendarManager();

  const conn = await getCalendarConnectionByResource(user.organizationId, resourceId);
  if (!conn) {
    return { error: "Conexão não configurada para este responsável." };
  }

  try {
    let accessToken = conn.accessToken;
    const now = new Date();

    if (conn.tokenExpiresAt && conn.tokenExpiresAt <= now && conn.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(conn.refreshToken);
      accessToken = refreshed.accessToken;
      const tokenExpiresAt = refreshed.expiresIn
        ? new Date(Date.now() + refreshed.expiresIn * 1000)
        : undefined;

      await updateCalendarConnectionTokens(user.organizationId, conn.id, {
        accessToken,
        ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
        syncStatus: "CONNECTED",
      });
    }

    const testEnd = new Date(Date.now() + 24 * 60 * 60_000);
    await queryGoogleFreeBusy({
      accessToken,
      calendarId: conn.calendarId,
      timeMin: now,
      timeMax: testEnd,
    });

    await updateCalendarConnectionTokens(user.organizationId, conn.id, {
      accessToken,
      syncStatus: "CONNECTED",
      lastError: null,
    });

    revalidatePath("/dashboard/schedule");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na sincronização.";
    await updateCalendarConnectionTokens(user.organizationId, conn.id, {
      accessToken: conn.accessToken,
      syncStatus: "SYNC_ERROR",
      lastError: message,
    });

    revalidatePath("/dashboard/schedule");
    return { error: message };
  }
}
