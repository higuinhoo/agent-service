import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { exchangeCodeForTokens, getGoogleUserEmail, listGoogleCalendars } from "@/lib/calendar";
import { upsertCalendarConnection } from "@/lib/db/queries";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateEncoded = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const baseUrl = new URL("/dashboard/schedule", request.url);

  if (errorParam) {
    baseUrl.searchParams.set("error", `Erro no Google: ${errorParam}`);
    return NextResponse.redirect(baseUrl);
  }

  if (!code || !stateEncoded) {
    baseUrl.searchParams.set("error", "Parâmetros OAuth ausentes.");
    return NextResponse.redirect(baseUrl);
  }

  let state: { orgId: string; resId: string; timestamp?: number };
  try {
    const decoded = Buffer.from(stateEncoded, "base64url").toString("utf-8");
    state = JSON.parse(decoded);
  } catch {
    baseUrl.searchParams.set("error", "Estado OAuth inválido.");
    return NextResponse.redirect(baseUrl);
  }

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = session.user as { id?: string; email?: string | null; organizationId: string };
  if (user.organizationId !== state.orgId) {
    baseUrl.searchParams.set("error", "Organização incompatível com a sessão.");
    return NextResponse.redirect(baseUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens({ code });
    const accountEmail = await getGoogleUserEmail(tokens.accessToken);
    let calendarId = "primary";
    let calendarName = "Principal";

    try {
      const calendars = await listGoogleCalendars(tokens.accessToken);
      const primary = calendars.find((cal) => cal.primary) || calendars[0];
      if (primary) {
        calendarId = primary.id;
        calendarName = primary.summary || "Principal";
      }
    } catch {
      // Falha ao listar calendários não impede o uso do primário
    }

    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : undefined;

    await upsertCalendarConnection({
      organizationId: user.organizationId,
      resourceId: state.resId,
      provider: "google",
      accountEmail,
      calendarId,
      calendarName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? "",
      ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id ?? null,
      actorEmail: user.email ?? "",
      action: "calendar.connected",
      resourceType: "calendar_connection",
      resourceId: state.resId,
      metadata: { accountEmail, calendarId, calendarName },
    });

    baseUrl.searchParams.set("success", "google_connected");
    return NextResponse.redirect(baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na autorização do Google.";
    baseUrl.searchParams.set("error", message);
    return NextResponse.redirect(baseUrl);
  }
}
