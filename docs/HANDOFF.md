# Handoff atual

Atualizado em: 2026-09-29

## Objetivo

Continuar T-006 e concluir a agenda local sem ampliar o escopo do MVP.

## Mudanças

- Schema e migration inicial para serviços, recursos, disponibilidades, exceções, holds e agendamentos;
- proteção de sobreposição com advisory lock, exclusion constraints e chaves idempotentes;
- casos de uso para criar/expirar hold, confirmar e cancelar agendamento;
- conversão de horário local usando o fuso configurado da empresa;
- painel `/dashboard/schedule` com cadastros básicos e visões de hoje/7 dias;
- ferramentas da IA para listar serviços, criar hold e confirmar após consentimento explícito;
- ferramenta `find_available_slots` com filtros de disponibilidade e ocupação;
- limpeza periódica de holds pelo worker/pg-boss;
- edição e desativação de serviços/recursos;
- cancelamento e reagendamento transacional, com ferramentas restritas para a IA;
- guard transacional de `control_version` impede ferramentas da IA após intervenção humana;
- configuração do middleware separada da autenticação com banco;
- removida a pasta vazia `app/` que ocultava `src/app` e fazia o sistema responder somente 404.

## Verificação

- `pnpm check` verde: 24 testes unitários/contrato passando;
- `RUN_DATABASE_TESTS=1` verde: 5 testes de integração com PostgreSQL 16 real executados e aprovados com 100% de sucesso (concorrência, expiração, isolamento de tenant, reagendamento e bloqueio pós-intervenção humana);
- `pnpm build` verde: build de produção do Next.js 15 gerou todas as 14 rotas sem falhas;
- Migration `0000_fat_young_avengers.sql` aplicada com sucesso e corrigida contra erro de coerção entre os enums `booking_hold_status` e `booking_status`.

## Riscos

- O Docker Desktop no Windows requer 1 a 2 minutos para inicializar completamente o subsistema WSL2 e o pipe nomeado `\\.\pipe\docker_cli`;
- Integração OAuth com Google Calendar (Fase 5) precisará de credenciais e gerenciamento seguro de tokens por organização.

## Próximo passo único

Iniciar T-007: integração com Google Calendar (Fase 5: fluxo OAuth, tokens por organização, sincronização FreeBusy e criação de eventos).
