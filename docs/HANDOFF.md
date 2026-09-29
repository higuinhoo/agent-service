# Handoff atual

Atualizado em: 2026-09-28

## Objetivo

Fase 3 (Controle humano e runtime do agente IA) concluída: transições formais de estado, devolução manual à IA (D-005), assunção por atendente (D-004), runtime de execução do agente com tool calling (`executeAgentTurn`), persistência de runs e UI de configuração.

## Mudanças

- Schema Drizzle: tabelas `agent_configs`, `agent_runs`, `tool_calls` e enum `agent_run_status`;
- Adapter de IA (`src/lib/ai/index.ts`): suporte nativo a tool calling (function calling);
- Runtime do Agente (`src/lib/ai/runtime.ts`): loop de turnos, ferramentas (`get_company_info`, `list_services`, `request_human_support`), verificação atômica pré-envio contra corrida com atendente e registro estruturado de runs;
- Server actions de IA (`src/lib/actions/agent.ts`): `returnConversationToAiAction`, `takeoverConversationAction`, `updateAgentConfigAction`;
- Worker (`worker/index.ts`): execução do agente IA ao consumir mensagens da fila `PROCESS_INBOUND`;
- UI de Conversa: botões no header para assumir atendimento ou devolver para a IA;
- UI do Agente (`/dashboard/agent`): formulário de instruções, dados institucionais, temperatura e ativação;
- Testes automatizados (`src/test/ai/ai-runtime.test.ts`): 14/14 testes passando no Vitest.

## Arquivos

`src/lib/ai/*`, `src/lib/actions/agent.ts`, `src/app/dashboard/agent/*`, `src/app/dashboard/conversations/[id]/*`, `worker/index.ts`, `src/test/ai/*`, `docs/*`.

## Verificação

- `pnpm check` executado — 100% verde (ESLint, Prettier, TypeScript, Vitest com 14 testes passando);
- Sincronização pronta para envio ao GitHub.

## Riscos

- Na Fase 4, assegurar que as ferramentas de agendamento compartilhem a mesma transação no banco para impedir sobreposição (double-booking).

## Próximo passo único

Executar T-006: implementar a agenda local (serviços, recursos, disponibilidade recorrente, bloqueios e holds sem sobreposição).
