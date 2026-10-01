import type { createRootDiagnostics } from './root-diagnostics';

export function installCrashHandlers(
  target: Window,
  diagnostics: ReturnType<typeof createRootDiagnostics>,
  openReporting: () => void
): () => void {
  const onError = (event: ErrorEvent) =>
    diagnostics.record('error', event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) =>
    diagnostics.record('unhandled rejection', event.reason);
  const onProductCrash = (event: Event) =>
    diagnostics.record(
      'product render',
      (event as CustomEvent<unknown>).detail
    );
  const onShortcut = (event: KeyboardEvent) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.code === 'KeyB'
    ) {
      event.preventDefault();
      openReporting();
    }
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  target.addEventListener('product-crash', onProductCrash);
  target.addEventListener('keydown', onShortcut);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
    target.removeEventListener('product-crash', onProductCrash);
    target.removeEventListener('keydown', onShortcut);
  };
}
