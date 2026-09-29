import type { OpenAI } from "openai";

// ─── Tipos do adapter ─────────────────────────────────────────────────────────

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: AiToolCall[];
}

export interface AiResponse {
  content: string | null;
  toolCalls?: AiToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AiOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: AiToolDefinition[];
}

export interface AiAdapter {
  complete(messages: AiMessage[], options?: AiOptions): Promise<AiResponse>;
}

// ─── Adapter OpenAI ───────────────────────────────────────────────────────────

class OpenAIAdapter implements AiAdapter {
  private client: OpenAI;
  private model: string;

  constructor() {
    // Import dinâmico para não quebrar em ambientes sem a lib
    const { OpenAI: OpenAIClient } = require("openai") as { OpenAI: typeof OpenAI };
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY env var is required");
    this.client = new OpenAIClient({ apiKey });
    this.model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
  }

  async complete(messages: AiMessage[], options: AiOptions = {}): Promise<AiResponse> {
    const formattedMessages = messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          tool_call_id: m.toolCallId ?? "",
          content: m.content,
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant" as const,
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });

    const openAiTools = options.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
      ...(openAiTools && openAiTools.length > 0 ? { tools: openAiTools } : {}),
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("AI returned empty response");
    }

    const rawToolCalls = choice.message.tool_calls;
    const parsedToolCalls: AiToolCall[] | undefined = rawToolCalls
      ?.filter((tc) => tc.type === "function")
      .map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });

    return {
      content: choice.message.content ?? null,
      ...(parsedToolCalls && parsedToolCalls.length > 0 ? { toolCalls: parsedToolCalls } : {}),
      ...(response.usage
        ? {
            usage: {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
            },
          }
        : {}),
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _adapter: AiAdapter | null = null;

export function getAiAdapter(): AiAdapter {
  if (_adapter) return _adapter;

  const provider = process.env["AI_PROVIDER"] ?? "openai";

  switch (provider) {
    case "openai":
      _adapter = new OpenAIAdapter();
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}. Set AI_PROVIDER env var.`);
  }

  return _adapter;
}
