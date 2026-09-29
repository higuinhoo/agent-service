# Tarefas

Atualizado em: 2026-09-29

## ATIVA — T-007: integração Google Calendar (Fase 5)

Objetivo: integrar com Google Calendar via OAuth, sincronizar disponibilidade (FreeBusy) e criar/compensar eventos sem divergência com a agenda local.

- [x] Schema e tabelas `calendar_connections` e `external_calendar_events`;
- [x] Conexão OAuth 2.0 (início de fluxo, callback e renovação de tokens);
- [x] Consulta de disponibilidade externa (Google Calendar FreeBusy);
- [x] Criação, atualização e cancelamento de eventos externos com idempotência e compensação de falha;
- [x] Integração da verificação FreeBusy na geração de slots da agenda;
- [x] Interface no painel da agenda para conectar/desconectar calendário por profissional;
- [x] Testes automatizados de contrato, adapter, FreeBusy e compensação de erro.

Critério de conclusão:

- A IA só confirma após o calendário externo confirmar ou agenda local independente com registro visível;
- Falhas externas não geram confirmação falsa e liberam/expiram o hold;
- Testes automatizados passando.

## Próximas

### T-008: operação para piloto (Fase 6)

Painel administrativo de saúde, fila de falhas, políticas de retenção, backup/restauração e deploy piloto.

## Concluídas

- [x] T-006 — agenda local (Fase 4: serviços, recursos, disponibilidade recorrente, exceções/bloqueios, holds temporários com expiração, anti-double booking via advisory lock e exclusion constraint, visualização diária/semanal, tools de IA e 29/29 testes passando com PostgreSQL 16 real).

- [x] T-005 — controle humano e runtime do agente IA (Fase 3: transições de estado, proteção atômica pré-envio contra corrida com intervenção humana, ferramentas permitidas, handoff para humano via tool ou dashboard D-004, devolução manual à IA D-005, persistência de runs e tool calls, UI de configuração do agente e 14/14 testes passando).
- [x] T-004 — integração WAHA e persistência de conversas (Fase 2: webhook HMAC no corpo bruto, resolução de tenant por sessão confiável, deduplicação com idempotência, detecção de intervenção humana D-004, processamento de ACKs, outbox com verificação atômica pré-envio, UI de conversas, chat e pareamento WhatsApp).
- [x] T-003 — identidade e isolamento (Fase 1: login, layout com sidebar, gestão de usuários com roles, gestão de contatos, suspensão de organização, trilha de auditoria e testes de isolamento multi-tenant).
- [x] T-002 — fundação do repositório (Next.js 15, Drizzle, NextAuth v5, pg-boss, worker, Docker Compose, Vitest, ESLint, Prettier).
- [x] T-001 — fechar decisões técnicas da Fase 0 (D-006 a D-012 aprovadas).
- [x] T-000B — otimizar contexto e orquestração entre Codex e Antigravity.
- [x] T-000 — documentar escopo, arquitetura conceitual, roadmap e protocolo portátil de agentes.

## Regra

Só pode existir uma seção marcada como **ATIVA**. Um agente não promove a próxima tarefa sem concluir a atual ou receber direção explícita do usuário.
