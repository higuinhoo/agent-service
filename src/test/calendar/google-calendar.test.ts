import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  refreshGoogleAccessToken,
  queryGoogleFreeBusy,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "@/lib/calendar/google";

describe("Google Calendar Adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("gera URL de autorização OAuth com parâmetros e escopos corretos", () => {
    const urlString = generateGoogleAuthUrl({
      organizationId: "org-123",
      resourceId: "res-456",
      redirectUri: "http://localhost:3000/api/calendar/google/callback",
    });

    const url = new URL(urlString);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain("calendar.events");

    const stateEncoded = url.searchParams.get("state")!;
    const state = JSON.parse(Buffer.from(stateEncoded, "base64url").toString("utf-8"));
    expect(state.orgId).toBe("org-123");
    expect(state.resId).toBe("res-456");
  });

  it("troca código de autorização por tokens de acesso", async () => {
    const mockTokens = {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockTokens), { status: 200 }),
    );

    const tokens = await exchangeCodeForTokens({
      code: "auth-code-123",
      redirectUri: "http://localhost:3000/callback",
    });

    expect(tokens.accessToken).toBe("mock-access-token");
    expect(tokens.refreshToken).toBe("mock-refresh-token");
    expect(tokens.expiresIn).toBe(3600);
  });

  it("renova access token expirado usando refresh token", async () => {
    const mockRefreshed = {
      access_token: "new-access-token",
      expires_in: 3600,
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRefreshed), { status: 200 }),
    );

    const result = await refreshGoogleAccessToken("refresh-token-xyz");
    expect(result.accessToken).toBe("new-access-token");
    expect(result.expiresIn).toBe(3600);
  });

  it("consulta FreeBusy e converte para intervalos Date", async () => {
    const mockFreeBusy = {
      calendars: {
        primary: {
          busy: [
            {
              start: "2026-09-30T10:00:00Z",
              end: "2026-09-30T11:00:00Z",
            },
          ],
        },
      },
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockFreeBusy), { status: 200 }),
    );

    const busy = await queryGoogleFreeBusy({
      accessToken: "token-123",
      calendarId: "primary",
      timeMin: new Date("2026-09-30T00:00:00Z"),
      timeMax: new Date("2026-09-30T23:59:59Z"),
    });

    expect(busy).toHaveLength(1);
    expect(busy[0]?.startsAt).toEqual(new Date("2026-09-30T10:00:00Z"));
    expect(busy[0]?.endsAt).toEqual(new Date("2026-09-30T11:00:00Z"));
  });

  it("cria evento externo com identificador idempotente", async () => {
    const mockEvent = {
      id: "event-google-999",
      etag: '"etag-123"',
      htmlLink: "https://calendar.google.com/event?eid=xxx",
    };

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(mockEvent), { status: 200 }));

    const result = await createGoogleCalendarEvent({
      accessToken: "token-abc",
      calendarId: "primary",
      summary: "Consulta Odonto - João Silva",
      startsAt: new Date("2026-09-30T14:00:00Z"),
      endsAt: new Date("2026-09-30T14:30:00Z"),
      timeZone: "America/Sao_Paulo",
      requestId: "idempotency-key-001",
    });

    expect(result.id).toBe("event-google-999");
    expect(result.etag).toBe('"etag-123"');

    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs?.[0]).toContain("/calendars/primary/events");
    const sentBody = JSON.parse(callArgs?.[1]?.body as string);
    expect(sentBody.summary).toBe("Consulta Odonto - João Silva");
    expect(sentBody.start.dateTime).toBe("2026-09-30T14:00:00.000Z");
  });

  it("exclui evento no Google Calendar de forma idempotente", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));

    const deleted = await deleteGoogleCalendarEvent({
      accessToken: "token-abc",
      calendarId: "primary",
      eventId: "event-google-999",
    });
    expect(deleted).toBe(true);
  });

  it("trata 404/410 na exclusão de evento como sucesso sem quebrar fluxo", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const deleted = await deleteGoogleCalendarEvent({
      accessToken: "token-abc",
      calendarId: "primary",
      eventId: "already-deleted-event",
    });
    expect(deleted).toBe(true);
  });
});
