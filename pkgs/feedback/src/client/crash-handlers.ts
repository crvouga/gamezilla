import type { FeedbackDiagnostics } from './diagnostics-buffer';

export function installCrashHandlers(options: {
  readonly target: Window;
  readonly diagnostics: FeedbackDiagnostics;
  readonly openFeedback: () => void;
  readonly applicationErrorEvent?: string;
}): () => void {
  const onError = (event: ErrorEvent) =>
    options.diagnostics.record('error', event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) =>
    options.diagnostics.record('unhandled rejection', event.reason);
  const onApplicationError = (event: Event) =>
    options.diagnostics.record(
      'application render',
      (event as CustomEvent<unknown>).detail
    );
  const onShortcut = (event: KeyboardEvent) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.code === 'KeyB'
    ) {
      event.preventDefault();
      options.openFeedback();
    }
  };
  options.target.addEventListener('error', onError);
  options.target.addEventListener('unhandledrejection', onRejection);
  if (options.applicationErrorEvent)
    options.target.addEventListener(
      options.applicationErrorEvent,
      onApplicationError
    );
  options.target.addEventListener('keydown', onShortcut);
  return () => {
    options.target.removeEventListener('error', onError);
    options.target.removeEventListener('unhandledrejection', onRejection);
    if (options.applicationErrorEvent)
      options.target.removeEventListener(
        options.applicationErrorEvent,
        onApplicationError
      );
    options.target.removeEventListener('keydown', onShortcut);
  };
}
