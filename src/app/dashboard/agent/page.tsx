import { auth } from "@/lib/auth";
import { getAgentConfigByOrg } from "@/lib/db/queries";
import { updateAgentConfigAction } from "@/lib/actions/agent";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function AgentConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const userRole = (session.user as { role: string }).role;
  const config = await getAgentConfigByOrg(orgId);

  async function handleSave(formData: FormData) {
    "use server";
    await updateAgentConfigAction(formData);
    revalidatePath("/dashboard/agent");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Configuração do Agente IA
        </h1>
        <p className="text-sm text-zinc-500">
          Personalize as instruções, contexto e comportamento do assistente virtual do seu WhatsApp.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div>
            <span className="text-xs font-medium text-zinc-500">Versão Publicada</span>
            <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
              v{config?.version ?? "1"}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              config?.isActive
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
            }`}
          >
            {config?.isActive ? "Agente Ativo" : "Agente Pausado"}
          </span>
        </div>

        {userRole === "admin" ? (
          <form action={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Nome do Assistente
              </label>
              <input
                type="text"
                name="name"
                defaultValue={config?.name ?? "Atendente Virtual IA"}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Instruções do Sistema (System Prompt)
              </label>
              <p className="text-[11px] text-zinc-400">
                Defina o papel e tom de voz do agente. O agente tem acesso nativo a ferramentas para
                transferir para atendimento humano quando necessário.
              </p>
              <textarea
                name="systemPrompt"
                rows={5}
                defaultValue={config?.systemPrompt}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Informações Institucionais & Regras da Empresa
              </label>
              <p className="text-[11px] text-zinc-400">
                Endereço, horários de funcionamento, canais de contato e orientações gerais que o
                agente usará como base de conhecimento confiável.
              </p>
              <textarea
                name="companyInfo"
                rows={4}
                defaultValue={config?.companyInfo}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Temperatura (Criatividade)
                </label>
                <input
                  type="text"
                  name="temperature"
                  defaultValue={config?.temperature ?? "0.7"}
                  required
                  placeholder="0.0 a 1.0 (padrão: 0.7)"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  defaultChecked={config?.isActive ?? true}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Habilitar respostas automáticas da IA
                </label>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Nome: </span>
              {config?.name}
            </div>
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Instruções: </span>
              <p className="mt-1 rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-wrap dark:bg-zinc-800/50">
                {config?.systemPrompt}
              </p>
            </div>
            <p className="text-xs text-zinc-400 italic">
              Apenas administradores podem editar o agente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
