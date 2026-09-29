# Estado atual

Atualizado em: 2026-09-28

## Fase

Fase 3 concluída — T-005 (Controle humano e runtime do agente IA) concluída. ATIVA: T-006 (Fase 4: agenda local).

## O que existe

- escopo, arquitetura, roadmap e decisões documentados (D-001–D-013 aprovadas);
- scaffold Next.js 15 (App Router) + TypeScript estrito + Tailwind CSS;
- schema Drizzle completo: organizations, users, contacts, conversations, messages, webhook_events, audit_logs, agent_configs, agent_runs, tool_calls;
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
  - ferramentas seguras iniciais (`get_company_info`, `list_services`, `request_human_support`);
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
  - trilha de auditoria;
- testes automatizados passando (14/14 testes no Vitest: isolamento multiempresa, WAHA e runtime de IA);
- `pnpm check` 100% verde: lint ✅ format ✅ typecheck ✅ tests ✅.

## O que não existe

- agendamento e disponibilidade local (Fase 4);
- integração com Google Calendar (Fase 5);
- piloto em produção com Docker e volumes reais (Fase 6).
