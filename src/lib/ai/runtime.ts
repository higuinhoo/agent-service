import { db } from "@/lib/db/client";
import { conversations, contacts } from "@/lib/db/schema/index";
import { eq, and } from "drizzle-orm";
import { getAiAdapter, type AiMessage, type AiToolDefinition, type AiToolCall } from "@/lib/ai";
import {
  getAgentConfigByOrg,
  getMessagesByConversation,
  createAgentRun,
  updateAgentRun,
  recordToolCall,
} from "@/lib/db/queries";
import { enqueueOutboundMessage } from "@/lib/waha/outbox";
import { writeAuditLog } from "@/lib/audit";

export interface AgentTurnResult {
  completed: boolean;
  aborted?: boolean;
  reason?: string;
  responseContent?: string;
}

// ─── Ferramentas Permitidas Iniciais ──────────────────────────────────────────

const AVAILABLE_TOOLS: AiToolDefinition[] = [
  {
    name: "get_company_info",
    description: "Obtém informações institucionais, endereço e horários de atendimento da empresa.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "request_human_support",
    description:
      "Transfere o atendimento para um atendente humano quando solicitado pelo cliente ou em casos complexos.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motivo da transferência para o atendimento humano.",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "list_services",
    description: "Lista os principais serviços e atendimentos prestados pela organização.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// ─── Loop de Execução do Turno do Agente ──────────────────────────────────────

export async function executeAgentTurn(params: {
  conversationId: string;
  organizationId: string;
  incomingMessage: string;
}): Promise<AgentTurnResult> {
  const startTime = Date.now();
  const { conversationId, organizationId } = params;

  // 1. Carregar conversa e validar modo de atendimento
  const [conv] = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      controlVersion: conversations.controlVersion,
      contactId: conversations.contactId,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .limit(1);

  if (!conv) {
    return { completed: false, reason: "Conversa não encontrada." };
  }

  // Se o atendimento está com humano (D-004) ou fechado, IA NUNCA responde
  if (conv.status === "HUMAN_ACTIVE" || conv.status === "CLOSED") {
    return {
      completed: false,
      aborted: true,
      reason: "IA inativa: atendimento em modo humano ou encerrado.",
    };
  }

  // Se status é OPEN, promove para AI_ACTIVE
  if (conv.status === "OPEN") {
    await db
      .update(conversations)
      .set({ status: "AI_ACTIVE", updatedAt: new Date() })
      .where(eq(conversations.id, conv.id));
  }

  // Capturar versão de controle inicial do turno
  const initialControlVersion = conv.controlVersion;

  // 2. Carregar configuração do agente
  const config = await getAgentConfigByOrg(organizationId);
  if (!config || !config.isActive) {
    return { completed: false, reason: "Agente IA desativado para esta empresa." };
  }

  // 3. Registrar início de run para auditoria e observabilidade
  const run = await createAgentRun({
    organizationId,
    conversationId,
    controlVersionCaptured: initialControlVersion,
  });

  if (!run) {
    return { completed: false, reason: "Falha ao registrar run do agente." };
  }

  // 4. Carregar contato para telefone de destino
  const [contact] = await db
    .select({ phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, conv.contactId))
    .limit(1);

  if (!contact) {
    await updateAgentRun(run.id, { status: "FAILED", reason: "Contato não localizado" });
    return { completed: false, reason: "Contato não localizado." };
  }

  // 5. Montar histórico recente de mensagens
  const history = await getMessagesByConversation(conversationId, organizationId, 10);
  const promptMessages: AiMessage[] = [
    {
      role: "system",
      content: `${config.systemPrompt}\n\nInformações da Empresa:\n${config.companyInfo}\n\nDiretrizes:\n- Seja educado, direto e acolhedor.\n- Não invente informações que não estejam na base.\n- Se o cliente pedir para falar com uma pessoa, use imediatamente a ferramenta request_human_support.`,
    },
    ...history.map((m): AiMessage => ({
      role: m.sentBy === "contact" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const aiAdapter = getAiAdapter();
  const maxSteps = 3;
  let currentStep = 0;
  let finalContent: string | null = null;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  try {
    while (currentStep < maxSteps) {
      currentStep++;

      const response = await aiAdapter.complete(promptMessages, {
        temperature: parseFloat(config.temperature) || 0.7,
        tools: AVAILABLE_TOOLS,
      });

      if (response.usage) {
        totalPromptTokens += response.usage.promptTokens;
        totalCompletionTokens += response.usage.completionTokens;
      }

      // Se houver chamadas de ferramenta
      if (response.toolCalls && response.toolCalls.length > 0) {
        promptMessages.push({
          role: "assistant",
          content: response.content ?? "",
          toolCalls: response.toolCalls,
        });

        for (const tc of response.toolCalls) {
          const toolResult = await handleToolExecution({
            toolCall: tc,
            organizationId,
            conversationId,
            companyInfo: config.companyInfo,
            runId: run.id,
          });

          promptMessages.push({
            role: "tool",
            toolCallId: tc.id,
            content: JSON.stringify(toolResult),
          });
        }
        continue;
      }

      finalContent = response.content;
      break;
    }

    if (!finalContent) {
      await updateAgentRun(run.id, {
        status: "FAILED",
        reason: "IA não gerou resposta conclusiva",
      });
      return { completed: false, reason: "Resposta vazia da IA." };
    }

    // 6. Verificação Atômica Pré-Envio (D-004 / D-005): intervenção humana vence a IA!
    const [freshConv] = await db
      .select({
        status: conversations.status,
        controlVersion: conversations.controlVersion,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (
      !freshConv ||
      freshConv.status === "HUMAN_ACTIVE" ||
      freshConv.controlVersion !== initialControlVersion
    ) {
      // Intervenção humana detectada durante a geração! Descarta atomicamente a resposta.
      await updateAgentRun(run.id, {
        status: "ABORTED_HUMAN_INTERVENTION",
        reason: "Humano assumiu o atendimento durante o processamento do modelo.",
        executionTimeMs: (Date.now() - startTime).toString(),
      });

      await writeAuditLog({
        organizationId,
        actorId: null,
        actorEmail: "ai@runtime",
        action: "agent.aborted_human_takeover",
        resourceType: "conversation",
        resourceId: conversationId,
        metadata: {
          initialControlVersion,
          currentControlVersion: freshConv?.controlVersion,
        },
      });

      return {
        completed: false,
        aborted: true,
        reason: "Envio descartado: intervenção humana detectada durante o processamento.",
      };
    }

    // 7. Enfileirar mensagem confirmada no Outbox
    await enqueueOutboundMessage({
      organizationId,
      conversationId,
      to: contact.phone,
      content: finalContent,
      sentBy: "ai",
    });

    await updateAgentRun(run.id, {
      status: "COMPLETED",
      tokensPrompt: totalPromptTokens.toString(),
      tokensCompletion: totalCompletionTokens.toString(),
      executionTimeMs: (Date.now() - startTime).toString(),
    });

    return { completed: true, responseContent: finalContent };
  } catch (err) {
    await updateAgentRun(run.id, {
      status: "FAILED",
      reason: (err as Error).message,
      executionTimeMs: (Date.now() - startTime).toString(),
    });
    return { completed: false, reason: (err as Error).message };
  }
}

// ─── Executor de Ferramentas Estruturadas ─────────────────────────────────────

async function handleToolExecution(params: {
  toolCall: AiToolCall;
  organizationId: string;
  conversationId: string;
  companyInfo: string;
  runId: string;
}): Promise<Record<string, unknown>> {
  const { toolCall, organizationId, conversationId, companyInfo, runId } = params;
  let result: Record<string, unknown> = {};

  switch (toolCall.name) {
    case "get_company_info":
      result = { info: companyInfo };
      break;

    case "list_services":
      result = {
        services: [
          { name: "Atendimento Geral", description: "Esclarecimento de dúvidas e orientações" },
          { name: "Agendamento", description: "Reserva de horários com nossos especialistas" },
        ],
      };
      break;

    case "request_human_support": {
      // Handoff explícito: altera status da conversa para HUMAN_ACTIVE e incrementa controlVersion
      const [conv] = await db
        .select({ controlVersion: conversations.controlVersion })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const nextVersion = conv ? (parseInt(conv.controlVersion, 10) + 1).toString() : "1";

      await db
        .update(conversations)
        .set({
          status: "HUMAN_ACTIVE",
          controlVersion: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));

      await writeAuditLog({
        organizationId,
        actorId: null,
        actorEmail: "ai@tool",
        action: "conversation.requested_human_support",
        resourceType: "conversation",
        resourceId: conversationId,
        metadata: {
          reason: toolCall.arguments["reason"] ?? "Não informado",
          newControlVersion: nextVersion,
        },
      });

      result = {
        success: true,
        message:
          "Atendimento transferido para a equipe humana. A IA foi desativada para esta conversa.",
      };
      break;
    }

    default:
      result = { error: `Ferramenta desconhecida: ${toolCall.name}` };
  }

  // Registrar chamada de ferramenta em auditoria
  await recordToolCall({
    runId,
    toolName: toolCall.name,
    input: toolCall.arguments,
    output: result,
  });

  return result;
}
