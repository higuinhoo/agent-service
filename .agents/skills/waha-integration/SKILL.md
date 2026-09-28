---
name: waha-integration
description: Implementar ou diagnosticar sessões, webhooks, mensagens e segurança da integração WAHA deste projeto.
---

# Integração WAHA

Leia somente a seção WAHA de `docs/ARCHITECTURE.md` e os arquivos do adapter afetado.

Regras:

- fixe versão e engine; mudança exige teste de contrato;
- valide HMAC usando o corpo bruto;
- resolva a empresa pelo mapeamento confiável da sessão, nunca pelo payload;
- deduplique evento e mensagem antes de criar efeitos;
- persista primeiro e processe de forma assíncrona;
- correlacione `fromMe=true, source=api` com `outbound_messages`;
- trate `fromMe=true, source=app` como intervenção humana;
- não exponha chave ou painel WAHA ao navegador/público.

Ao alterar payloads, adicione fixture anonimizada e teste específico. Consulte documentação externa apenas para o endpoint/evento tocado.
