/** @jsxImportSource @solidjs/web */
/** Recovery sits inside the minimal theme root, outside sub providers. */
import { i18n } from '@libs/app-root-shared-ts/i18n';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import type { JSX } from '@solidjs/web';
import { createMemo, Errored, onSettled } from 'solid-js';
import { OpeningContent } from './browser-opening';
import { CrashScreen } from './crash-screen';

type RecoveryProps = {
  readonly copyError: (text: string) => Promise<void>;
  /** The way out of a screen that crashes again on Try again. */
  readonly goToSpaces: (reset: () => void) => void;
};

function announceCrash(error: Error): void {
  try {
    document.dispatchEvent(new CustomEvent('product-crash', { detail: error }));
  } catch {
    /* reporting enrichment cannot break the crash screen */
  }
}

function CrashRecovery(
  props: RecoveryProps & {
    readonly error: unknown;
    readonly reset: () => void;
  }
): JSX.Element {
  const normalized = createMemo(() =>
    props.error instanceof Error ? props.error : new Error(String(props.error))
  );
  onSettled(() => announceCrash(normalized()));
  return (
    <OpeningContent>
    <CrashScreen
      error={normalized()}
      reset={props.reset}
      goToSpaces={props.goToSpaces}
      copyError={props.copyError}
    />
    </OpeningContent>
  );
}

export function RootErrorBoundary(
  props: RecoveryProps & { readonly children: JSX.Element }
): JSX.Element {
  return (
    <Errored
      fallback={(error, reset) => (
        // The shell's translations are provided inside the tree that crashed.
        <I18nProvider i18n={i18n}>
          <CrashRecovery
            error={error()}
            reset={reset}
            goToSpaces={props.goToSpaces}
            copyError={props.copyError}
          />
        </I18nProvider>
      )}
    >
      {props.children}
    </Errored>
  );
}
