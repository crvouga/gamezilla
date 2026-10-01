import { FEEDBACK_OPEN_EVENT } from './open-feedback';
import type { FeedbackControllerOptions } from './controller';
import { FeedbackController } from './controller';
import { installCrashHandlers } from './crash-handlers';
import { installInteractionRecording } from './interaction-recording';
import type { createRootDiagnostics } from './root-diagnostics';

export function mountRootReporting(
  options: FeedbackControllerOptions & {
    readonly window: Window;
    readonly document: Document;
    readonly host: HTMLElement;
    readonly diagnostics: ReturnType<typeof createRootDiagnostics>;
  }
) {
  options.host.setAttribute('data-feedback-root', '');
  options.host.className = 'box fixed inset-0 pointer-events-none';
  const controller = new FeedbackController({
    ...options,
    providers: [options.diagnostics.provider, ...options.providers],
  });
  options.document.addEventListener(FEEDBACK_OPEN_EVENT, controller.open);
  const removeCrashHandlers = installCrashHandlers(
    options.window,
    options.diagnostics,
    () => controller.open()
  );
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
      options.document.removeEventListener(FEEDBACK_OPEN_EVENT, controller.open);
      removeCrashHandlers();
      removeInteractions();
      controller.dispose();
      unmount?.();
      options.host.remove();
    },
  };
}
