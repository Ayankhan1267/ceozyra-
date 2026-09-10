/**
 * ZYRA AI Client — Ollama Provider
 *
 * Self-hosted LLM integration via Ollama's OpenAI-compatible API.
 * Covers chat completions, streaming, and embeddings.
 *
 * Usage:
 *   const client = new OllamaClient({ baseUrl: 'http://localhost:11434' });
 *   const response = await client.chat({ model: 'llama3.2', messages: [...] });
 */

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  options?: Record<string, unknown>;
}

export interface OllamaChatChoice {
  index: number;
  message: OllamaChatMessage;
  finish_reason: string;
}

export interface OllamaChatResponse {
  id: string;
  model: string;
  created: number;
  message: OllamaChatMessage;
  done: boolean;
  choices?: OllamaChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OllamaStreamChunk {
  id: string;
  model: string;
  created: number;
  message: { role: string; content: string };
  done: boolean;
}

export interface OllamaEmbedRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbedResponse {
  embedding: number[];
}

export interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaModelListResponse {
  models: OllamaModelInfo[];
}

/* ── Client ─────────────────────────────────────────────────────────────────── */

export interface OllamaClientOptions {
  baseUrl?: string;
  requestTimeoutMs?: number;
  defaultModel?: string;
  defaultEmbeddingModel?: string;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  public readonly defaultModel: string;
  public readonly defaultEmbeddingModel: string;

  constructor(options: OllamaClientOptions = {}) {
    // Resolve base URL: explicit > OLLAMA_HOST env > http://localhost:11434
    this.baseUrl = (
      options.baseUrl ??
      process.env.OLLAMA_HOST?.replace(/^https?:\/\//, '') ??
      'localhost:11434'
    ).replace(/\/+$/, '');

    // Ensure scheme
    if (!this.baseUrl.startsWith('http://') && !this.baseUrl.startsWith('https://')) {
      this.baseUrl = `http://${this.baseUrl}`;
    }

    this.timeout = options.requestTimeoutMs ?? parseInt(process.env.OLLAMA_REQUEST_TIMEOUT ?? '60000', 10);
    this.defaultModel = options.defaultModel ?? process.env.OLLAMA_MODEL ?? 'llama3.2';
    this.defaultEmbeddingModel = options.defaultEmbeddingModel ?? process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';
  }

  /* ── Health ─────────────────────────────────────────────────────────────── */

  /**
   * Check if Ollama is reachable and responding.
   */
  async health(): Promise<{ ok: boolean; status: number; latencyMs: number }> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout),
      });
      return { ok: res.ok, status: res.status, latencyMs: Date.now() - t0 };
    } catch {
      return { ok: false, status: 0, latencyMs: Date.now() - t0 };
    }
  }

  /* ── Chat (non-streaming) ──────────────────────────────────────────────── */

  /**
   * Send a chat completion request. Returns the full response object.
   */
  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const model = request.model ?? this.defaultModel;
    const body = {
      model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.max_tokens ?? 1024,
        ...request.options,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new OllamaError(`Ollama chat error (${res.status}): ${text}`);
    }

    return res.json() as Promise<OllamaChatResponse>;
  }

  /**
   * Stream chat completions as an async iterator of string deltas.
   *
   * @example
   * for await (const delta of client.chatStream(req)) {
   *   process.stdout.write(delta);
   * }
   */
  async *chatStream(request: OllamaChatRequest): AsyncGenerator<string, void, unknown> {
    const model = request.model ?? this.defaultModel;
    const body = {
      model,
      messages: request.messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.max_tokens ?? 1024,
        ...request.options,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new OllamaError(`Ollama stream error (${res.status}): ${text}`);
    }

    if (!res.body) {
      throw new OllamaError('Response body is null — streaming not supported');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk: OllamaStreamChunk = JSON.parse(trimmed);
            if (chunk.message.content) {
              yield chunk.message.content;
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /* ── Embeddings ────────────────────────────────────────────────────────── */

  /**
   * Generate an embedding vector for the given text.
   */
  async embed(text: string, model?: string): Promise<number[]> {
    const embedModel = model ?? this.defaultEmbeddingModel;
    const body = { model: embedModel, prompt: text };

    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      const text_ = await res.text().catch(() => res.statusText);
      throw new OllamaError(`Ollama embed error (${res.status}): ${text_}`);
    }

    const data = await res.json() as any;
    return data.embedding;
  }

  /* ── Models ────────────────────────────────────────────────────────────── */

  /**
   * List all models currently available in Ollama.
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new OllamaError(`Ollama list models error (${res.status})`);
    }

    const data = (await res.json()) as OllamaModelListResponse;
    return data.models ?? [];
  }

  /**
   * Check whether a specific model is available locally.
   */
  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'));
  }
}

/* ── Error ──────────────────────────────────────────────────────────────────── */

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaError';
  }
}

/* ── Convenience singleton ──────────────────────────────────────────────────── */

let _client: OllamaClient | null = null;

export function getOllamaClient(options?: OllamaClientOptions): OllamaClient {
  if (!_client) {
    _client = new OllamaClient(options);
  }
  return _client;
}

export function resetOllamaClient(): void {
  _client = null;
}
