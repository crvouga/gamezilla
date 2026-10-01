import type { FeedbackControllerOptions } from './controller';
import { FeedbackController } from './controller';
import { installCrashHandlers } from './crash-handlers';
import type { FeedbackDiagnostics } from './diagnostics-buffer';
import { installInteractionRecording } from './interaction-recording';
import { FEEDBACK_OPEN_EVENT } from './open-feedback';

export function mountFeedback(
  options: FeedbackControllerOptions & {
    readonly window: Window;
    readonly document: Document;
    readonly host: HTMLElement;
    readonly diagnostics: FeedbackDiagnostics;
    readonly applicationErrorEvent?: string;
  }
) {
  options.host.setAttribute('data-feedback-root', '');
  options.host.className = 'box fixed inset-0 pointer-events-none';
  const controller = new FeedbackController({
    ...options,
    providers: [options.diagnostics.provider, ...options.providers],
  });
  const openFeedback = () => controller.open();
  options.document.addEventListener(FEEDBACK_OPEN_EVENT, openFeedback);
  const removeCrashHandlers = installCrashHandlers({
    target: options.window,
    diagnostics: options.diagnostics,
    openFeedback: () => controller.open(),
    applicationErrorEvent: options.applicationErrorEvent,
  });
  const removeInteractions = installInteractionRecording({
    document: options.document,
    path: () => options.window.location.pathname,
    recorder: controller.recorder,
  });
  let disposed = false;
  let unmount: (() => void) | undefined;
  const ready = import('./reporting-surface').then((module) => {
    if (!disposed)
      unmount = module.createReportingSurface(
        options.host,
        controller,
        options
      );
  });
  return {
    controller,
    ready,
    open: controller.open,
    dispose(): void {
      disposed = true;
      options.document.removeEventListener(FEEDBACK_OPEN_EVENT, openFeedback);
      removeCrashHandlers();
      removeInteractions();
      controller.dispose();
      unmount?.();
      options.host.remove();
    },
  };
}
