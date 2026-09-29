# Handoff atual

Atualizado em: 2026-09-29

## Objetivo

Fase 5 (Google Calendar) concluída. Avançar para Fase 6 (Operação para Piloto — resiliência, Docker com volumes reais, saúde e políticas operacionais).

## Mudanças

- Schema e migration `0001_light_loners.sql` para `calendar_connections` e `external_calendar_events` com enums de status;
- Cliente Google Calendar (`src/lib/calendar/google.ts`) para OAuth 2.0, renovação automática de access token expirado, FreeBusy e CRUD de eventos;
- Consulta de slots disponíveis (`findAvailableSlots`) unificada com o FreeBusy do Google Calendar por profissional;
- Confirmação transacional vinculada (`confirmBookingFromHold`): o evento externo é gerado com requestId idempotente, gravado em `external_calendar_events`, e qualquer falha externa libera/expira o hold impedindo confirmação falsa;
- Compensação atômica em caso de rollback local e exclusão externa na ação de cancelamento (`cancelBooking`);
- Endpoints de autenticação OAuth `/api/calendar/google/auth` e `/api/calendar/google/callback` com validação de tenant no state;
- Interface no painel da agenda (`/dashboard/schedule`) com listagem de status por responsável, botões de teste de sincronização, conexão e desconexão;
- Suíte de 7 novos testes automatizados cobrindo OAuth, FreeBusy, criação idempotente e remoção.

## Verificação

- `pnpm check` verde: lint ✅ format ✅ typecheck ✅ 31 testes unitários/contrato passando;
- `RUN_DATABASE_TESTS=1` verde: 36 testes passando no total com PostgreSQL 16 real;
- `pnpm build` verde: build de produção do Next.js gerou todas as 16 rotas sem erros;
- Migrations `0000` e `0001` aplicadas com sucesso no banco de dados local.

## Riscos

- Variáveis de ambiente `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` precisam ser provisionadas no console do Google Cloud para uso em ambiente de produção;
- A fila do pg-boss no worker deve ser mantida em execução contínua para limpeza de holds e envio de outbox.

## Próximo passo único

Iniciar T-008 (Fase 6 — Operação para Piloto): painel de saúde e observabilidade, políticas de retenção, backup/restauração e deploy piloto com Docker Compose.
