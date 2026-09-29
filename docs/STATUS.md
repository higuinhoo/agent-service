# Estado atual

Atualizado em: 2026-09-29

## Fase

Fase 5 concluída — integração Google Calendar implementada com OAuth, FreeBusy, criação/cancelamento sincronizado e compensação de erro. ATIVA: T-007 (pronta para transição para Fase 6).

## O que existe

- escopo, arquitetura, roadmap e decisões documentados (D-001–D-013 aprovadas);
- scaffold Next.js 15 (App Router) + TypeScript estrito + Tailwind CSS;
- schema Drizzle multiempresa incluindo atendimento, IA, agenda local e Google Calendar;
- autenticação NextAuth.js v5 (credentials + JWT, isolamento por organization_id, bloqueio de organizações suspensas);
- integração WAHA robusta:
  - cliente HTTP com suporte a sessões, status, QR Code e envio de texto;
  - webhook `/api/webhooks/waha` com validação de assinatura HMAC no corpo bruto;
  - resolução segura de tenant por mapeamento de sessão confiável;
  - deduplicação com idempotência em banco (`webhook_events` e `waha_message_id`);
  - detecção automática de intervenção humana (D-004) quando `fromMe=true` e `source=app`;
  - processamento de status de entrega (`message.ack`: SENT, DELIVERED, READ);
  - outbox durável no worker com verificação atômica pré-envio contra corrida com atendente;
- runtime do agente IA & controle de atendimento:
  - ciclo de turnos com loop de tool calling (`executeAgentTurn`);
  - ferramentas seguras para informações, serviços, holds, confirmação de agendamento e handoff humano;
  - proteção atômica pré-envio: descarte de respostas geradas se o atendente assumir durante a inferência;
  - handoff para humano via ferramenta ou botão no painel (D-004);
  - devolução manual para a IA (D-005);
  - observabilidade completa com registro estruturado de runs e chamadas de ferramenta;
- interface do usuário (UI) funcional:
  - tela de login e layout responsivo com menu lateral;
  - visão geral com métricas;
  - módulo de contatos (cadastro, listagem, exclusão);
  - módulo de usuários com permissões de papéis;
  - módulo de conversas do WhatsApp com listagem e indicadores de intervenção humana;
  - tela de chat em tempo real com histórico, envio de resposta manual e botões de alternância Humano/IA;
  - módulo de pareamento e gerenciamento de sessão WhatsApp (QR Code e status);
  - módulo de configuração estruturada e versionada do Agente IA;
  - módulo de agenda com serviços, responsáveis, disponibilidade, exceções, integração Google Calendar e visões diária/semanal;
  - trilha de auditoria;
- agenda local com idempotência, fuso explícito, lock transacional, constraints de exclusão e isolamento por `organization_id`;
- integração completa com Google Calendar:
  - conexão OAuth 2.0 por profissional/recurso com armazenamento de tokens e renovação automática;
  - sincronização de disponibilidade FreeBusy integrada à geração de slots disponíveis;
  - criação atômica de eventos externos vinculados a `external_calendar_events`;
  - liberação e expiração de hold caso a confirmação externa falhe (sem confirmação falsa para o cliente);
  - exclusão e cancelamento de eventos no Google Calendar ao cancelar agendamento;
  - interface para conectar, testar sincronização e desconectar calendários;
- worker agenda limpeza de holds expirados a cada minuto;
- cancelamento e reagendamento usam transação e hold prévio;
- ferramentas de agenda da IA bloqueiam a conversa na transação e validam `control_version`, preservando a prioridade humana;
- testes automatizados passando (36/36 testes passando, incluindo a suíte completa de concorrência com PostgreSQL 16 real);
- `pnpm check` 100% verde: lint ✅ format ✅ typecheck ✅ tests ✅.
- build de produção validado com todas as 16 rotas do App Router, incluindo endpoints de OAuth e `/dashboard/schedule`.

## O que não existe

- piloto em produção com Docker e volumes reais (Fase 6).
