import { auth } from "@/lib/auth";
import { getConversationsByOrg } from "@/lib/db/queries";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ConversationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const conversationsList = await getConversationsByOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Conversas WhatsApp
        </h1>
        <p className="text-sm text-zinc-500">
          Acompanhamento dos atendimentos em andamento, IA e intervenções humanas.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
            <tr>
              <th className="px-6 py-3">Contato</th>
              <th className="px-6 py-3">Telefone</th>
              <th className="px-6 py-3">Modo / Status</th>
              <th className="px-6 py-3">Versão de Controle</th>
              <th className="px-6 py-3">Última Mensagem</th>
              <th className="px-6 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {conversationsList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-500">
                  Nenhuma conversa registrada ainda. Aguardando mensagens do WhatsApp.
                </td>
              </tr>
            ) : (
              conversationsList.map((conv) => {
                const isHuman = conv.status === "HUMAN_ACTIVE";
                const isAI = conv.status === "AI_ACTIVE";

                return (
                  <tr key={conv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {conv.contactName}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{conv.contactPhone}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isHuman
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                            : isAI
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                              : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {isHuman ? "Intervenção Humana" : isAI ? "Agente IA Ativo" : conv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">v{conv.controlVersion}</td>
                    <td className="px-6 py-4 text-xs">
                      {conv.lastMessageAt ? conv.lastMessageAt.toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/conversations/${conv.id}`}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Abrir Chat
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
