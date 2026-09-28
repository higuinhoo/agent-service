# Executando localmente

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose

## Setup inicial

```bash
# 1. Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com suas chaves (NEXTAUTH_SECRET, OPENAI_API_KEY etc.)

# 2. Instalar dependências
pnpm install

# 3. Subir banco e WAHA
docker compose up postgres waha -d

# 4. Rodar migrations
pnpm db:migrate

# 5. Popular banco com usuário demo
pnpm db:seed
# Usuário: admin@demo.com  Senha: admin123

# 6. Iniciar aplicação em dev
pnpm dev          # Next.js na porta 3000
pnpm worker       # Worker em processo separado
```

## Verificação completa

```bash
pnpm check
# Roda: lint + format:check + typecheck + tests
```

## Subir tudo com Docker

```bash
# Copiar .env (obrigatório)
cp .env.example .env

docker compose up --build
# web:    http://localhost:3000
# waha:   http://localhost:3001 (painel WAHA)
# pgsql:  localhost:5432
```

## Scripts disponíveis

| Comando            | Descrição                          |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Next.js em modo desenvolvimento    |
| `pnpm worker`      | Worker de fila em watch mode       |
| `pnpm build`       | Build de produção                  |
| `pnpm check`       | Lint + formato + tipos + testes    |
| `pnpm db:generate` | Gerar migration a partir do schema |
| `pnpm db:migrate`  | Aplicar migrations                 |
| `pnpm db:seed`     | Popular banco com dados iniciais   |
| `pnpm db:studio`   | Drizzle Studio (UI do banco)       |

## Variáveis obrigatórias

| Variável                   | Descrição                             |
| -------------------------- | ------------------------------------- |
| `DATABASE_URL`             | Connection string PostgreSQL          |
| `NEXTAUTH_SECRET`          | Secret JWT (mín. 32 chars aleatórios) |
| `OPENAI_API_KEY`           | Chave OpenAI                          |
| `WAHA_API_KEY`             | Chave de acesso à API WAHA            |
| `WAHA_WEBHOOK_HMAC_SECRET` | Secret HMAC para autenticar webhooks  |

## Estrutura do projeto

```
src/
  app/               # Next.js App Router (páginas e API routes)
    api/
      auth/          # NextAuth route handlers
      webhooks/waha/ # Webhook WAHA (HMAC + fila)
    dashboard/       # Página principal (autenticada)
  lib/
    ai/              # Adapter agnóstico de IA (OpenAI)
    auth/            # NextAuth config
    db/              # Drizzle client, schema, migrate, seed
    queue/           # pg-boss (fila persistente)
    waha/            # Cliente HTTP WAHA
  test/              # Setup e testes
worker/              # Processo Node separado (consome fila)
docker/              # Dockerfiles
migrations/          # Migrations geradas pelo Drizzle Kit
```
