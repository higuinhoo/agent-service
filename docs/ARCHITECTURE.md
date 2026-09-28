# Arquitetura inicial

## Forma do sistema

Monólito modular com dois processos implantáveis:

```text
Aplicação web/API                  Worker
├── painel da plataforma          ├── eventos WAHA
├── painel da empresa             ├── turnos da IA
├── autenticação                  ├── agenda/calendário
├── webhooks                      ├── lembretes
└── consultas e comandos          └── retentativas
            │                          │
            └──────── PostgreSQL ──────┘
                         │
               fila/eventos persistentes

Serviços externos: WAHA, provedor de IA e Google Calendar
```

Aplicação e worker compartilham módulos de domínio, validação e acesso a dados, mas executam separadamente. Uma falha ou demora do modelo não bloqueia o painel nem o recebimento do webhook.

## Módulos

- `identity`: autenticação, usuários, sessões e papéis;
- `tenancy`: empresas, associação de usuários e isolamento;
- `agent`: configuração, versões, execução e ferramentas;
- `conversations`: contatos, conversas, mensagens e controle humano;
- `channels/waha`: sessões, webhook, envio e confirmações;
- `scheduling`: serviços, recursos, disponibilidade e reservas;
- `integrations/calendar`: OAuth, disponibilidade e eventos externos;
- `jobs`: fila, retentativas e fila de falhas;
- `audit`: trilha append-only e correlação de requisições;
- `operations`: saúde, alertas e diagnóstico.

## Regras de dependência

- Domínio não importa SDK de WAHA, Google ou provedor de IA.
- Integrações implementam interfaces definidas pelo domínio.
- Route handlers validam entrada e chamam casos de uso; não contêm regra de negócio extensa.
- O modelo de IA não recebe acesso a SQL, credenciais ou APIs genéricas.
- Operações externas acontecem fora de transações de banco, coordenadas por outbox/jobs.

## Multiempresa

Toda tabela pertencente a cliente contém `organization_id` obrigatório. O tenant é resolvido por sessão autenticada ou pelo mapeamento confiável da sessão WAHA; nunca é aceito diretamente do corpo de uma requisição externa.

Controles obrigatórios:

- políticas de isolamento no banco quando disponíveis;
- filtros explícitos no acesso administrativo;
- testes com duas empresas reais no mesmo banco;
- auditoria para acesso de suporte;
- credenciais externas criptografadas;
- nenhuma chave de WAHA ou calendário enviada ao navegador.

## Modelo de dados conceitual

### Identidade e empresas

- `organizations`
- `users`
- `memberships`
- `support_access_events`

### Agente

- `agent_configs`
- `agent_config_versions`
- `agent_runs`
- `agent_tool_calls`

### Conversas

- `contacts`
- `conversations`
- `messages`
- `conversation_control_events`
- `outbound_messages`

Campos críticos de `conversations`:

- `control_mode`;
- `control_version`;
- `human_owner_id`;
- `human_since`;
- `last_inbound_at`;
- `last_outbound_at`.

### WAHA e processamento

- `waha_sessions`
- `webhook_events`
- `domain_events`
- `jobs`
- `dead_letter_jobs`

### Agenda

- `services`
- `resources`
- `availability_rules`
- `availability_exceptions`
- `booking_holds`
- `bookings`
- `calendar_connections`
- `external_calendar_events`

### Auditoria

- `audit_log`
- `integration_health_events`

## Contrato do webhook WAHA

Eventos iniciais:

- `message.any` para mensagens recebidas e próprias;
- `message.ack` para status de entrega/leitura;
- `session.status` para saúde da sessão.

Passos do endpoint:

1. capturar o corpo bruto;
2. validar HMAC e janela do timestamp;
3. localizar a empresa pelo identificador interno da sessão;
4. persistir o evento com chave única;
5. responder rapidamente;
6. processar assincronamente.

Chaves de idempotência mínimas:

- ID do evento WAHA;
- combinação sessão + ID da mensagem;
- ID interno de comando de envio;
- ID interno da operação de agendamento.

Não assinar todos os eventos do WAHA em produção. A versão e o engine serão fixados e testados; trocas de engine exigem testes de contrato.

