# Tarefas

Atualizado em: 2026-09-28

## ATIVA — T-005: controle humano e runtime do agente IA (Fase 3)

Objetivo: gerenciar os estados de conversa, proteção atômica pré-envio (`control_version`), runtime de IA com ferramentas permitidas e limites de execução.

- [ ] Estados formais da conversa (`OPEN`, `AI_ACTIVE`, `HUMAN_ACTIVE`, `CLOSED`);
- [ ] Mecanismo de devolução manual da conversa para a IA no painel (D-005);
- [ ] Runtime do agente: prompts estruturados, adapter agnóstico e tool calling;
- [ ] Ferramentas permitidas iniciais (consulta de horários e agendamento);
- [ ] Limites de tempo, chamadas e custo por turno do agente;
- [ ] Registro estruturado de runs e tool calls no banco;
- [ ] Teste automatizado de proteção contra corrida e cancelamento pré-envio.

Critério de conclusão:

- IA gera respostas com tool calling quando em `AI_ACTIVE`;
- Intervenção humana impede envio concorrente em qualquer estágio do processamento;
- Testes automatizados passando.

## Próximas

### T-006: agenda local (Fase 4)

Serviços, disponibilidade recorrente, bloqueios, holds com expiração e criação sem sobreposição.

## Concluídas

- [x] T-004 — integração WAHA e persistência de conversas (Fase 2: webhook HMAC no corpo bruto, resolução de tenant por sessão confiável, deduplicação com idempotência, detecção de intervenção humana D-004, processamento de ACKs, outbox com verificação atômica pré-envio, UI de conversas, chat e pareamento WhatsApp).
- [x] T-003 — identidade e isolamento (Fase 1: login, layout com sidebar, gestão de usuários com roles, gestão de contatos, suspensão de organização, trilha de auditoria e testes de isolamento multi-tenant).
- [x] T-002 — fundação do repositório (Next.js 15, Drizzle, NextAuth v5, pg-boss, worker, Docker Compose, Vitest, ESLint, Prettier).
- [x] T-001 — fechar decisões técnicas da Fase 0 (D-006 a D-012 aprovadas).
- [x] T-000B — otimizar contexto e orquestração entre Codex e Antigravity.
- [x] T-000 — documentar escopo, arquitetura conceitual, roadmap e protocolo portátil de agentes.

## Regra

Só pode existir uma seção marcada como **ATIVA**. Um agente não promove a próxima tarefa sem concluir a atual ou receber direção explícita do usuário.
