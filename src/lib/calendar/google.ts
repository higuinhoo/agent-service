export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface FreeBusyPeriod {
  start: string;
  end: string;
}

export interface CreateEventInput {
  accessToken: string;
  calendarId: string;
  summary: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  requestId?: string;
}

export interface GoogleEventResult {
  id: string;
  etag?: string;
  htmlLink?: string;
  status?: string;
}

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export function getGoogleOAuthClientId(): string {
  return process.env["GOOGLE_CLIENT_ID"] ?? "";
}

export function getGoogleOAuthClientSecret(): string {
  return process.env["GOOGLE_CLIENT_SECRET"] ?? "";
}

export function getGoogleOAuthRedirectUri(): string {
  const appUrl = process.env["APP_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/calendar/google/callback`;
}

export function generateGoogleAuthUrl(params: {
  organizationId: string;
  resourceId: string;
  redirectUri?: string;
}): string {
  const clientId = getGoogleOAuthClientId();
  const redirectUri = params.redirectUri || getGoogleOAuthRedirectUri();
  const state = JSON.stringify({
    orgId: params.organizationId,
    resId: params.resourceId,
    timestamp: Date.now(),
  });

  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly email",
    access_type: "offline",
    prompt: "consent",
    state: Buffer.from(state).toString("base64url"),
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${searchParams.toString()}`;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri?: string;
}): Promise<GoogleTokens> {
  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();
  const redirectUri = params.redirectUri || getGoogleOAuthRedirectUri();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao obter tokens do Google (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    ...(data.expires_in ? { expiresIn: data.expires_in } : {}),
    ...(data.token_type ? { tokenType: data.token_type } : {}),
    ...(data.scope ? { scope: data.scope } : {}),
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao renovar token do Google (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    ...(data.expires_in ? { expiresIn: data.expires_in } : {}),
  };
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return "google-user@calendar";
  }
  const data = (await response.json()) as { email?: string };
  return data.email || "google-user@calendar";
}

export async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarItem[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao listar calendários do Google (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>;
  };

  return (data.items || []).map((item) => ({
    id: item.id,
    summary: item.summary,
    ...(item.primary !== undefined ? { primary: item.primary } : {}),
  }));
}

export async function queryGoogleFreeBusy(params: {
  accessToken: string;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  timeZone?: string;
}): Promise<Array<{ startsAt: Date; endsAt: Date }>> {
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: params.timeMin.toISOString(),
      timeMax: params.timeMax.toISOString(),
      timeZone: params.timeZone || "UTC",
      items: [{ id: params.calendarId }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao consultar FreeBusy do Google (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    calendars?: Record<string, { busy?: FreeBusyPeriod[] }>;
  };

  const busyList = data.calendars?.[params.calendarId]?.busy || [];
  return busyList.map((slot) => ({
    startsAt: new Date(slot.start),
    endsAt: new Date(slot.end),
  }));
}

export async function createGoogleCalendarEvent(
  params: CreateEventInput,
): Promise<GoogleEventResult> {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(params.calendarId)}/events`;

  const body = {
    summary: params.summary,
    ...(params.description ? { description: params.description } : {}),
    start: {
      dateTime: params.startsAt.toISOString(),
      timeZone: params.timeZone,
    },
    end: {
      dateTime: params.endsAt.toISOString(),
      timeZone: params.timeZone,
    },
    ...(params.requestId ? { id: params.requestId.replace(/[^a-v0-9]/g, "").slice(0, 64) } : {}),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao criar evento no Google Calendar (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    etag?: string;
    htmlLink?: string;
    status?: string;
  };

  return {
    id: data.id,
    ...(data.etag ? { etag: data.etag } : {}),
    ...(data.htmlLink ? { htmlLink: data.htmlLink } : {}),
    ...(data.status ? { status: data.status } : {}),
  };
}

export async function deleteGoogleCalendarEvent(params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<boolean> {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  // 204 No Content is normal success, 404 or 410 means already deleted
  if (response.status === 204 || response.status === 404 || response.status === 410) {
    return true;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Falha ao remover evento no Google Calendar (${response.status}): ${errorBody}`,
    );
  }

  return true;
}
