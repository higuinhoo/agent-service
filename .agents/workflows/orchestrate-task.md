---
description: Avaliar e orquestrar uma tarefa com o menor número de agentes e contexto.
---

Use a skill `project-orchestration`.

1. Execute `pwsh scripts/project-status.ps1` e localize arquivos com busca direcionada.
2. Se a tarefa for simples ou sequencial, execute com um agente e informe isso em uma frase.
3. Se houver frentes independentes, apresente a divisão curta e use no máximo 3 subagentes.
4. Dê a cada subagente apenas seus caminhos, objetivo e formato de retorno.
5. Proíba sobreposição de escrita; use worktree quando disponível.
6. Integre os resultados e rode a validação final mínima suficiente.
7. Atualize somente os documentos de estado que realmente mudaram.
