---
name: tenant-data
description: Alterar schema, migrations, consultas ou autorização de dados multiempresa com isolamento por organization_id.
---

# Dados multiempresa

Abra somente migration/schema, repositório e teste relacionados à mudança.

Regras:

- toda entidade do cliente contém `organization_id` obrigatório;
- derive tenant de sessão autenticada ou mapeamento interno confiável;
- acesso administrativo filtra `organization_id` explicitamente;
- não aceite tenant de body, query ou header público;
- toda migration inclui caminho de instalação/atualização e teste relevante;
- mudanças sensíveis incluem teste de isolamento com duas empresas e caso-controle que prova a existência dos dados.

Não leia dumps completos. Consulte apenas tabelas, constraints, policies e poucas linhas necessárias para reproduzir o problema.
