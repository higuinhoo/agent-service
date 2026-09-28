# Handoff atual

Atualizado em: 2026-09-28

## Objetivo

Reduzir tokens e habilitar orquestração controlada no Codex e Antigravity.

## Mudanças

- `AGENTS.md` reduzido a regras globais;
- `START_HERE.md` convertido em roteador de contexto;
- cinco skills especializadas adicionadas;
- script de resumo operacional criado;
- regras/workflows do Antigravity evitam leitura integral;
- orquestração opt-in com máximo de três subagentes;
- D-013 registrada.

## Arquivos

`AGENTS.md`, `README.md`, `docs/{START_HERE,STATUS,TASKS,DECISIONS,HANDOFF}.md`, `.agents/rules/project-context.md`, `.agents/workflows/*.md`, `.agents/skills/*/SKILL.md`, `scripts/project-status.ps1`.

## Verificação

- `pwsh scripts/project-status.ps1` executado;
- skills validadas pelo `quick_validate.py` do skill-creator;
- estrutura e regra de tarefa ativa verificadas;
- não há aplicação, build ou testes de código neste estágio.

## Riscos

- ferramentas podem aplicar políticas próprias que prevalecem sobre o repositório;
- escrita paralela deve usar arquivos exclusivos ou worktrees;
- stack técnica continua pendente.

## Próximo passo único

Executar T-001: aprovar D-006 a D-012 antes de gerar código.
