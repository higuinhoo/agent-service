# Registro de decisões

Este arquivo registra decisões duráveis. Não use para ideias, preferências provisórias ou diário de sessão.

Estados possíveis: **APROVADA**, **PENDENTE**, **SUBSTITUÍDA**.

## D-001 — Produto sem CRM de vendas

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: construir uma plataforma de atendimento e agendamento, sem funil, lead, negócio, campanha ou kanban comercial.
- Motivo: os clientes devem operar atendimento e agenda sem aprender conceitos de vendas desnecessários.

## D-002 — Venda direta sem planos automáticos

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: clientes serão cadastrados pelo administrador da plataforma; não haverá planos, checkout, assinatura automática nem cadastro público no MVP.
- Motivo: a aquisição e negociação serão feitas diretamente pelo proprietário.

## D-003 — WAHA como canal inicial

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: usar WAHA para conexão, recebimento e envio de mensagens do WhatsApp.
- Consequência: versão e engine precisam ser fixados; webhooks exigem HMAC, idempotência e testes de contrato.

## D-004 — Intervenção humana vence a IA

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: mensagem humana ou ação de assumir muda a conversa para `HUMAN_ACTIVE`, incrementa `control_version` e impede qualquer envio concorrente da IA.
- Consequência: o worker verifica modo e versão imediatamente antes de todo envio.

## D-005 — Retorno manual à IA no MVP

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: após takeover humano, somente uma ação explícita devolve a conversa à IA.
- Motivo: evitar retomada automática inesperada enquanto o atendente ainda atua.

## D-006 — Framework web e UI

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: Next.js (App Router) + TypeScript estrito + Tailwind CSS + shadcn/ui.
- Motivo: SSR e API Routes no mesmo projeto, componentes acessíveis e reutilizáveis, estrutura modular madura.

## D-007 — Autenticação, banco e isolamento

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: PostgreSQL próprio com Drizzle ORM; autenticação via NextAuth.js (credentials + JWT); isolamento rigoroso por `organization_id` em todas as tabelas e queries.
- Motivo: controle total sobre schema e políticas; sem dependência de serviço externo gerenciado no MVP.

## D-008 — Fila persistente

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: pg-boss (fila persistente sobre PostgreSQL) no MVP; dispensa Redis e reduz infra. Migrar para BullMQ+Redis se a carga exigir.
- Motivo: uma dependência a menos na topologia inicial; pg-boss oferece retentativa, expiração, cancelamento e dead-letter nativos.

## D-009 — Provedor inicial de IA

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: adapter agnóstico (`src/lib/ai/`) com OpenAI (gpt-4o-mini) como provedor inicial; variável `AI_PROVIDER` permite troca sem reescrita.
- Motivo: baixo custo, baixa latência e suporte robusto a function/tool calling no MVP.

## D-010 — Engine e versão inicial do WAHA

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: WAHA Core com engine NOWEB, imagem Docker fixada em tag estável (`devlikeapro/waha:noweb`); validar `message.any`, `source=app`, HMAC e reconexão antes do agente.
- Motivo: NOWEB não depende de browser headless, reduz consumo de memória e é mais estável em VPS.

## D-011 — Hospedagem e topologia

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: VPS Linux com Docker Compose; containers separados para web (Next.js), worker (Node), WAHA (rede interna, sem porta pública), PostgreSQL e volume de backup automatizado.
- Motivo: custo baixo, controle total e rollback simples com Compose.

## D-012 — Mídia no primeiro piloto

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: apenas texto no primeiro piloto; suporte a áudio (download, transcrição, armazenamento temporário) fica fora do escopo do MVP.
- Motivo: elimina complexidade de mídia, storage S3 e custo de transcrição na fase inicial.

## D-013 — Contexto e orquestração econômicos

- Estado: **APROVADA**
- Data: 2026-09-28
- Decisão: usar um agente por padrão, progressive disclosure por skills e no máximo três subagentes para frentes independentes e sem sobreposição de escrita.
- Consequência: `AGENTS.md` permanece curto; documentação de domínio é carregada sob demanda; estado operacional vem de `scripts/project-status.ps1`; handoffs e retornos de subagentes são curtos.
