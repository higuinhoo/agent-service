# Tarefas

Atualizado em: 2026-09-28

## ATIVA — T-004: integração WAHA e persistência de conversas (Fase 2)

Objetivo: receber e armazenar mensagens reais do WhatsApp via WAHA com idempotência, HMAC e rastreabilidade.

- [ ] Gerenciamento de sessão WAHA por organização;
- [ ] Endpoints e polling de status da sessão (`session.status`, QR code);
- [ ] Ingestão robusta de webhook com validação HMAC e idempotência via `waha_message_id`;
- [ ] Outbox para envio confiável de mensagens de texto;
- [ ] Processamento de confirmações (`message.ack`);
- [ ] Interface básica de listagem e detalhe de conversas;
- [ ] Alertas e health check de conexão.

Critério de conclusão:

- Mensagem simulada ou real entra via webhook, é armazenada sem duplicidade e reflete na conversa;
- Envio de resposta manual registrado na fila com status rastreável;
- Testes automatizados passando.

## Próximas

### T-005: controle humano e runtime do agente IA (Fase 3)

Estados de controle (`HUMAN_ACTIVE`, `AI_ACTIVE`), `control_version` com proteção contra envio concorrente, runtime de IA com ferramentas permitidas e limites de execução.

## Concluídas

- [x] T-003 — identidade e isolamento (Fase 1: login, layout com sidebar, gestão de usuários com roles, gestão de contatos, suspensão de organização, trilha de auditoria e testes de isolamento multi-tenant).
- [x] T-002 — fundação do repositório (Next.js 15, Drizzle, NextAuth v5, pg-boss, worker, Docker Compose, Vitest, ESLint, Prettier).
- [x] T-001 — fechar decisões técnicas da Fase 0 (D-006 a D-012 aprovadas).
- [x] T-000B — otimizar contexto e orquestração entre Codex e Antigravity.
- [x] T-000 — documentar escopo, arquitetura conceitual, roadmap e protocolo portátil de agentes.

## Regra

Só pode existir uma seção marcada como **ATIVA**. Um agente não promove a próxima tarefa sem concluir a atual ou receber direção explícita do usuário.
