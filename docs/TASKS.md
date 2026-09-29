# Tarefas

Atualizado em: 2026-09-29

## ATIVA — T-006: agenda local (Fase 4)

Objetivo: gerenciar serviços, profissionais/recursos, disponibilidade recorrente, bloqueios de horário e holds temporários sem sobreposição.

- [x] CRUD operacional de serviços (`services`) com edição e desativação segura;
- [x] CRUD operacional de profissionais/recursos (`resources`) com edição e desativação segura;
- [x] Regras de disponibilidade recorrente e exceções — criação, listagem e remoção;
- [x] Holds temporários com expiração transacional e limpeza periódica pelo worker;
- [x] Criação, confirmação, cancelamento e reagendamento transacional de agendamentos;
- [x] Restrição estrita de banco contra sobreposição de horários (anti-double booking);
- [x] Visualização de agenda no painel (visão diária e semanal);
- [x] Ferramentas do agente IA para listar serviços, consultar slots, criar hold e confirmar agendamento;
- [ ] Testes automatizados — unitários e contrato SQL prontos; integração concorrente com PostgreSQL pendente.

Critério de conclusão:

- Dois pedidos simultâneos não conseguem confirmar o mesmo recurso e horário;
- Holds expiram automaticamente liberando o slot;
- Testes automatizados passando.

## Próximas

### T-007: integração Google Calendar (Fase 5)

Conexão OAuth, seleção de calendário, consulta de períodos ocupados (FreeBusy), criação e compensação de falha.

## Concluídas

- [x] T-005 — controle humano e runtime do agente IA (Fase 3: transições de estado, proteção atômica pré-envio contra corrida com intervenção humana, ferramentas permitidas, handoff para humano via tool ou dashboard D-004, devolução manual à IA D-005, persistência de runs e tool calls, UI de configuração do agente e 14/14 testes passando).
- [x] T-004 — integração WAHA e persistência de conversas (Fase 2: webhook HMAC no corpo bruto, resolução de tenant por sessão confiável, deduplicação com idempotência, detecção de intervenção humana D-004, processamento de ACKs, outbox com verificação atômica pré-envio, UI de conversas, chat e pareamento WhatsApp).
- [x] T-003 — identidade e isolamento (Fase 1: login, layout com sidebar, gestão de usuários com roles, gestão de contatos, suspensão de organização, trilha de auditoria e testes de isolamento multi-tenant).
- [x] T-002 — fundação do repositório (Next.js 15, Drizzle, NextAuth v5, pg-boss, worker, Docker Compose, Vitest, ESLint, Prettier).
- [x] T-001 — fechar decisões técnicas da Fase 0 (D-006 a D-012 aprovadas).
- [x] T-000B — otimizar contexto e orquestração entre Codex e Antigravity.
- [x] T-000 — documentar escopo, arquitetura conceitual, roadmap e protocolo portátil de agentes.

## Regra

Só pode existir uma seção marcada como **ATIVA**. Um agente não promove a próxima tarefa sem concluir a atual ou receber direção explícita do usuário.
