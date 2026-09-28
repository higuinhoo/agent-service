---
name: project-orchestration
description: Orquestrar subagentes somente quando uma tarefa do projeto puder ser dividida em frentes independentes e paralelas; não usar para trabalho simples ou sequencial.
---

# Orquestração econômica

Use um agente por padrão. Delegue somente quando duas ou mais frentes independentes reduzirem tempo ou melhorarem verificação o suficiente para justificar tokens extras.

Antes de delegar:

1. localize a tarefa e os arquivos com buscas direcionadas;
2. separe leitura de escrita;
3. confirme que agentes não editarão os mesmos arquivos;
4. limite a equipe a 3 subagentes.

Cada tarefa delegada deve conter apenas:

- objetivo verificável;
- caminhos permitidos;
- arquivos/referências já conhecidos;
- permissão `read-only` ou lista exclusiva de arquivos editáveis;
- saída esperada curta: causa/resultado, arquivos, testes e risco.

Prefira contexto limpo ou mínimo quando a ferramenta permitir. Não envie o histórico inteiro, documentos completos ou a mesma investigação a vários agentes.

O agente principal integra os resultados, resolve conflitos e executa a validação final. Use worktrees para implementações paralelas quando disponíveis; caso contrário, paralelize apenas investigação ou áreas sem sobreposição.

Não delegue alterações de um arquivo, pequenos bugs, formatação, configuração simples, comandos de teste ou etapas dependentes.
