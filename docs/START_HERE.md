# Roteador de contexto

Não leia todos os documentos. Use somente o caminho necessário para a tarefa.

## Sempre

1. Leia `AGENTS.md` uma vez por sessão.
2. Execute `pwsh scripts/project-status.ps1`.
3. Leia a seção ativa de `docs/TASKS.md` se o resumo não bastar.
4. Inspecione somente o diff e os arquivos relacionados à tarefa.

Leia `docs/HANDOFF.md` apenas ao continuar trabalho interrompido ou trocar de ferramenta. Leia `docs/DECISIONS.md` por busca direcionada ao ID/tema relevante, não integralmente.

## Por tipo de tarefa

| Tarefa                  | Contexto a carregar                                  |
| ----------------------- | ---------------------------------------------------- |
| Escopo ou UX            | `docs/PRODUCT.md` e decisão relacionada              |
| Arquitetura transversal | `docs/ARCHITECTURE.md` e decisões relacionadas       |
| Planejamento            | trecho relevante de `docs/ROADMAP.md` + tarefa ativa |
| WAHA                    | skill `waha-integration` + seção WAHA da arquitetura |
| Banco/multiempresa      | skill `tenant-data` + schema/migration relevante     |
| Runtime da IA/handoff   | skill `ai-runtime` + arquivos do módulo              |
| Agenda/calendário       | skill `scheduling` + arquivos do módulo              |
| Bug ou testes           | skill `targeted-verification` + erro filtrado        |
| Trabalho paralelo       | skill `project-orchestration`                        |

## Resumo do produto

Portal privado multiempresa de atendimento e agendamento com IA pelo WhatsApp/WAHA. O proprietário cadastra empresas diretamente. Não há CRM de vendas, planos ou cadastro público. Quando um humano assume, a IA para imediatamente e só retorna por ação manual.

## Documentos de estado

- `STATUS.md`: fatos atuais, curto.
- `TASKS.md`: exatamente uma tarefa ativa.
- `HANDOFF.md`: somente para troca de sessão/agente.
- `DECISIONS.md`: decisões duráveis aprovadas ou pendentes.

O Git é o histórico. Não crie diários ou resumos paralelos.
