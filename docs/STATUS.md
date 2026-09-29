# Estado atual

Atualizado em: 2026-09-28

## Fase

Fase 1 concluída — T-003 (Identidade e isolamento) concluída. ATIVA: T-004 (Fase 2: WAHA e persistência de conversas).

## O que existe

- escopo, arquitetura, roadmap e decisões documentados (D-001–D-013 aprovadas);
- scaffold Next.js 15 (App Router) + TypeScript estrito + Tailwind CSS;
- schema Drizzle completo: organizations (com suporte a suspensão), users, contacts, conversations, messages, audit_logs;
- autenticação NextAuth.js v5 (credentials + JWT, isolamento por organization_id, bloqueio de organizações suspensas);
- interface de usuário funcional:
  - tela de login elegante e responsiva;
  - layout do dashboard com cabeçalho, indicador de tenant e menu lateral navegável;
  - visão geral com métricas de equipe, tenant e contatos;
  - módulo de contatos: listagem, cadastro e exclusão;
  - módulo de equipe / usuários: controle de membros, papéis (admin/supervisor/agent) e ativação/desativação;
  - módulo de auditoria: trilha imutável de eventos por tenant;
- server actions seguras e tipadas com validação Zod e gravação automática de logs de auditoria;
- testes automatizados de isolamento multi-tenant (Vitest: 5/5 testes passando);
- fila pg-boss com filas PROCESS_INBOUND e SEND_OUTBOUND;
- worker Node separado (consumer da fila);
- cliente WAHA com verificação HMAC e envio de texto;
- webhook `/api/webhooks/waha` com HMAC + enfileiramento idempotente;
- Docker Compose: web, worker, postgres, waha;
- `pnpm check` 100% verde: lint ✅ format ✅ typecheck ✅ tests ✅.

## O que não existe

- interface de conversas e chat em tempo real (Fase 2);
- sincronização de status de sessão WAHA via UI (Fase 2);
- controle humano vs IA (`control_version`) e runtime do agente (Fase 3);
- agendamento e calendário local / Google Calendar (Fases 4 e 5).
