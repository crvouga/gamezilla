/** @jsxImportSource solid-js */
/** Recovery sits inside the minimal theme root, outside sub providers. */
import { ErrorBoundary, type JSX } from 'solid-js';
import { CrashScreen } from './crash-screen';

export function RootErrorBoundary(props: {
  readonly children: JSX.Element;
  readonly copyError: (text: string) => Promise<void>;
}): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(error: unknown, reset) => {
        const normalized =
          error instanceof Error ? error : new Error(String(error));
        try {
          globalThis.dispatchEvent(
            new CustomEvent('product-crash', { detail: normalized })
          );
        } catch {
          /* reporting enrichment cannot break the crash screen */
        }
        return (
          <CrashScreen
            error={normalized}
            reset={reset}
            copyError={props.copyError}
          />
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
