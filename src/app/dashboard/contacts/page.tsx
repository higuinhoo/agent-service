import { auth } from "@/lib/auth";
import { getContactsByOrg } from "@/lib/db/queries";
import { createContactAction, deleteContactAction } from "@/lib/actions/contacts";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const contactsList = await getContactsByOrg(orgId);

  async function handleCreate(formData: FormData) {
    "use server";
    await createContactAction(formData);
    revalidatePath("/dashboard/contacts");
  }

  async function handleDelete(contactId: string) {
    "use server";
    await deleteContactAction(contactId);
    revalidatePath("/dashboard/contacts");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Contatos
        </h1>
        <p className="text-sm text-zinc-500">Gerenciamento da base de clientes da sua empresa.</p>
      </div>

      {/* Form: Novo Contato */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Cadastrar Novo Contato
        </h2>
        <form action={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nome Completo
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Ex: Maria Silva"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Telefone (WhatsApp)
            </label>
            <input
              type="text"
              name="phone"
              required
              placeholder="Ex: 5511999998888"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Notas / Observações
            </label>
            <input
              type="text"
              name="notes"
              placeholder="Ex: Cliente preferencial"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Adicionar Contato
            </button>
          </div>
        </form>
      </div>

      {/* List: Tabela de Contatos */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
            <tr>
              <th className="px-6 py-3">Nome</th>
              <th className="px-6 py-3">Telefone</th>
              <th className="px-6 py-3">Notas</th>
              <th className="px-6 py-3">Cadastrado em</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {contactsList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-500">
                  Nenhum contato cadastrado ainda.
                </td>
              </tr>
            ) : (
              contactsList.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {c.name}
                  </td>
                  <td className="px-6 py-4">{c.phone}</td>
                  <td className="px-6 py-4 text-xs">{c.notes ?? "—"}</td>
                  <td className="px-6 py-4 text-xs">{c.createdAt.toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-right">
                    <form action={handleDelete.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Excluir
                      </button>
                    </form>
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
