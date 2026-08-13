/**
 * External leaf ports owned by api / client in the product system graph.
 */

export interface PaymentGateway {
  charge(cents: number, currency: string): Promise<{ id: string }>;
}

export interface TtsProvider {
  synthesize(text: string, voice: string): Promise<Uint8Array>;
}

export interface LlmProvider {
  complete(prompt: string): Promise<string>;
}

export interface GoogleAuth {
  getAuthUrl(state: string): Promise<string>;
}

export interface Observability {
  captureException(err: unknown): void;
  captureMessage(message: string): void;
}
