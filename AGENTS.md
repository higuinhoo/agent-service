# Regras globais para agentes

Objetivo: executar corretamente com o mínimo de contexto, leitura e agentes.

## Contexto

- Comece por `pwsh scripts/project-status.ps1`; não leia toda a documentação por padrão.
- Use `docs/START_HERE.md` somente para rotear quais arquivos ou skills a tarefa exige.
- Busque primeiro com `rg --files`, `rg` e símbolos; abra apenas trechos relevantes.
- Não releia arquivos já conhecidos, salvo se mudaram ou a tarefa exigir confirmação.
- Não carregue logs, dumps, histórico de chat ou documentos extensos sem filtro.
- Preserve mudanças existentes e confirme `git status --short` antes de editar.

## Execução

- Tarefa simples: execute diretamente, sem plano longo ou subagente.
- Edite o menor trecho possível; não reescreva arquivos inteiros sem necessidade.
- Use a skill do domínio quando aplicável; não carregue skills não relacionadas.
- Rode primeiro o teste mais específico, depois módulo/integração; suíte completa só quando o risco justificar.
- Filtre logs e consultas para retornar apenas erro, contexto próximo e dados necessários.
- Atualize `STATUS.md`, `TASKS.md`, `DECISIONS.md` ou `HANDOFF.md` somente quando o fato correspondente mudar.

## Orquestração

- Use um agente por padrão.
- Delegue apenas quando houver pelo menos duas frentes independentes que possam avançar em paralelo.
- Não delegue tarefas pequenas, sequenciais, de um arquivo, formatação, configuração simples ou execução de testes.
- Máximo padrão: 3 subagentes.
- Cada delegação informa objetivo exato, caminhos permitidos, contexto mínimo, escrita permitida ou não e saída curta esperada.
- Agentes paralelos não editam os mesmos arquivos. Use worktree/isolamento quando disponível.
- O orquestrador integra resultados e executa a validação final; subagentes não recebem “analise o projeto inteiro”.

## Invariantes globais

- Não adicionar funil, lead, negócio, campanha, planos, checkout ou cadastro público sem decisão explícita.
- Dados de cliente são isolados por `organization_id`; tenant nunca vem de payload externo não confiável.
- Intervenção humana sempre vence a IA; o retorno à IA é manual no MVP.
- Webhooks e criações são idempotentes; segredos e dados pessoais não entram em logs ou fixtures.

## Conclusão

Não declare concluído sem verificar o que foi alterado. A resposta final deve ser curta:

1. o que mudou;
2. arquivos alterados;
3. testes executados;
4. problemas restantes, se houver.
