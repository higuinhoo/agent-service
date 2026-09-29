import { auth, signOut } from "@/lib/auth";
import { getOrganizationById } from "@/lib/db/queries";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const orgId = (session.user as { organizationId: string }).organizationId;
  const userRole = (session.user as { role: string }).role;
  const org = await getOrganizationById(orgId);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Agent Service
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {org?.name ?? "Organização"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {session.user.name}
            </div>
            <div className="text-xs text-zinc-500 capitalize">{userRole}</div>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* Main Container with Sidebar / Navigation */}
      <div className="flex flex-1">
        <aside className="w-56 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Visão Geral
            </Link>
            <Link
              href="/dashboard/conversations"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Conversas
            </Link>
            <Link
              href="/dashboard/contacts"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Contatos
            </Link>
            <Link
              href="/dashboard/users"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Usuários
            </Link>
            <Link
              href="/dashboard/whatsapp"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              WhatsApp
            </Link>
            <Link
              href="/dashboard/agent"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Agente IA
            </Link>
            <Link
              href="/dashboard/audit"
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Auditoria
            </Link>
          </nav>
        </aside>

        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
