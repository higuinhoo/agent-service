---
name: targeted-verification
description: Diagnosticar bugs e validar mudanças com buscas, logs e testes progressivos sem carregar saídas extensas.
---

# Verificação direcionada

1. reproduza com o menor comando possível;
2. filtre a saída por erro, identificador e contexto próximo;
3. localize referências com `rg` antes de abrir arquivos;
4. rode teste do caso alterado, depois módulo, integração e só então suíte completa se o risco justificar;
5. relate comandos reais, resultado e o que não foi verificado.

Não despeje logs, banco ou snapshots completos. Use limites (`--tail`, `Select-String`, `rg -C`, filtros por tempo/ID). Não leia scripts de diagnóstico estáveis, salvo se falharem ou precisarem de alteração.