## Invariante de intervenção humana

### Classificação de mensagens próprias

```text
fromMe=false
  → mensagem do consumidor

fromMe=true + source=app
  → intervenção humana pelo aplicativo

fromMe=true + source=api
  → correlacionar com outbound_messages
     origin=ai | human_dashboard | reminder | system
```

### Proteção contra corrida

Ao iniciar um turno, o job captura `control_version`. Antes de cada efeito externo e imediatamente antes do envio, executa uma comparação atômica:

```text
control_mode == AI_ACTIVE
AND control_version == versão capturada
```

Quando um humano assume, uma única transação:

1. muda o modo para `HUMAN_ACTIVE`;
2. incrementa `control_version`;
3. registra origem, usuário e horário;
4. marca jobs pendentes como cancelados quando aplicável.

Se a comparação falhar, a resposta da IA é descartada e o aborto é auditado. Cancelar somente a fila não é proteção suficiente, pois o modelo pode já estar processando.

## Turno do agente

```text
message.any
  → webhook_events
  → normalização e deduplicação
  → mensagem persistida
  → verificação do controle da conversa
  → job de turno
  → montagem de contexto
  → execução do modelo com ferramentas permitidas
  → validação de resultado e limites
  → nova verificação de control_version
  → outbox de envio
  → WAHA
  → message.ack
```

Ferramentas iniciais:

- obter dados públicos da empresa;
- listar serviços;
- consultar disponibilidade;
- criar reserva temporária;
- confirmar agendamento;
- reagendar;
- cancelar;
- solicitar atendimento humano.

Cada ferramenta possui schema estrito, autorização por empresa, timeout, idempotência e auditoria.

## Agendamento e concorrência

Estados sugeridos:

- `HELD`: horário reservado temporariamente;
- `PENDING_EXTERNAL`: operação no calendário em andamento;
- `CONFIRMED`: calendário e banco confirmados;
- `CANCELED`;
- `FAILED`.

Fluxo de criação:

1. consultar regras locais e bloqueios externos;
2. criar um hold com expiração;
3. impedir sobreposição por restrição transacional;
4. criar evento no calendário via job idempotente;
5. confirmar no banco apenas após sucesso externo;
6. liberar hold e registrar falha se a integração não concluir.

Nunca confirmar ao consumidor antes do estado `CONFIRMED`.

## Falhas e observabilidade

- IDs de correlação em webhook, conversa, turno, job e agendamento;
- retentativas com backoff e jitter;
- limite de tentativas e dead-letter queue;
- jobs expirados não enviam respostas antigas;
- painel mostra erro real, sem status otimista;
- health checks separados para app, worker, banco e WAHA;
- alertas para sessão desconectada, fila parada e taxa elevada de erro;
- conteúdo sensível removido de logs técnicos.

## Estratégia de testes

### Unidade

- interpretação das configurações;
- transições de estado;
- cálculo de disponibilidade;
- validação das ferramentas.

### Integração

- isolamento entre duas empresas;
- idempotência de webhook e envio;
- fila, retentativas e dead-letter;
- restrição contra sobreposição de agenda;
- publicação e rollback de configuração do agente.

### Corridas obrigatórias

- humano assume enquanto o modelo gera resposta;
- webhook duplicado chega simultaneamente;
- dois consumidores tentam o mesmo horário;
- confirmação externa chega depois de cancelamento;
- sessão WAHA cai entre geração e envio.

### Contrato

- fixtures reais e anonimizadas de cada evento WAHA utilizado;
- teste contra a versão fixada do WAHA;
- simulador/fake para CI sem depender de WhatsApp real.

### Ponta a ponta

- cadastro de empresa;
- conexão de sessão;
- publicação do agente;
- conversa e resposta;
- agendamento;
- takeover humano;
- falha e recuperação controlada.

## Decisões ainda abertas

- framework web e biblioteca de UI;
- serviço de autenticação e estratégia de RLS;
- implementação da fila persistente;
- provedor inicial de IA;
- engine inicial do WAHA;
- hospedagem e topologia de ambientes;
- política de retenção de mensagens e mídias;
- escopo exato de áudio, imagem e documentos no MVP.
