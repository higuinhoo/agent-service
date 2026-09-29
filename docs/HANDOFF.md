# Handoff atual

Atualizado em: 2026-09-28

## Objetivo

Fase 2 (Integração WAHA e persistência de conversas) concluída: webhook seguro com HMAC e idempotência, detecção de intervenção humana (D-004), outbox com verificação atômica pré-envio, chat em tempo real e pareamento WhatsApp.

## Mudanças

- Schema Drizzle: `messageDeliveryStatusEnum`, campos `deliveryStatus` e `ack` em `messages`, tabela `webhook_events`;
- Cliente WAHA (`src/lib/waha/client.ts`): suporte a start/stop de sessões, QR Code, envio de mensagens e status;
- Handler de webhook (`src/lib/waha/webhook-handler.ts`): resolução segura de organização por sessão, deduplicação em banco, classificação de intervenção humana (`fromMe=true + source=app`) elevando `control_version`, processamento de ACKs;
- Módulo Outbox (`src/lib/waha/outbox.ts`): persistência prévia e verificação atômica pré-envio impedindo que IA envie mensagens concorrentes após intervenção humana;
- Worker atualizado (`worker/index.ts`): processa `PROCESS_INBOUND` e `SEND_OUTBOUND`;
- UI de Conversas (`/dashboard/conversations` e `/dashboard/conversations/[id]`): lista de atendimentos com versão de controle e chat com envio de resposta manual;
- UI de Conexão WhatsApp (`/dashboard/whatsapp`): pareamento, exibição de QR Code e gerenciamento de sessão;
- Testes automatizados (`src/test/waha/waha-integration.test.ts`): 10/10 testes passando no Vitest.

## Arquivos

`src/lib/waha/*`, `src/app/api/webhooks/waha/route.ts`, `worker/index.ts`, `src/app/dashboard/conversations/*`, `src/app/dashboard/whatsapp/*`, `src/test/waha/*`, `docs/*`.

## Verificação

- `pnpm check` executado — 100% verde (ESLint, Prettier, TypeScript, Vitest com 10 testes passando);
- Sincronização pronta para envio ao GitHub.

## Riscos

- O engine NOWEB do WAHA deve estar conectado para entrega de mensagens reais em ambiente live.

## Próximo passo único

Executar T-005: implementar o controle humano formal e runtime do agente de IA com tool calling e devolução manual.
