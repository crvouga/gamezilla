import { createRootDiagnostics } from './root-diagnostics';

/** Install before importing product modules. Product bootstrap is never awaited. */
export function startRootRuntime(options: {
  readonly installReporting: (
    diagnostics: ReturnType<typeof createRootDiagnostics>
  ) => void;
  readonly startProduct: () => Promise<unknown>;
}) {
  const diagnostics = createRootDiagnostics();
  options.installReporting(diagnostics);
  let product: Promise<unknown>;
  try {
    product = options.startProduct();
  } catch (error) {
    diagnostics.record('bootstrap', error);
    return diagnostics;
  }
  void product.catch((error: unknown) =>
    diagnostics.record('bootstrap', error)
  );
  return diagnostics;
}
