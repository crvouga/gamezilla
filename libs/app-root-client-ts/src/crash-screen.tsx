/** @jsxImportSource solid-js */

import {
  APP_VERSION,
  getShortCommitHash,
  hasCommitProvenance,
} from '@libs/app-root-shared-ts/app-metadata';
import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  untrack,
} from 'solid-js';
import { reportSolidBoundaryError } from './browser-boundaries';
import type { CrashCopyPhase } from './crash-copy-button';
import { CrashScreenView, useCrashTitle } from './crash-screen-view';

const COPIED_HOLD_MS = 2000;

type CrashScreenProps = {
  readonly error: Error;
  readonly reset: () => void;
  /** Leave the crashed screen for Spaces; `reset` re-renders in place. */
  readonly goToSpaces: (reset: () => void) => void;
  readonly copyError: (text: string) => Promise<void>;
};

/** The version people and the team can match a report against. */
function buildVersion(): string {
  return hasCommitProvenance()
    ? `${APP_VERSION} (${getShortCommitHash()})`
    : APP_VERSION;
}

function useCrashTrace(error: () => Error): () => string | undefined {
  const [traceId, setTraceId] = createSignal<string>();
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  onMount(() => {
    const exception = untrack(error);
    try {
      const id = reportSolidBoundaryError(exception);
      if (mounted && id !== undefined && !/^0+$/.test(id)) setTraceId(id);
    } catch {
      // Recovery must survive a failed telemetry report.
    }
  });
  return traceId;
}

/** Copy progress; "Copied" falls back to idle after a short hold. */
function useCrashCopy(copyError: (text: string) => Promise<void>): {
  readonly phase: () => CrashCopyPhase;
  readonly copy: (text: string) => Promise<void>;
} {
  const timers = useTimers();
  const [phase, setPhase] = createSignal<CrashCopyPhase>('idle');
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  createEffect(() => {
    if (phase() !== 'copied') return;
    const handle = timers.setTimeout(() => setPhase('idle'), COPIED_HOLD_MS);
    onCleanup(() => timers.clearTimeout(handle));
  });
  const copy = async (text: string): Promise<void> => {
    setPhase('pending');
    try {
      await copyError(text);
      if (mounted) setPhase('copied');
    } catch {
      if (mounted) setPhase('error');
    }
  };
  return { phase, copy };
}

/** Plain diagnostic text: what broke and how to find it. No stack, no URL. */
export function crashCopyText(args: {
  readonly title: string;
  readonly message: string;
  readonly reference: string | undefined;
}): string {
  return [
    args.title,
    args.message,
    args.reference === undefined ? undefined : `Reference: ${args.reference}`,
    `Version: ${buildVersion()}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n\n');
}

/** Wires `CrashScreenView` to telemetry, the clipboard and recovery. */
export function CrashScreen(props: CrashScreenProps): JSX.Element {
  const title = useCrashTitle();
  const traceId = useCrashTrace(() => props.error);
  const copier = useCrashCopy((text) => props.copyError(text));
  const message = (): string =>
    props.error.message.trim() || String(props.error);
  return (
    <CrashScreenView
      message={message()}
      reference={traceId()}
      copyPhase={copier.phase()}
      onTryAgain={() => props.reset()}
      onGoToSpaces={() => props.goToSpaces(props.reset)}
      onReload={reloadApp}
      onCopy={() => {
        void copier.copy(
          crashCopyText({
            title: title(),
            message: message(),
            reference: traceId(),
          })
        );
      }}
    />
  );
}
