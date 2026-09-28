import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">Bem-vindo, {session.user.name}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Organização: {(session.user as { organizationId: string }).organizationId}
      </p>
    </main>
  );
}
