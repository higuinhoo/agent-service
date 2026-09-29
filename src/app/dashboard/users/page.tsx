import { auth } from "@/lib/auth";
import { getUsersByOrg } from "@/lib/db/queries";
import { createUserAction, toggleUserActiveAction } from "@/lib/actions/users";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const currentUserRole = (session.user as { role: string }).role;
  const usersList = await getUsersByOrg(orgId);

  async function handleCreate(formData: FormData) {
    "use server";
    await createUserAction(formData);
    revalidatePath("/dashboard/users");
  }

  async function handleToggleStatus(userId: string, currentStatus: boolean) {
    "use server";
    await toggleUserActiveAction(userId, !currentStatus);
    revalidatePath("/dashboard/users");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Usuários & Equipe
        </h1>
        <p className="text-sm text-zinc-500">
          Controle de membros, permissões e status de acesso na organização.
        </p>
      </div>

      {/* Form: Novo Usuário (somente para admin) */}
      {currentUserRole === "admin" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Cadastrar Novo Membro
          </h2>
          <form action={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Nome
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Ex: João Souza"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                E-mail
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="joao@empresa.com"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Papel / Função
              </label>
              <select
                name="role"
                defaultValue="agent"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="agent">Atendente (Agent)</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Senha Provisória
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="Mínimo 8 caracteres"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div className="sm:col-span-4">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Cadastrar Usuário
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List: Tabela de Usuários */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
            <tr>
              <th className="px-6 py-3">Nome</th>
              <th className="px-6 py-3">E-mail</th>
              <th className="px-6 py-3">Papel</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Cadastrado em</th>
              {currentUserRole === "admin" && <th className="px-6 py-3 text-right">Ação</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {usersList.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{u.name}</td>
                <td className="px-6 py-4">{u.email}</td>
                <td className="px-6 py-4 capitalize">{u.role}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                    }`}
                  >
                    {u.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs">{u.createdAt.toLocaleDateString("pt-BR")}</td>
                {currentUserRole === "admin" && (
                  <td className="px-6 py-4 text-right">
                    <form action={handleToggleStatus.bind(null, u.id, u.isActive)}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        {u.isActive ? "Desativar" : "Reativar"}
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
