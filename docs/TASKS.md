# Tarefas

Atualizado em: 2026-09-28

## ATIVA — T-002: fundação do repositório

Objetivo: scaffold mínimo funcional e verificável da aplicação.

- [ ] Inicializar Next.js (App Router) + TypeScript estrito;
- [ ] Configurar Tailwind CSS + shadcn/ui;
- [ ] Configurar Drizzle ORM + schema base (organizations, users);
- [ ] Configurar NextAuth.js (credentials + JWT);
- [ ] Configurar pg-boss (fila persistente);
- [ ] Criar processo worker separado;
- [ ] Configurar Docker Compose (web, worker, postgres, waha);
- [ ] Configurar lint (ESLint), formatação (Prettier) e testes (Vitest);
- [ ] Criar comando único de verificação (`pnpm check`);
- [ ] Documentar execução local (`docs/DEV.md`).

Critério de conclusão:

- `pnpm check` passa sem erros;
- containers sobem com `docker compose up`;
- login funcional com usuário seed.

## Próximas

### T-003: identidade e isolamento (Fase 1)

Executar Fase 1 do `docs/ROADMAP.md` após T-002: schema completo de tenant, convites, permissões e seed de dados.

### T-004: integração WAHA

Configurar sessão WAHA, webhook HMAC, validação de `message.any` e persistência de conversa.

## Concluídas

- [x] T-001 — fechar decisões técnicas da Fase 0 (D-006 a D-012 aprovadas).
- [x] T-000B — otimizar contexto e orquestração entre Codex e Antigravity.
- [x] T-000 — documentar escopo, arquitetura conceitual, roadmap e protocolo portátil de agentes.

## Regra

Só pode existir uma seção marcada como **ATIVA**. Um agente não promove a próxima tarefa sem concluir a atual ou receber direção explícita do usuário.
