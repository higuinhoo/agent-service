import { db } from "@/lib/db/client";
import { conversations, contacts, services, bookings, resources } from "@/lib/db/schema/index";
import { eq, and, asc, gt } from "drizzle-orm";
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
import { getResourceServicesByOrg, getServicesByOrg } from "@/lib/db/queries";
import {
  cancelBooking,
  confirmBookingFromHold,
  createBookingHold,
  findAvailableSlots,
  rescheduleBookingFromHold,
  SchedulingConflictError,
  SchedulingValidationError,
} from "@/lib/scheduling";
import { z } from "zod";

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
    description: "Lista os serviços ativos, duração e responsáveis disponíveis da organização.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_booking_hold",
    description:
      "Reserva temporariamente um horário solicitado pelo cliente. Use data ISO 8601 com fuso explícito e informe ao cliente que ainda não está confirmado.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "ID do serviço retornado por list_services." },
        resource_id: {
          type: "string",
          description: "ID do responsável retornado por list_services.",
        },
        starts_at: {
          type: "string",
          description: "Início em ISO 8601 com Z ou offset, por exemplo 2026-09-29T14:00:00-03:00.",
        },
      },
      required: ["service_id", "resource_id", "starts_at"],
    },
  },
  {
    name: "find_available_slots",
    description:
      "Consulta horários realmente disponíveis para um serviço em uma data local da empresa. Use antes de oferecer horários.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "ID do serviço retornado por list_services." },
        date: { type: "string", description: "Data local da empresa no formato AAAA-MM-DD." },
        resource_id: {
          type: "string",
          description: "ID opcional do responsável escolhido pelo cliente.",
        },
      },
      required: ["service_id", "date"],
    },
  },
  {
    name: "confirm_booking",
    description:
      "Confirma um hold somente depois que o cliente confirmar explicitamente o serviço, responsável e horário.",
    parameters: {
      type: "object",
      properties: {
        hold_id: { type: "string", description: "ID do hold temporário ainda ativo." },
      },
      required: ["hold_id"],
    },
  },
  {
    name: "list_upcoming_bookings",
    description: "Lista os agendamentos futuros confirmados do contato desta conversa.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "cancel_booking",
    description: "Cancela um agendamento somente após confirmação explícita do cliente.",
    parameters: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "ID retornado por list_upcoming_bookings." },
      },
      required: ["booking_id"],
    },
  },
  {
    name: "reschedule_booking",
    description:
      "Troca um agendamento confirmado por um novo hold, somente após confirmação explícita do cliente.",
    parameters: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "Agendamento original confirmado." },
        hold_id: { type: "string", description: "Novo hold ativo para o horário escolhido." },
      },
      required: ["booking_id", "hold_id"],
    },
  },
];

const holdArgumentsSchema = z.object({
  service_id: z.string().uuid(),
  resource_id: z.string().uuid(),
  starts_at: z
    .string()
    .datetime({ offset: true })
    .refine((value) => /(Z|[+-]\d{2}:\d{2})$/.test(value), "Fuso horário obrigatório."),
});
const confirmArgumentsSchema = z.object({ hold_id: z.string().uuid() });
const availabilityArgumentsSchema = z.object({
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resource_id: z.string().uuid().optional(),
});
const bookingIdArgumentsSchema = z.object({ booking_id: z.string().uuid() });
const rescheduleArgumentsSchema = z.object({
  booking_id: z.string().uuid(),
  hold_id: z.string().uuid(),
});

