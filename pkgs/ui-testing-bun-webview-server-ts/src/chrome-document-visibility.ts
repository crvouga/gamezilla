import type { browserCallDiagnostics } from './browser-call-diagnostics';

type Evaluate = (
  method: 'Runtime.evaluate',
  params: { expression: string; returnByValue: true; awaitPromise: false }
) => Promise<{ result?: { value?: unknown }; exceptionDetails?: unknown }>;

/** WebView.evaluate wraps even a synchronous boolean in an awaited page promise. */
export function chromeDocumentVisibility(
  view: Pick<Bun.WebView, 'url' | 'title' | 'loading'> & { cdp: Evaluate },
  diagnostics: Pick<ReturnType<typeof browserCallDiagnostics>, 'watch'>
) {
  return async (expression: string): Promise<boolean> => {
    const { url, title } = view;
    const reply = await diagnostics.watch(
      () => {
        const changed = view.url !== url || view.title !== title;
        return `opener.cdp(Runtime.evaluate) [loading=${view.loading}, navigation metadata changed=${changed}]`;
      },
      () =>
        view.cdp('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: false,
        })
    );
    if (
      reply.exceptionDetails !== undefined ||
      typeof reply.result?.value !== 'boolean'
    )
      throw new Error('Chrome could not read document visibility');
    return reply.result.value;
  };
}
