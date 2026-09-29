import { describe, it, expect } from "vitest";

// ─── Modelos e Invariantes da Fase 2 (WAHA Integration) ─────────────────────

interface MockConversation {
  id: string;
  organizationId: string;
  status: "OPEN" | "AI_ACTIVE" | "HUMAN_ACTIVE" | "CLOSED";
  controlVersion: string;
}

interface MockMessage {
  id: string;
  wahaMessageId: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  deliveryStatus: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  sentBy: "contact" | "agent" | "ai" | "system";
}

interface WebhookInput {
  event: string;
  session: string;
  payload: {
    id: string;
    from?: string;
    to?: string;
    body?: string;
    fromMe?: boolean;
    source?: "app" | "api";
    ack?: number;
  };
}

class MockWahaProcessor {
  public sessions: Record<string, string> = {}; // session -> orgId
  public conversations: MockConversation[] = [];
  public messages: MockMessage[] = [];
  public processedEventIds = new Set<string>();

  resolveOrgBySession(session: string): string | null {
    return this.sessions[session] ?? null;
  }

  processWebhook(input: WebhookInput): { processed: boolean; reason?: string } {
    // Invariante 1: resolver organização estritamente pela sessão configurada
    const orgId = this.resolveOrgBySession(input.session);
    if (!orgId) return { processed: false, reason: "Sessão desconhecida" };

    // Invariante 2: Idempotência de evento
    const ackSuffix = input.payload.ack !== undefined ? `:${input.payload.ack}` : "";
    const eventKey = `${input.session}:${input.payload.id}:${input.event}${ackSuffix}`;
    if (this.processedEventIds.has(eventKey)) {
      return { processed: false, reason: "Evento duplicado" };
    }
    this.processedEventIds.add(eventKey);

    const { payload, event } = input;

    if (event === "message" || event === "message.any") {
      const fromMe = Boolean(payload.fromMe);
      const source = payload.source ?? "app";

      let conv = this.conversations.find((c) => c.organizationId === orgId);
      if (!conv) {
        conv = {
          id: `conv-${orgId}`,
          organizationId: orgId,
          status: "OPEN",
          controlVersion: "1",
        };
        this.conversations.push(conv);
      }

      // Invariante 3 (D-004): fromMe=true + source=app → Intervenção Humana
      if (fromMe && source === "app") {
        conv.status = "HUMAN_ACTIVE";
        conv.controlVersion = (parseInt(conv.controlVersion, 10) + 1).toString();

        this.messages.push({
          id: `msg-${payload.id}`,
          wahaMessageId: payload.id,
          conversationId: conv.id,
          direction: "OUTBOUND",
          content: payload.body ?? "",
          deliveryStatus: "SENT",
          sentBy: "agent",
        });

        return { processed: true };
      }

      // Invariante 4: fromMe=false → Inbound do cliente
      if (!fromMe) {
        // Idempotência por wahaMessageId
        const existing = this.messages.find((m) => m.wahaMessageId === payload.id);
        if (existing) return { processed: false, reason: "Mensagem duplicada" };

        this.messages.push({
          id: `msg-${payload.id}`,
          wahaMessageId: payload.id,
          conversationId: conv.id,
          direction: "INBOUND",
          content: payload.body ?? "",
          deliveryStatus: "DELIVERED",
          sentBy: "contact",
        });

        return { processed: true };
      }
    }

    // Invariante 5: Confirmações de entrega (message.ack)
    if (event === "message.ack") {
      const target = this.messages.find((m) => m.wahaMessageId === payload.id);
      if (target) {
        const ack = payload.ack ?? 1;
        target.deliveryStatus = ack >= 3 ? "READ" : ack >= 2 ? "DELIVERED" : "SENT";
      }
      return { processed: true };
    }

    return { processed: true };
  }

  // Simulação da verificação atômica de envio (Outbox)
  dispatchOutbound(params: {
    messageId: string;
    conversationId: string;
    sentBy: "agent" | "ai";
    scheduledControlVersion: string;
  }): { sent: boolean; reason?: string } {
    const conv = this.conversations.find((c) => c.id === params.conversationId);
    if (!conv) return { sent: false, reason: "Conversa inexistente" };

    // Invariante D-004 / D-005: Se for IA e a versão de controle mudou ou modo é humano, cancela!
    if (params.sentBy === "ai") {
      if (
        conv.controlVersion !== params.scheduledControlVersion ||
        conv.status === "HUMAN_ACTIVE"
      ) {
        return {
          sent: false,
          reason: "Cancelado: intervenção humana detectada (control_version alterado)",
        };
      }
    }

    return { sent: true };
  }
}

