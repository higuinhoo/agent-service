# Estado atual

Atualizado em: 2026-09-28

## Fase

Fase 2 concluída — T-004 (Integração WAHA e persistência de conversas) concluída. ATIVA: T-005 (Fase 3: controle humano e runtime do agente IA).

## O que existe

- escopo, arquitetura, roadmap e decisões documentados (D-001–D-013 aprovadas);
- scaffold Next.js 15 (App Router) + TypeScript estrito + Tailwind CSS;
- schema Drizzle completo: organizations, users, contacts, conversations, messages (com status de entrega e ack), webhook_events, audit_logs;
- autenticação NextAuth.js v5 (credentials + JWT, isolamento por organization_id, bloqueio de organizações suspensas);
- integração WAHA robusta:
  - cliente HTTP com suporte a sessões, status, QR Code e envio de texto;
  - webhook `/api/webhooks/waha` com validação de assinatura HMAC no corpo bruto;
  - resolução segura de tenant por mapeamento de sessão confiável;
  - deduplicação com idempotência em banco (`webhook_events` e `waha_message_id`);
  - detecção automática de intervenção humana (D-004) quando `fromMe=true` e `source=app`;
  - processamento de status de entrega (`message.ack`: SENT, DELIVERED, READ);
  - outbox durável no worker com verificação atômica pré-envio contra corrida com atendente;
- interface do usuário (UI) funcional:
  - tela de login e layout responsivo com menu lateral;
  - visão geral com métricas;
  - módulo de contatos (cadastro, listagem, exclusão);
  - módulo de usuários com permissões de papéis;
  - módulo de conversas do WhatsApp com listagem e indicadores de intervenção humana;
  - tela de chat em tempo real com histórico e envio de resposta manual;
  - módulo de pareamento e gerenciamento de sessão WhatsApp (QR Code e status);
  - trilha de auditoria;
- testes automatizados passando (10/10 testes no Vitest: isolamento multiempresa, idempotência, intervenção humana e outbox);
- `pnpm check` 100% verde: lint ✅ format ✅ typecheck ✅ tests ✅.

## O que não existe

- runtime do agente de IA com tool calling e prompt estruturado (Fase 3);
- agendamento e disponibilidade local (Fase 4);
- integração com Google Calendar (Fase 5).
