/**
 * ZYRA AI Client — package index
 *
 * Re-exports the Ollama client and shared types for convenient imports.
 */

export {
  OllamaClient,
  getOllamaClient,
  resetOllamaClient,
  OllamaError,
} from './ollama-client';

export type {
  OllamaChatMessage,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaChatChoice,
  OllamaStreamChunk,
  OllamaEmbedRequest,
  OllamaEmbedResponse,
  OllamaModelInfo,
  OllamaModelListResponse,
  OllamaClientOptions,
} from './ollama-client';
