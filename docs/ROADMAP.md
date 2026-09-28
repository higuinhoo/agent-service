# Roadmap do MVP

## Regra de execução

Cada fase termina com testes automatizados e uma demonstração do fluxo correspondente. Nenhuma fase é considerada pronta apenas porque a interface existe.

## Fase 0 — decisões e fundação do repositório

Entregas:

- decisões técnicas registradas;
- estrutura do repositório;
- ambientes local, teste e produção definidos;
- validação de variáveis de ambiente;
- lint, typecheck, testes e build no CI;
- política de migrations e dados de teste;
- modelo de ameaça inicial.

Saída: projeto vazio compila, testa e sobe de forma reproduzível.

## Fase 1 — identidade e isolamento

Entregas:

- login e recuperação de acesso;
- empresas, usuários e memberships;
- papéis de plataforma, administrador e atendente;
- criação manual de cliente;
- suspensão de empresa;
- auditoria básica;
- teste automatizado de isolamento entre duas empresas.

Saída: duas empresas usam o mesmo sistema sem acesso cruzado.

## Fase 2 — WAHA e persistência de conversas

Entregas:

- cadastro de sessão por empresa;
- QR Code e `session.status`;
- webhook com HMAC;
- ingestão idempotente de `message.any`;
- envio de texto com outbox;
- processamento de `message.ack`;
- lista e detalhe mínimo de conversas;
- health check e alerta de desconexão.

Saída: mensagem real entra, é armazenada uma vez e uma resposta manual de teste sai com status rastreável.

## Fase 3 — controle humano e agente

Entregas:

- estados de controle da conversa;
- detecção de mensagem humana pelo aplicativo;
- assumir/devolver atendimento;
- `control_version` e proteção pré-envio;
- editor estruturado do agente;
- rascunho, teste, publicação e rollback;
- runtime com ferramentas permitidas;
- limites de tempo, custo e chamadas;
- registro de runs e tool calls.

Saída: IA responde, mas uma intervenção humana durante o processamento impede comprovadamente o envio.

## Fase 4 — agenda local

Entregas:

- serviços;
- profissionais/recursos;
- disponibilidade recorrente;
- exceções e bloqueios;
- holds com expiração;
- criação, cancelamento e reagendamento;
- restrição contra sobreposição;
- telas diária e semanal.

Saída: dois pedidos simultâneos não conseguem confirmar o mesmo recurso e horário.

## Fase 5 — Google Calendar

Entregas:

- conexão OAuth;
- seleção de calendário;
- consulta de períodos ocupados;
- criação e atualização de eventos;
- correlação local/externa;
- retentativas e compensação de falha;
- status visível no painel.

Saída: a IA só confirma após o calendário externo confirmar e falhas não geram confirmação falsa.

## Fase 6 — operação para piloto

Entregas:

- painel administrativo de saúde;
- fila de falhas e reprocessamento seguro;
- notificações operacionais;
- política de backup e restauração testada;
- retenção e exclusão de dados;
- limites antiabuso/anti-bloqueio;
- atualização com rollback;
- jornada E2E real com uma empresa piloto.

Saída: sistema operável sem acesso diário ao banco ou ao terminal.

## Depois do piloto

Somente com demanda observada:

- áudio e transcrição;
- imagens e documentos;
- outros calendários;
- lembretes avançados;
- relatórios adicionais;
- respostas humanas pelo painel;
- base de conhecimento com documentos;
- webhooks de integração para clientes.

## Riscos a validar cedo

1. O engine escolhido do WAHA emite `source=app` de forma consistente para mensagens enviadas pelo celular.
2. Sessões permanecem conectadas após reinício e atualização.
3. O volume esperado cabe na topologia escolhida.
4. Google Calendar e agenda local não divergem silenciosamente.
5. O provedor de IA respeita ferramentas e limites com latência aceitável.
6. As empresas aceitam o retorno manual da conversa para a IA.
7. O histórico mínimo é suficiente para suporte e operação.

## Próxima decisão

Antes de implementar a Fase 0, fechar:

- stack de aplicação e autenticação;
- banco e fila;
- provedor de IA;
- engine do WAHA;
- hospedagem inicial;
- suporte a texto apenas ou também áudio no primeiro piloto.