async function withToolTimeout<T>(operation: Promise<T>, timeoutMs = 5_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Tempo limite da ferramenta excedido.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

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
    .where(and(eq(contacts.id, conv.contactId), eq(contacts.organizationId, organizationId)))
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
      content: `${config.systemPrompt}\n\nInformações da Empresa:\n${config.companyInfo}\n\nDiretrizes:\n- Seja educado, direto e acolhedor.\n- Não invente informações que não estejam na base.\n- Use list_services e find_available_slots antes de oferecer serviço, responsável ou horário.\n- Um hold é temporário e não é confirmação.\n- Use confirm_booking somente após confirmação explícita do cliente.\n- Se o cliente pedir para falar com uma pessoa, use imediatamente a ferramenta request_human_support.`,
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
            controlVersionCaptured: initialControlVersion,
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
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
      )
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
  controlVersionCaptured: string;
}): Promise<Record<string, unknown>> {
  const { toolCall, organizationId, conversationId, companyInfo, runId, controlVersionCaptured } =
    params;
  let result: Record<string, unknown> = {};

  try {
    switch (toolCall.name) {
      case "get_company_info":
        result = { info: companyInfo };
        break;

      case "list_services":
        result = await withToolTimeout(
          Promise.all([
            getServicesByOrg(organizationId),
            getResourceServicesByOrg(organizationId),
          ]).then(([orgServices, assignments]) => ({
            services: orgServices
              .filter((service) => service.isActive)
              .map((service) => ({
                id: service.id,
                name: service.name,
                description: service.description,
                duration_minutes: service.durationMinutes,
                resources: assignments
                  .filter(
                    (item) =>
                      item.serviceId === service.id &&
                      item.serviceIsActive &&
                      item.resourceIsActive,
                  )
                  .map((item) => ({ id: item.resourceId, name: item.resourceName })),
              })),
          })),
        );
        break;

      case "create_booking_hold": {
        const args = holdArgumentsSchema.parse(toolCall.arguments);
        const [context] = await db
          .select({ contactId: conversations.contactId, status: conversations.status })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!context || context.status !== "AI_ACTIVE") {
          result = { success: false, error: "Atendimento não está sob controle da IA." };
          break;
        }

        const [service] = await db
          .select({ durationMinutes: services.durationMinutes })
          .from(services)
          .where(and(eq(services.id, args.service_id), eq(services.organizationId, organizationId)))
          .limit(1);
        if (!service) {
          result = { success: false, error: "Serviço não encontrado." };
          break;
        }

        const startsAt = new Date(args.starts_at);
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
        const hold = await withToolTimeout(
          createBookingHold({
            organizationId,
            resourceId: args.resource_id,
            serviceId: args.service_id,
            contactId: context.contactId,
            idempotencyKey: `${conversationId}:${toolCall.id}:hold`,
            startsAt,
            endsAt,
            expiresAt: new Date(Date.now() + 10 * 60_000),
            controlGuard: { conversationId, controlVersion: controlVersionCaptured },
          }),
        );
        result = {
          success: true,
          hold_id: hold.id,
          starts_at: hold.startsAt.toISOString(),
          ends_at: hold.endsAt.toISOString(),
          expires_at: hold.expiresAt.toISOString(),
          confirmed: false,
        };
        break;
      }

      case "find_available_slots": {
        const args = availabilityArgumentsSchema.parse(toolCall.arguments);
        const slots = await withToolTimeout(
          findAvailableSlots({
            organizationId,
            serviceId: args.service_id,
            date: args.date,
            ...(args.resource_id ? { resourceId: args.resource_id } : {}),
            limit: 12,
          }),
        );
        result = {
          success: true,
          date: args.date,
          slots: slots.map((slot) => ({
            resource_id: slot.resourceId,
            resource_name: slot.resourceName,
            starts_at: slot.startsAt.toISOString(),
            ends_at: slot.endsAt.toISOString(),
          })),
        };
        break;
      }

      case "confirm_booking": {
        const args = confirmArgumentsSchema.parse(toolCall.arguments);
        const [context] = await db
          .select({
            status: conversations.status,
            contactName: contacts.name,
            contactPhone: contacts.phone,
          })
          .from(conversations)
          .innerJoin(
            contacts,
            and(
              eq(conversations.contactId, contacts.id),
              eq(conversations.organizationId, contacts.organizationId),
            ),
          )
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!context || context.status !== "AI_ACTIVE") {
          result = { success: false, error: "Atendimento não está sob controle da IA." };
          break;
        }

        const booking = await withToolTimeout(
          confirmBookingFromHold({
            organizationId,
            holdId: args.hold_id,
            idempotencyKey: `${conversationId}:${toolCall.id}:booking`,
            customerName: context.contactName,
            customerPhone: context.contactPhone,
            controlGuard: { conversationId, controlVersion: controlVersionCaptured },
          }),
        );
        result = {
          success: true,
          booking_id: booking.id,
          starts_at: booking.startsAt.toISOString(),
          ends_at: booking.endsAt.toISOString(),
          status: booking.status,
        };
        break;
      }

      case "list_upcoming_bookings": {
        const [context] = await db
          .select({ contactId: conversations.contactId })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!context) {
          result = { success: false, error: "Conversa não encontrada." };
          break;
        }

        const upcoming = await withToolTimeout(
          db
            .select({
              id: bookings.id,
              serviceName: services.name,
              resourceName: resources.name,
              startsAt: bookings.startsAt,
              endsAt: bookings.endsAt,
            })
            .from(bookings)
            .innerJoin(
              services,
              and(
                eq(bookings.serviceId, services.id),
                eq(bookings.organizationId, services.organizationId),
              ),
            )
            .innerJoin(
              resources,
              and(
                eq(bookings.resourceId, resources.id),
                eq(bookings.organizationId, resources.organizationId),
              ),
            )
            .where(
              and(
                eq(bookings.organizationId, organizationId),
                eq(bookings.contactId, context.contactId),
                eq(bookings.status, "CONFIRMED"),
                gt(bookings.endsAt, new Date()),
              ),
            )
            .orderBy(asc(bookings.startsAt))
            .limit(10),
        );
        result = {
          success: true,
          bookings: upcoming.map((booking) => ({
            booking_id: booking.id,
            service_name: booking.serviceName,
            resource_name: booking.resourceName,
            starts_at: booking.startsAt.toISOString(),
            ends_at: booking.endsAt.toISOString(),
          })),
        };
        break;
      }

      case "cancel_booking": {
        const args = bookingIdArgumentsSchema.parse(toolCall.arguments);
        const cancelled = await withToolTimeout(
          cancelBooking(organizationId, args.booking_id, {
            conversationId,
            controlVersion: controlVersionCaptured,
          }),
        );
        result = cancelled
          ? { success: true, booking_id: cancelled.id, status: cancelled.status }
          : { success: false, error: "Agendamento não encontrado." };
        break;
      }

      case "reschedule_booking": {
        const args = rescheduleArgumentsSchema.parse(toolCall.arguments);
        const replacement = await withToolTimeout(
          rescheduleBookingFromHold({
            organizationId,
            bookingId: args.booking_id,
            holdId: args.hold_id,
            idempotencyKey: `${conversationId}:${toolCall.id}:reschedule`,
            controlGuard: { conversationId, controlVersion: controlVersionCaptured },
          }),
        );
        result = {
          success: true,
          booking_id: replacement.id,
          starts_at: replacement.startsAt.toISOString(),
          ends_at: replacement.endsAt.toISOString(),
          status: replacement.status,
        };
        break;
      }

      case "request_human_support": {
        // Handoff explícito: altera status da conversa para HUMAN_ACTIVE e incrementa controlVersion
        const [conv] = await db
          .select({ controlVersion: conversations.controlVersion })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.organizationId, organizationId),
            ),
          )
          .limit(1);

        const nextVersion = conv ? (parseInt(conv.controlVersion, 10) + 1).toString() : "1";

        await db
          .update(conversations)
          .set({
            status: "HUMAN_ACTIVE",
            controlVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.organizationId, organizationId),
            ),
          );

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
  } catch (error) {
    const expectedError =
      error instanceof z.ZodError ||
      error instanceof SchedulingConflictError ||
      error instanceof SchedulingValidationError;
    result = {
      success: false,
      error:
        expectedError && error instanceof Error ? error.message : "Falha ao executar ferramenta.",
    };
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
