import type { OpenAI } from "openai";

// ─── Tipos do adapter ─────────────────────────────────────────────────────────

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AiAdapter {
  complete(messages: AiMessage[], options?: AiOptions): Promise<AiResponse>;
}

export interface AiOptions {
  temperature?: number;
  maxTokens?: number;
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
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
    });

    const choice = response.choices[0];
    if (!choice?.message.content) {
      throw new Error("AI returned empty response");
    }

    return {
      content: choice.message.content,
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