describe("WAHA Integration & Conversation Invariants (Fase 2)", () => {
  it("resolve organização exclusivamente pelo session name registrado", () => {
    const proc = new MockWahaProcessor();
    proc.sessions["org-alpha-session"] = "org-alpha-id";

    // Envio com sessão válida
    const resValid = proc.processWebhook({
      event: "message",
      session: "org-alpha-session",
      payload: { id: "m1", body: "Olá", fromMe: false },
    });
    expect(resValid.processed).toBe(true);

    // Envio com sessão desconhecida
    const resInvalid = proc.processWebhook({
      event: "message",
      session: "session-nao-mapeada",
      payload: { id: "m2", body: "Invasão", fromMe: false },
    });
    expect(resInvalid.processed).toBe(false);
    expect(resInvalid.reason).toContain("Sessão desconhecida");
  });

  it("garante idempotência e descarta eventos/mensagens duplicados", () => {
    const proc = new MockWahaProcessor();
    proc.sessions["test-session"] = "org-1";

    const payload: WebhookInput = {
      event: "message",
      session: "test-session",
      payload: { id: "waha-unique-123", body: "Primeira entrega", fromMe: false },
    };

    const first = proc.processWebhook(payload);
    expect(first.processed).toBe(true);
    expect(proc.messages).toHaveLength(1);

    // Segunda entrega do mesmo evento exato
    const second = proc.processWebhook(payload);
    expect(second.processed).toBe(false);
    expect(second.reason).toContain("Evento duplicado");
    expect(proc.messages).toHaveLength(1);
  });

  it("detecta intervenção humana quando fromMe=true e source=app (D-004)", () => {
    const proc = new MockWahaProcessor();
    proc.sessions["test-session"] = "org-1";

    // Cria conversa inicial
    proc.processWebhook({
      event: "message",
      session: "test-session",
      payload: { id: "in-1", body: "Preciso de ajuda", fromMe: false },
    });

    const conv = proc.conversations[0];
    expect(conv?.status).toBe("OPEN");
    const initialVersion = conv?.controlVersion;

    // Atendente responde diretamente pelo WhatsApp no celular
    proc.processWebhook({
      event: "message",
      session: "test-session",
      payload: {
        id: "out-human-1",
        body: "Olá, sou o Dr. Higor e vou te atender agora",
        fromMe: true,
        source: "app",
      },
    });

    expect(conv?.status).toBe("HUMAN_ACTIVE");
    expect(parseInt(conv?.controlVersion ?? "0", 10)).toBeGreaterThan(
      parseInt(initialVersion ?? "0", 10),
    );
  });

  it("impede que IA envie mensagem concorrente se houver intervenção humana (D-004)", () => {
    const proc = new MockWahaProcessor();
    proc.sessions["test-session"] = "org-1";

    proc.conversations.push({
      id: "conv-1",
      organizationId: "org-1",
      status: "AI_ACTIVE",
      controlVersion: "1",
    });

    // 1. IA planeja enviar uma mensagem baseada na versão de controle 1
    const aiJob = {
      messageId: "msg-ai-1",
      conversationId: "conv-1",
      sentBy: "ai" as const,
      scheduledControlVersion: "1",
    };

    // 2. Antes do envio disparar, o atendente assume (versão sobe para 2 e status vira HUMAN_ACTIVE)
    const conv = proc.conversations[0]!;
    conv.status = "HUMAN_ACTIVE";
    conv.controlVersion = "2";

    // 3. Worker executa verificação atômica pré-envio
    const dispatch = proc.dispatchOutbound(aiJob);
    expect(dispatch.sent).toBe(false);
    expect(dispatch.reason).toContain("Cancelado: intervenção humana detectada");
  });

  it("atualiza status de entrega via message.ack", () => {
    const proc = new MockWahaProcessor();
    proc.sessions["test-session"] = "org-1";

    proc.messages.push({
      id: "m-out",
      wahaMessageId: "waha-msg-99",
      conversationId: "conv-1",
      direction: "OUTBOUND",
      content: "Mensagem de teste",
      deliveryStatus: "PENDING",
      sentBy: "agent",
    });

    // Evento ack 2 (DELIVERED)
    proc.processWebhook({
      event: "message.ack",
      session: "test-session",
      payload: { id: "waha-msg-99", ack: 2 },
    });
    expect(proc.messages[0]?.deliveryStatus).toBe("DELIVERED");

    // Evento ack 3 (READ)
    proc.processWebhook({
      event: "message.ack",
      session: "test-session",
      payload: { id: "waha-msg-99", ack: 3 },
    });
    expect(proc.messages[0]?.deliveryStatus).toBe("READ");
  });
});
