# Escopo do produto

## Problema

Pequenas e médias empresas precisam automatizar atendimento e agendamento pelo WhatsApp sem aprender conceitos de CRM e sem perder o controle quando um atendente humano entra na conversa.

## Usuários

### Administrador da plataforma

É o proprietário e operador do sistema. Cadastra clientes diretamente, presta suporte e acompanha a saúde das integrações.

Pode:

- criar, ativar, suspender e encerrar empresas;
- convidar o primeiro administrador de cada empresa;
- acompanhar WAHA, calendário, worker e provedor de IA;
- visualizar erros e reprocessar tarefas seguras;
- acessar configurações para suporte, sempre com auditoria;
- impor limites técnicos de segurança e consumo.

Não haverá planos, checkout, assinatura automática nem cadastro público no MVP.

### Administrador da empresa

Configura a operação da própria empresa:

- identidade, comportamento e conhecimento do agente;
- serviços, duração, preços informativos e perguntas necessárias;
- profissionais, salas ou outros recursos agendáveis;
- dias, horários, intervalos, folgas e exceções;
- conexão WAHA e Google Calendar;
- usuários e atendentes;
- mensagens de confirmação, cancelamento e indisponibilidade.

### Atendente

Pode consultar conversas autorizadas, assumir um atendimento e devolvê-lo à IA. Não administra integrações ou regras globais por padrão.

### Consumidor final

Não possui conta na plataforma. Conversa pelo WhatsApp para tirar dúvidas, consultar horários, agendar, reagendar, cancelar ou solicitar uma pessoa.

## Navegação do cliente

O painel da empresa terá inicialmente seis áreas:

1. **Início** — estado das conexões, próximos agendamentos e alertas úteis.
2. **Agente** — configuração estruturada, teste e publicação de versões.
3. **Serviços** — serviços, duração, recursos e regras de atendimento.
4. **Agenda** — visão diária/semanal, disponibilidade, bloqueios e eventos.
5. **Conversas** — histórico operacional mínimo e controle IA/humano.
6. **Configurações** — empresa, usuários, WAHA, calendário e notificações.

## Configuração segura do agente

O cliente não editará o prompt interno completo. A tela oferecerá campos estruturados:

- nome e apresentação;
- tom de voz;
- descrição da empresa;
- perguntas frequentes;
- regras e restrições;
- dados que devem ser coletados;
- quando chamar um humano;
- mensagens fora do horário;
- políticas de agendamento e cancelamento.

O sistema gera um prompt protegido e versionado. Cada mudança passa por rascunho, teste e publicação. É possível retornar à versão anterior.

## Funcionalidades do MVP

### Administração

- autenticação e recuperação de acesso;
- empresas e usuários;
- papéis simples: plataforma, administrador da empresa e atendente;
- ativação/suspensão manual;
- diagnóstico das integrações;
- auditoria de ações administrativas.

### WhatsApp via WAHA

- uma sessão por número conectado;
- criação e acompanhamento da sessão;
- QR Code e status de conexão;
- recebimento de `message.any`, `message.ack` e `session.status`;
- envio de texto pelo agente;
- persistência idempotente de eventos e mensagens;
- detecção de mensagem humana enviada pelo aplicativo;
- histórico operacional mínimo.

### Agente de IA

- configuração por empresa;
- contexto recente da conversa;
- informações estruturadas do negócio;
- ferramentas restritas de agenda e handoff;
- limite de tempo, custo e número de chamadas;
- registro de cada execução e ferramenta usada;
- transferência explícita para humano;
- nenhuma escrita livre no banco.

### Agendamento

- serviços e duração;
- profissionais/recursos;
- horários recorrentes e exceções;
- bloqueio temporário de horário;
- criação, confirmação, reagendamento e cancelamento;
- integração inicial com Google Calendar;
- tratamento explícito de fuso horário;
- lembrete simples configurável.

### Controle humano

Estados da conversa:

- `AI_ACTIVE`: a IA pode responder;
- `HUMAN_ACTIVE`: a IA está proibida de responder;
- `PAUSED`: automação pausada administrativamente;
- `CLOSED`: atendimento encerrado.

Entradas que ativam `HUMAN_ACTIVE`:

- mensagem própria recebida do WAHA com origem no aplicativo;
- clique em **Assumir atendimento**;
- ferramenta de handoff usada pelo agente;
- regra administrativa de segurança.

O retorno à IA será manual no MVP.

## Fora do MVP

- funil, leads, negócios e kanban comercial;
- planos, cobrança, checkout e autoatendimento de cadastro;
- campanhas e disparos em massa;
- automações genéricas QUANDO/SE/ENTÃO;
- marketplace de integrações;
- múltiplos agentes colaborando na mesma conversa;
- autoaprendizado que altera o agente sem aprovação;
- MCP público;
- aplicativos móveis próprios;
- relatórios comerciais avançados;
- vários provedores de calendário na primeira entrega.

## Indicadores operacionais iniciais

- mensagens recebidas e processadas sem duplicidade;
- tempo até primeira resposta;
- taxa de erro por integração;
- agendamentos confirmados, cancelados e falhos;
- handoffs para humano;
- respostas da IA abortadas por intervenção humana;
- sessões WAHA conectadas/desconectadas;
- trabalhos aguardando ou presos na fila.

## Critérios de sucesso do MVP

O MVP está apto para piloto quando:

1. uma empresa é cadastrada manualmente;
2. conecta um número pelo WAHA;
3. conecta um calendário;
4. publica uma configuração de agente;
5. recebe e responde uma conversa real;
6. consulta disponibilidade e cria um agendamento sem duplicidade;
7. um humano responde pelo WhatsApp e bloqueia a IA imediatamente;
8. falhas externas ficam visíveis e podem ser reprocessadas com segurança;
9. dados de duas empresas permanecem isolados em testes automatizados.
