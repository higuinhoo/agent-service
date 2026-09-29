import { auth } from "@/lib/auth";
import { getAuditLogsByOrg } from "@/lib/db/queries";
import { redirect } from "next/navigation";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const logs = await getAuditLogsByOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Trilha de Auditoria
        </h1>
        <p className="text-sm text-zinc-500">
          Registro imutável de eventos e ações executadas dentro da sua organização.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
            <tr>
              <th className="px-6 py-3">Data / Hora</th>
              <th className="px-6 py-3">Responsável</th>
              <th className="px-6 py-3">Ação</th>
              <th className="px-6 py-3">Recurso</th>
              <th className="px-6 py-3">ID do Recurso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-500">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-mono text-xs">
                    {log.createdAt.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {log.actorEmail}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 capitalize">{log.resourceType}</td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                    {log.resourceId ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
