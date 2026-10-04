import { createFeedbackDiagnostics } from './diagnostics-buffer';

/** Installs feedback before starting the host application. */
export function startFeedbackRuntime(options: {
  readonly installFeedback: (
    diagnostics: ReturnType<typeof createFeedbackDiagnostics>
  ) => void;
  readonly startApplication: () => Promise<unknown>;
}) {
  const diagnostics = createFeedbackDiagnostics();
  options.installFeedback(diagnostics);
  let application: Promise<unknown>;
  try {
    application = options.startApplication();
  } catch (error) {
    diagnostics.record('bootstrap', error);
    return diagnostics;
  }
  void application.catch((error: unknown) =>
    diagnostics.record('bootstrap', error)
  );
  return diagnostics;
}
