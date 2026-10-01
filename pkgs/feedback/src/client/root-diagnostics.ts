import type { DiagnosticProvider } from '../shared/types';

/** Small bounded crash trail; no product context or telemetry SDK required. */
export function createRootDiagnostics() {
  const errors: { source: string; message: string }[] = [];
  return {
    record(source: string, error: unknown): void {
      let message = 'Uninspectable error';
      try {
        message =
          error instanceof Error
            ? `${error.message}\n${error.stack ?? ''}`
            : String(error);
      } catch {
        /* hostile getters must not break the crash handler */
      }
      errors.push({ source, message: message.slice(0, 4000) });
      if (errors.length > 20) errors.shift();
    },
    provider: {
      name: 'crashes',
      collect: () => errors.map((error) => ({ ...error })),
    } satisfies DiagnosticProvider,
  };
}
