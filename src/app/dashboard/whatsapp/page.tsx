import { auth } from "@/lib/auth";
import { getOrganizationById } from "@/lib/db/queries";
import {
  saveWahaSessionAction,
  startWahaSessionAction,
  stopWahaSessionAction,
} from "@/lib/actions/whatsapp";
import { getSessionStatus, getQRCode } from "@/lib/waha/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function WhatsappSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const userRole = (session.user as { role: string }).role;
  const org = await getOrganizationById(orgId);

  const sessionName = org?.wahaSession || "default";
  const status = await getSessionStatus(sessionName);
  let qrCode: string | null = null;
  if (status === "SCAN_QR_CODE") {
    qrCode = await getQRCode(sessionName);
  }

  async function handleSaveSession(formData: FormData) {
    "use server";
    await saveWahaSessionAction(formData);
    revalidatePath("/dashboard/whatsapp");
  }

  async function handleStart() {
    "use server";
    await startWahaSessionAction();
    revalidatePath("/dashboard/whatsapp");
  }

  async function handleStop() {
    "use server";
    await stopWahaSessionAction();
    revalidatePath("/dashboard/whatsapp");
  }

  const isWorking = status === "WORKING";
  const isScanQr = status === "SCAN_QR_CODE";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Conexão WhatsApp (WAHA)
        </h1>
        <p className="text-sm text-zinc-500">
          Gerenciamento da sessão e pareamento do WhatsApp da sua empresa.
        </p>
      </div>

      {/* Cartão de Status da Sessão */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-zinc-500">Status da Conexão</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Sessão: {sessionName}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isWorking
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                    : isScanQr
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {!isWorking && (
              <form action={handleStart}>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-700"
                >
                  Iniciar Conexão
                </button>
              </form>
            )}

            {isWorking && (
              <form action={handleStop}>
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  Desconectar
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Exibição de QR Code quando aguardando pareamento */}
        {isScanQr && (
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Escaneie o QR Code no seu WhatsApp
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho.
            </p>
            {qrCode ? (
              <div className="mt-4 inline-block rounded-lg bg-white p-4 shadow">
                <pre className="font-mono text-[9px] leading-none">{qrCode}</pre>
              </div>
            ) : (
              <div className="mt-4 text-xs text-zinc-400">
                Gerando QR Code... Recarregue a página em alguns instantes.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuração de Sessão (Admin) */}
      {userRole === "admin" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Configurar Nome da Sessão WAHA
          </h2>
          <p className="text-xs text-zinc-500">
            Cada empresa possui uma sessão exclusiva no WAHA garantindo total isolamento de
            mensagens.
          </p>

          <form action={handleSaveSession} className="mt-4 flex gap-3">
            <input
              type="text"
              name="sessionName"
              defaultValue={sessionName}
              required
              className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Salvar Sessão
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
