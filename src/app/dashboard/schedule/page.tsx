import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  assignServiceToResourceAction,
  createAvailabilityExceptionAction,
  createAvailabilityRuleAction,
  createResourceAction,
  createServiceAction,
  deleteAvailabilityExceptionAction,
  deleteAvailabilityRuleAction,
  setResourceActiveAction,
  setServiceActiveAction,
  updateResourceAction,
  updateServiceAction,
} from "@/lib/actions/scheduling";
import { disconnectCalendarAction, testCalendarSyncAction } from "@/lib/actions/calendar";
import {
  getAvailabilityExceptionsByOrg,
  getAvailabilityRulesByOrg,
  getBookingsByRange,
  getCalendarConnectionsByOrg,
  getOrganizationById,
  getResourcesByOrg,
  getResourceServicesByOrg,
  getServicesByOrg,
} from "@/lib/db/queries";

const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const fieldClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";
const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { organizationId: string; role: string };
  const { view, error } = await searchParams;
  const selectedView = view === "day" ? "day" : "week";
  const now = new Date();
  const until = selectedView === "day" ? addDays(now, 1) : addDays(now, 7);
  const canManage = user.role === "admin" || user.role === "supervisor";

  const [
    organization,
    services,
    resources,
    assignments,
    rules,
    exceptions,
    appointments,
    calendarConnections,
  ] = await Promise.all([
    getOrganizationById(user.organizationId),
    getServicesByOrg(user.organizationId),
    getResourcesByOrg(user.organizationId),
    getResourceServicesByOrg(user.organizationId),
    getAvailabilityRulesByOrg(user.organizationId),
    getAvailabilityExceptionsByOrg(user.organizationId, now),
    getBookingsByRange(user.organizationId, now, until),
    getCalendarConnectionsByOrg(user.organizationId),
  ]);

  const calendarMap = new Map(
    calendarConnections
      .filter((conn) => conn.resourceId !== null)
      .map((conn) => [conn.resourceId as string, conn]),
  );

  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: organization?.timezone ?? "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handleCreateService(formData: FormData) {
    "use server";
    const result = await createServiceAction(formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleCreateResource(formData: FormData) {
    "use server";
    const result = await createResourceAction(formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleAssignService(formData: FormData) {
    "use server";
    const result = await assignServiceToResourceAction(formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleCreateAvailability(formData: FormData) {
    "use server";
    const result = await createAvailabilityRuleAction(formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleCreateException(formData: FormData) {
    "use server";
    const result = await createAvailabilityExceptionAction(formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleSetServiceActive(serviceId: string, isActive: boolean) {
    "use server";
    await setServiceActiveAction(serviceId, isActive);
  }

  async function handleSetResourceActive(resourceId: string, isActive: boolean) {
    "use server";
    await setResourceActiveAction(resourceId, isActive);
  }

  async function handleUpdateService(serviceId: string, formData: FormData) {
    "use server";
    const result = await updateServiceAction(serviceId, formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleUpdateResource(resourceId: string, formData: FormData) {
    "use server";
    const result = await updateResourceAction(resourceId, formData);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleDeleteAvailabilityRule(ruleId: string) {
    "use server";
    await deleteAvailabilityRuleAction(ruleId);
  }

  async function handleDeleteException(exceptionId: string) {
    "use server";
    await deleteAvailabilityExceptionAction(exceptionId);
  }

  async function handleDisconnectCalendar(resourceId: string) {
    "use server";
    const result = await disconnectCalendarAction(resourceId);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  async function handleTestSyncCalendar(resourceId: string) {
    "use server";
    const result = await testCalendarSyncAction(resourceId);
    if (result.error) redirect(`/dashboard/schedule?error=${encodeURIComponent(result.error)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Agenda
          </h1>
          <p className="text-sm text-zinc-500">
            Serviços, equipe e horários disponíveis · {organization?.timezone}
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          {[
            ["day", "Hoje"],
            ["week", "7 dias"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/dashboard/schedule?view=${value}`}
              className={`rounded-md px-3 py-1.5 text-sm ${selectedView === value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-300"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <section className={cardClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {selectedView === "day" ? "Agendamentos de hoje" : "Próximos 7 dias"}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="pb-3">Horário</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Serviço</th>
                <th className="pb-3">Responsável</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    Nenhum agendamento neste período.
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="py-3">{dateFormatter.format(appointment.startsAt)}</td>
                    <td className="py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {appointment.customerName}
                      </div>
                      <div className="text-xs text-zinc-500">{appointment.customerPhone}</div>
                    </td>
                    <td className="py-3">{appointment.serviceName}</td>
                    <td className="py-3">{appointment.resourceName}</td>
                    <td className="py-3 text-xs">{appointment.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={cardClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Serviços</h2>
            <form action={handleCreateService} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} name="name" required placeholder="Nome do serviço" />
              <input
                className={fieldClass}
                name="durationMinutes"
                type="number"
                min="5"
                max="1440"
                step="5"
                required
                placeholder="Duração em minutos"
              />
              <input
                className={`${fieldClass} sm:col-span-2`}
                name="description"
                placeholder="Descrição opcional"
              />
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                Adicionar serviço
              </button>
            </form>
            <div className="mt-5 space-y-2">
              {services.map((service) => (
                <details
                  key={service.id}
                  className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
                >
                  <summary className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    <span>{service.name}</span>{" "}
                    <span className="font-normal text-zinc-500">
                      · {service.durationMinutes} minutos
                    </span>
                  </summary>
                  <form
                    action={handleUpdateService.bind(null, service.id)}
                    className="mt-3 grid gap-2 sm:grid-cols-2"
                  >
                    <input
                      className={fieldClass}
                      name="name"
                      defaultValue={service.name}
                      required
                    />
                    <input
                      className={fieldClass}
                      name="durationMinutes"
                      type="number"
                      min="5"
                      max="1440"
                      step="5"
                      defaultValue={service.durationMinutes}
                      required
                    />
                    <input
                      className={`${fieldClass} sm:col-span-2`}
                      name="description"
                      defaultValue={service.description ?? ""}
                      placeholder="Descrição opcional"
                    />
                    <button className="text-left text-xs font-medium text-blue-700 dark:text-blue-300">
                      Salvar alterações
                    </button>
                  </form>
                  <form action={handleSetServiceActive.bind(null, service.id, !service.isActive)}>
                    <button className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {service.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </details>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Profissionais e recursos
            </h2>
            <form action={handleCreateResource} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} name="name" required placeholder="Nome" />
              <input className={fieldClass} name="description" placeholder="Descrição opcional" />
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                Adicionar recurso
              </button>
            </form>
            <div className="mt-5 space-y-2">
              {resources.map((resource) => (
                <details
                  key={resource.id}
                  className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
                >
                  <summary className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {resource.name}{" "}
                    <span className="font-normal text-zinc-500">
                      ·{" "}
                      {assignments
                        .filter((item) => item.resourceId === resource.id)
                        .map((item) => item.serviceName)
                        .join(", ") || "Nenhum serviço vinculado"}
                    </span>
                  </summary>
                  <form
                    action={handleUpdateResource.bind(null, resource.id)}
                    className="mt-3 grid gap-2 sm:grid-cols-2"
                  >
                    <input
                      className={fieldClass}
                      name="name"
                      defaultValue={resource.name}
                      required
                    />
                    <input
                      className={fieldClass}
                      name="description"
                      defaultValue={resource.description ?? ""}
                      placeholder="Descrição opcional"
                    />
                    <button className="text-left text-xs font-medium text-blue-700 dark:text-blue-300">
                      Salvar alterações
                    </button>
                  </form>
                  <form
                    action={handleSetResourceActive.bind(null, resource.id, !resource.isActive)}
                  >
                    <button className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {resource.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </details>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Vincular serviço ao responsável
            </h2>
            <form action={handleAssignService} className="mt-4 grid gap-3 sm:grid-cols-2">
              <select className={fieldClass} name="resourceId" required>
                <option value="">Selecione o responsável</option>
                {resources
                  .filter((item) => item.isActive)
                  .map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
              </select>
              <select className={fieldClass} name="serviceId" required>
                <option value="">Selecione o serviço</option>
                {services
                  .filter((item) => item.isActive)
                  .map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
              </select>
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                Vincular
              </button>
            </form>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Disponibilidade recorrente
            </h2>
            <form action={handleCreateAvailability} className="mt-4 grid gap-3 sm:grid-cols-2">
              <select className={fieldClass} name="resourceId" required>
                <option value="">Selecione o responsável</option>
                {resources
                  .filter((item) => item.isActive)
                  .map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
              </select>
              <select className={fieldClass} name="weekday" required>
                {weekdays.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
              <input className={fieldClass} name="startTime" type="time" required />
              <input className={fieldClass} name="endTime" type="time" required />
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                Adicionar horário
              </button>
            </form>
            <div className="mt-5 space-y-2 text-sm">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50"
                >
                  <span>
                    <span className="font-medium">{rule.resourceName}</span> ·{" "}
                    {weekdays[rule.weekday]} · {rule.startTime.slice(0, 5)}–
                    {rule.endTime.slice(0, 5)}
                  </span>
                  {canManage ? (
                    <form action={handleDeleteAvailabilityRule.bind(null, rule.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Remover
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Exceções e bloqueios</h2>
            <form action={handleCreateException} className="mt-4 grid gap-3 sm:grid-cols-2">
              <select className={fieldClass} name="resourceId" required>
                <option value="">Selecione o responsável</option>
                {resources
                  .filter((item) => item.isActive)
                  .map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
              </select>
              <select className={fieldClass} name="kind" required>
                <option value="BLOCKED">Bloquear período</option>
                <option value="AVAILABLE">Abrir período extra</option>
              </select>
              <input className={fieldClass} name="startsAt" type="datetime-local" required />
              <input className={fieldClass} name="endsAt" type="datetime-local" required />
              <input
                className={`${fieldClass} sm:col-span-2`}
                name="reason"
                placeholder="Motivo opcional"
              />
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                Adicionar exceção
              </button>
            </form>
            <div className="mt-5 space-y-2 text-sm">
              {exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50"
                >
                  <span>
                    <span className="font-medium">{exception.resourceName}</span> ·{" "}
                    {exception.kind === "BLOCKED" ? "Bloqueado" : "Horário extra"} ·{" "}
                    {dateFormatter.format(exception.startsAt)} até{" "}
                    {dateFormatter.format(exception.endsAt)}
                    {exception.reason ? ` · ${exception.reason}` : ""}
                  </span>
                  {canManage ? (
                    <form action={handleDeleteException.bind(null, exception.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Remover
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Google Calendar</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Sincronização bidirecional de disponibilidade e eventos com a agenda do Google.
                </p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {resources.length === 0 ? (
                <p className="py-2 text-xs text-zinc-400">Nenhum responsável cadastrado.</p>
              ) : (
                resources.map((resource) => {
                  const conn = calendarMap.get(resource.id);
                  return (
                    <div
                      key={resource.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {resource.name}
                        </p>
                        {conn ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {conn.accountEmail} · Calendário: {conn.calendarName} ·{" "}
                            <span
                              className={
                                conn.syncStatus === "CONNECTED"
                                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                                  : "font-medium text-amber-600 dark:text-amber-400"
                              }
                            >
                              {conn.syncStatus === "CONNECTED"
                                ? "Conectado"
                                : "Erro de sincronização"}
                            </span>
                            {conn.lastError ? ` (${conn.lastError})` : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400">
                            Nenhum calendário Google conectado
                          </p>
                        )}
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          {conn ? (
                            <>
                              <form action={handleTestSyncCalendar.bind(null, resource.id)}>
                                <button
                                  type="submit"
                                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  Testar
                                </button>
                              </form>
                              <form action={handleDisconnectCalendar.bind(null, resource.id)}>
                                <button
                                  type="submit"
                                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                  Desconectar
                                </button>
                              </form>
                            </>
                          ) : (
                            <a
                              href={`/api/calendar/google/auth?resourceId=${resource.id}`}
                              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                            >
                              Conectar Google
                            </a>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
