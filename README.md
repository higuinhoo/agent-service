# Plataforma de Atendimento e Agendamento com IA

Portal privado multiempresa para configurar atendentes de IA no WhatsApp, administrar agendas e permitir que atendentes humanos assumam conversas com segurança.

## Objetivo

Atender empresas vendidas diretamente, sem planos, checkout ou cadastro público. Cada empresa possui um ambiente isolado para configurar seu agente, serviços, horários, calendários e usuários.

O consumidor final interage apenas pelo WhatsApp. A plataforma é usada pelo administrador do sistema e pelas empresas contratantes.

## Princípios do produto

- O sistema não é um CRM de vendas.
- Não existem funil, lead, negócio, campanha ou previsão comercial.
- WAHA é um adaptador de canal, não a fonte da regra de negócio.
- A IA só pode agir por ferramentas explicitamente permitidas.
- Uma intervenção humana sempre prevalece sobre uma execução da IA.
- Mensagens, eventos e agendamentos precisam ser idempotentes.
- Toda ação relevante deve ser auditável.
- Falha de IA ou calendário não pode impedir atendimento humano.

## Documentação

- [Comece aqui](docs/START_HERE.md)
- [Estado atual](docs/STATUS.md)
- [Tarefa ativa](docs/TASKS.md)
- [Handoff entre agentes](docs/HANDOFF.md)
- [Decisões](docs/DECISIONS.md)
- [Escopo do produto](docs/PRODUCT.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Roadmap do MVP](docs/ROADMAP.md)

## Continuidade entre IAs

`AGENTS.md` é o contrato canônico para qualquer agente. Codex o descobre na raiz do projeto. Antigravity recebe as mesmas regras por `.agents/rules/project-context.md` e possui workflows para continuar e preparar handoff.

Nenhum agente deve depender apenas do histórico do chat. Estado, decisões, tarefa ativa e próximo passo ficam versionados no repositório. Para obter somente o contexto operacional atual, execute:

```powershell
pwsh scripts/project-status.ps1
```

Skills de domínio em `.agents/skills/` são carregadas sob demanda. Um único agente é o padrão; use `/orchestrate-task` no Antigravity ou peça explicitamente orquestração no Codex quando houver frentes independentes.

## Estado atual

Planejamento inicial. Consulte `docs/STATUS.md` para o estado factual e `docs/TASKS.md` para o próximo trabalho autorizado.
