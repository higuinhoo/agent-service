---
name: scheduling
description: Implementar ou revisar serviços, disponibilidade, holds, agendamentos e integração com Google Calendar.
---

# Agendamento

Abra somente entidades, caso de uso e adapter de calendário envolvidos.

Regras:

- use fuso horário explícito da empresa;
- crie hold com expiração antes de confirmar;
- impeça sobreposição por constraint/transação, não apenas por consulta prévia;
- operações externas são idempotentes e ficam fora da transação principal;
- confirme ao consumidor somente após persistir `CONFIRMED` e o identificador externo;
- cancelamento/reagendamento tardio não pode ressuscitar evento antigo;
- falha externa libera ou expira o hold e permanece visível.

Teste concorrência no mesmo recurso/horário e respostas externas fora de ordem quando esses fluxos mudarem.
