import { auth } from "@/lib/auth";
import { getOrganizationById, getUsersByOrg, getContactsByOrg } from "@/lib/db/queries";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const org = await getOrganizationById(orgId);
  const usersList = await getUsersByOrg(orgId);
  const contactsList = await getContactsByOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Visão Geral
        </h1>
        <p className="text-sm text-zinc-500">
          Painel de controle e métricas básicas da sua empresa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-500">Organização</div>
          <div className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">{org?.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Slug: {org?.slug}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                org?.suspended
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              }`}
            >
              {org?.suspended ? "Suspensa" : "Ativa"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-500">Equipe</div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {usersList.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {usersList.filter((u) => u.isActive).length} membros ativos
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-500">Contatos Cadastrados</div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {contactsList.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Base de clientes isolada</div>
        </div>
      </div>
    </div>
  );
}
