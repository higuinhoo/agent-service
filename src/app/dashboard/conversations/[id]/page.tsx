import { auth } from "@/lib/auth";
import { getConversationById, getMessagesByConversation } from "@/lib/db/queries";
import { sendManualReplyAction } from "@/lib/actions/whatsapp";
import { takeoverConversationAction, returnConversationToAiAction } from "@/lib/actions/agent";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const { id: conversationId } = await params;

  const conv = await getConversationById(conversationId, orgId);
  if (!conv) notFound();

  const messagesList = await getMessagesByConversation(conversationId, orgId);

  async function handleSendMessage(formData: FormData) {
    "use server";
    const text = formData.get("message")?.toString() ?? "";
    await sendManualReplyAction(conversationId, text);
    revalidatePath(`/dashboard/conversations/${conversationId}`);
  }

  const isHuman = conv.status === "HUMAN_ACTIVE";
  const isAI = conv.status === "AI_ACTIVE";

  async function handleTakeover() {
    "use server";
    await takeoverConversationAction(conversationId);
    revalidatePath(`/dashboard/conversations/${conversationId}`);
  }

  async function handleReturnToAi() {
    "use server";
    await returnConversationToAiAction(conversationId);
    revalidatePath(`/dashboard/conversations/${conversationId}`);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header do Chat */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {conv.contactName}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isHuman
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                  : isAI
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {isHuman ? "Intervenção Humana (IA Pausada)" : isAI ? "Agente IA Ativo" : conv.status}
            </span>
          </div>
          <div className="text-xs text-zinc-500">
            WhatsApp: {conv.contactPhone} • Controle: v{conv.controlVersion}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isHuman ? (
            <form action={handleReturnToAi}>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
              >
                Devolver à IA
              </button>
            </form>
          ) : (
            <form action={handleTakeover}>
              <button
                type="submit"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
              >
                Assumir Atendimento
              </button>
            </form>
          )}

          <Link
            href="/dashboard/conversations"
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Voltar para lista
          </Link>
        </div>
      </div>

      {/* Histórico de Mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messagesList.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            Nenhuma mensagem nesta conversa.
          </div>
        ) : (
          messagesList.map((m) => {
            const isOut = m.direction === "OUTBOUND";

            return (
              <div key={m.id} className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                    isOut
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>

                <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                  <span>
                    {m.createdAt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{m.sentBy}</span>
                  {isOut && (
                    <>
                      <span>•</span>
                      <span>{m.deliveryStatus}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Caixa de Envio Manual */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <form action={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            name="message"
            required
            autoComplete="off"
            placeholder="Digite sua resposta manual (assumir atendimento)..."
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Enviar
          </button>
        </form>
        <p className="mt-2 text-[11px] text-zinc-400">
          Nota: O envio manual transfere automaticamente o atendimento para modo humano e pausa a
          IA.
        </p>
      </div>
    </div>
  );
}
