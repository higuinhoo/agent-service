---
name: ai-runtime
description: Implementar ou revisar runtime do agente, ferramentas, prompts estruturados e handoff entre IA e humano.
---

# Runtime da IA

Carregue apenas configuração ativa do agente, caso de uso, ferramenta e testes afetados.

Regras:

- o modelo não recebe SQL, segredo ou cliente HTTP genérico;
- ferramentas têm schema estrito, tenant confiável, timeout, idempotência e auditoria;
- capture `control_version` no início do turno;
- imediatamente antes de qualquer envio, confirme atomicamente `AI_ACTIVE` e a mesma versão;
- handoff humano incrementa a versão e invalida trabalhos pendentes;
- retorno à IA é manual no MVP;
- configuração do agente é estruturada, versionada e publicável; não exponha o prompt protegido completo ao cliente;
- aplique limites de tempo, custo e número de ferramentas.

Teste ao menos a corrida “humano assume enquanto a IA gera resposta” quando o fluxo de envio mudar.
