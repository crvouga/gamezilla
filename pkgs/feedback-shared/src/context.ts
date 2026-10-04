import type { DiagnosticProvider } from './types';

const providers = new Set<DiagnosticProvider>();
const traces: string[] = [];

/** Register only context a person can already see; never auth tokens or a database dump. */
export function registerFeedbackContext(
  provider: DiagnosticProvider
): () => void {
  providers.add(provider);
  return () => {
    providers.delete(provider);
  };
}

export function feedbackContextProviders(): readonly DiagnosticProvider[] {
  return [...providers, { name: 'recent-traces', collect: () => [...traces] }];
}

export function recordFeedbackTrace(traceId: string): void {
  if (!/^[a-f0-9]{32}$/.test(traceId) || traces.at(-1) === traceId) return;
  traces.push(traceId);
  if (traces.length > 20) traces.shift();
}
