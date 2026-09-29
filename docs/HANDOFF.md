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

- `pnpm check` verde: 24 testes passando e 5 testes PostgreSQL opt-in ignorados sem ambiente;
- `pnpm build` verde com URL de banco fictícia apenas para inicialização do client;
- migration validada por testes de contrato, mas não aplicada em PostgreSQL real porque o Docker Desktop falha ao iniciar com um socket local obsoleto (`sailor-ingest.sock`).

## Riscos

- executar a migration em PostgreSQL 16 descartável antes de usar banco persistente;
- o arquivo `0000` é a primeira baseline versionada; banco criado fora do histórico do Drizzle precisa de estratégia de baseline antes da aplicação;
- o teste real de concorrência, expiração, isolamento, reagendamento e controle humano está pronto em `scheduling-database.test.ts`, aguardando ambiente PostgreSQL ativo.

## Próximo passo único

Corrigir a inicialização do Docker Desktop, aplicar a migration e executar `RUN_DATABASE_TESTS=1` contra PostgreSQL 16 descartável.
