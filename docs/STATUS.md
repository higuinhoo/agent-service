# Estado atual

Atualizado em: 2026-09-28

## Fase

Fase 0 concluída — T-002 (Fundação do repositório) concluída. Aguardando início da Fase 1 (T-003).

## O que existe

- escopo, arquitetura, roadmap e decisões documentados (D-001–D-013 aprovadas);
- scaffold Next.js 15 (App Router) + TypeScript estrito + Tailwind CSS;
- schema Drizzle: organizations, users, contacts, conversations, messages;
- autenticação NextAuth.js v5 (credentials + JWT, isolamento por organization_id);
- fila pg-boss com filas PROCESS_INBOUND e SEND_OUTBOUND;
- worker Node separado (consumer da fila);
- cliente WAHA com verificação HMAC e envio de texto;
- webhook `/api/webhooks/waha` com HMAC + enfileiramento idempotente;
- Docker Compose: web, worker, postgres, waha;
- `pnpm check` passando: lint ✅ format ✅ typecheck ✅ tests ✅;
- seed de dados: organização demo + admin@demo.com.

## O que não existe

- aplicação, API ou worker;
- `package.json` e dependências;
- banco, migrations ou schema;
- integração WAHA executável;
- integração de calendário;
- testes automatizados;
- CI/CD;
- ambientes local ou de produção;
- decisão técnica final da stack.

## Verificação disponível

Neste estágio, apenas consistência documental e presença dos arquivos podem ser verificadas. Não há build, typecheck ou testes para executar.

## Próximo marco

Fechar as decisões D-006 a D-012 registradas em `docs/DECISIONS.md` e iniciar a fundação do repositório.
