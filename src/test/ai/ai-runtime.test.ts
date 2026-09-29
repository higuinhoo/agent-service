import { describe, it, expect } from "vitest";

// ─── Modelos do Runtime de IA e Controle Humano (Fase 3) ──────────────────────

interface ConversationState {
  id: string;
  organizationId: string;
  status: "OPEN" | "AI_ACTIVE" | "HUMAN_ACTIVE" | "CLOSED";
  controlVersion: string;
}

interface MockAgentRun {
  id: string;
  status: "RUNNING" | "COMPLETED" | "ABORTED_HUMAN_INTERVENTION" | "FAILED";
  reason?: string;
  controlVersionCaptured: string;
}

class MockAiRuntime {
  public conversation: ConversationState;
  public runs: MockAgentRun[] = [];
  public sentMessages: { to: string; content: string; sentBy: string }[] = [];

  constructor(initialStatus: "OPEN" | "AI_ACTIVE" | "HUMAN_ACTIVE" | "CLOSED" = "AI_ACTIVE") {
    this.conversation = {
      id: "conv-test",
      organizationId: "org-test",
      status: initialStatus,
      controlVersion: "1",
    };
  }

  // Ação manual: Atendente assume atendimento (D-004)
  takeoverManual(): string {
    this.conversation.status = "HUMAN_ACTIVE";
    this.conversation.controlVersion = (
      parseInt(this.conversation.controlVersion, 10) + 1
    ).toString();
    return this.conversation.controlVersion;
  }

  // Ação manual: Atendente devolve para a IA (D-005)
  returnToAi(): string {
    this.conversation.status = "AI_ACTIVE";
    this.conversation.controlVersion = (
      parseInt(this.conversation.controlVersion, 10) + 1
    ).toString();
    return this.conversation.controlVersion;
  }

  // Simulação do turno do agente com hook assíncrono para testar concorrência
  async executeTurn(options: {
    simulateHumanInterventionDuringInference?: boolean;
    invokeRequestHumanSupport?: boolean;
  }): Promise<{ completed: boolean; aborted?: boolean; reason?: string }> {
    // 1. Verificação prévia: Se estiver em HUMAN_ACTIVE ou CLOSED, não executa
    if (this.conversation.status === "HUMAN_ACTIVE" || this.conversation.status === "CLOSED") {
      return {
        completed: false,
        aborted: true,
        reason: "IA inativa: atendimento em modo humano ou encerrado.",
      };
    }

    // Captura versão de controle no início do turno
    const capturedVersion = this.conversation.controlVersion;
    const run: MockAgentRun = {
      id: `run-${Date.now()}`,
      status: "RUNNING",
      controlVersionCaptured: capturedVersion,
    };
    this.runs.push(run);

    // 2. Simulação de Tool Calling: request_human_support
    if (options.invokeRequestHumanSupport) {
      this.conversation.status = "HUMAN_ACTIVE";
      this.conversation.controlVersion = (
        parseInt(this.conversation.controlVersion, 10) + 1
      ).toString();
      run.status = "COMPLETED";
      run.reason = "Transferido para humano via ferramenta";
      return { completed: true, reason: "Handoff para humano executado via tool" };
    }

    // 3. Simulação de tempo de inferência da LLM
    // Durante a inferência, simula o atendente assumindo o chat no WhatsApp ou dashboard
    if (options.simulateHumanInterventionDuringInference) {
      this.takeoverManual();
    }

    // 4. Verificação Atômica Pré-Envio (D-004 e D-005)
    const currentStatus = this.conversation.status as string;
    if (currentStatus === "HUMAN_ACTIVE" || this.conversation.controlVersion !== capturedVersion) {
      run.status = "ABORTED_HUMAN_INTERVENTION";
      run.reason = "Intervenção humana detectada durante a inferência";
      return {
        completed: false,
        aborted: true,
        reason: "Envio descartado: intervenção humana detectada durante o processamento.",
      };
    }

    // 5. Sucesso: envia mensagem
    this.sentMessages.push({
      to: "5511999998888",
      content: "Olá! Como posso ajudar você hoje?",
      sentBy: "ai",
    });
    run.status = "COMPLETED";
    return { completed: true };
  }
}

describe("AI Runtime & Human Intervention Invariants (Fase 3)", () => {
  it("recusa execução da IA se a conversa estiver em HUMAN_ACTIVE (D-004)", async () => {
    const runtime = new MockAiRuntime("HUMAN_ACTIVE");

    const result = await runtime.executeTurn({});
    expect(result.completed).toBe(false);
    expect(result.aborted).toBe(true);
    expect(result.reason).toContain("IA inativa: atendimento em modo humano");
    expect(runtime.sentMessages).toHaveLength(0);
  });

  it("descarta atomicamente resposta da IA se humano assumir durante a inferência (D-004 corrida)", async () => {
    const runtime = new MockAiRuntime("AI_ACTIVE");
    expect(runtime.conversation.controlVersion).toBe("1");

    // Inicia turno, mas humano assume ANTES do envio
    const result = await runtime.executeTurn({
      simulateHumanInterventionDuringInference: true,
    });

    expect(result.completed).toBe(false);
    expect(result.aborted).toBe(true);
    expect(result.reason).toContain("Envio descartado: intervenção humana detectada");

    // Nenhuma mensagem da IA foi enviada para o Outbox
    expect(runtime.sentMessages).toHaveLength(0);

    // O run foi auditado como abortado
    const run = runtime.runs[0];
    expect(run?.status).toBe("ABORTED_HUMAN_INTERVENTION");
    expect(runtime.conversation.status).toBe("HUMAN_ACTIVE");
  });

  it("permite que ferramenta request_human_support pause a IA e transfira o chat", async () => {
    const runtime = new MockAiRuntime("AI_ACTIVE");
    const vBefore = runtime.conversation.controlVersion;

    const result = await runtime.executeTurn({
      invokeRequestHumanSupport: true,
    });

    expect(result.completed).toBe(true);
    expect(runtime.conversation.status).toBe("HUMAN_ACTIVE");
    expect(parseInt(runtime.conversation.controlVersion, 10)).toBeGreaterThan(
      parseInt(vBefore, 10),
    );
  });

  it("suporta ciclo completo de devolução e retomada manual (D-004 & D-005)", () => {
    const runtime = new MockAiRuntime("AI_ACTIVE");
    expect(runtime.conversation.status).toBe("AI_ACTIVE");
    expect(runtime.conversation.controlVersion).toBe("1");

    // Atendente assume (D-004)
    const vHuman = runtime.takeoverManual();
    expect(runtime.conversation.status).toBe("HUMAN_ACTIVE");
    expect(vHuman).toBe("2");

    // Atendente devolve para a IA (D-005)
    const vAi = runtime.returnToAi();
    expect(runtime.conversation.status).toBe("AI_ACTIVE");
    expect(vAi).toBe("3");
  });
});
