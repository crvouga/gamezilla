import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { feedbackContextProviders } from '@pkgs/feedback-shared-ts/context';
import { createDebugBuffer } from '@pkgs/feedback-shared-ts/debug-buffer';
import type { DiagnosticProvider } from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { renderBugReportSurface, type ThemePort } from './bug-report-surface';
import { BugReportController } from './controller';
import { installDebugRecording } from './debug-recording';
import type { ConnectionPort, MotionPort, ScreenshotPort } from './ports';
import {
  BUG_REPORT_REQUEST_EVENT,
  registerBugReports,
} from './request-bug-report';
import { createBugReportSender } from './sender';
import { ShakeControl } from './shake';
import { BugReportStorage } from './storage';
import { installThreeFingerPress } from './three-finger-press';

export type MountBugReportsOptions = {
  readonly window: Window;
  readonly document: Document;
  /** An element of its own, outside the app, so the app's fate is not its own. */
  readonly host: HTMLElement;
  readonly endpoint: string;
  readonly http: HttpClient;
  readonly store: ObjectStore;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly screenshot: ScreenshotPort;
  readonly connection: ConnectionPort;
  readonly motion: MotionPort;
  readonly theme: ThemePort;
  /** The device and the version of the app, and whatever else helps reproduce a bug. */
  readonly providers: readonly DiagnosticProvider[];
  /** An event the app dispatches on the document, carrying trouble it caught itself. */
  readonly applicationErrorEvent?: string;
};

function shortcut(open: () => void): (event: Event) => void {
  return (event) => {
    const key = event as KeyboardEvent;
    if (!(key.ctrlKey || key.metaKey) || !key.shiftKey || key.code !== 'KeyB')
      return;
    key.preventDefault();
    open();
  };
}

/**
 * Starts bug reporting: debug info is kept from here on, and the bug report
 * opens on request, on a shake, on a three-finger press anywhere on
 * `document`, or on Ctrl/Cmd+Shift+B. Mount it before the app starts, so a
 * bug in starting the app can itself be reported.
 */
export function mountBugReports(options: MountBugReportsOptions) {
  const { window, document, clock, timers } = options;
  const debug = createDebugBuffer({ clock });
  const storage = new BugReportStorage(options.store, options.createId);
  const controller = new BugReportController({
    storage,
    send: createBugReportSender(options),
    screenshot: options.screenshot,
    connection: options.connection,
    debug,
    providers: () => [...options.providers, ...feedbackContextProviders()],
    clock,
    timers,
    createId: options.createId,
  });
  const open = (): void => void controller.open();
  const shake = new ShakeControl({
    motion: options.motion,
    storage,
    clock,
    onShake: open,
  });
  const restored = storage.loadTrail().then(debug.restore, () => undefined);
  const onShortcut = shortcut(open);
  document.addEventListener(BUG_REPORT_REQUEST_EVENT, open);
  document.addEventListener('keydown', onShortcut);
  const cleanups = [
    () => document.removeEventListener(BUG_REPORT_REQUEST_EVENT, open),
    () => document.removeEventListener('keydown', onShortcut),
    installThreeFingerPress({ target: document, timers, onPress: open }),
    installDebugRecording({
      window,
      document,
      debug,
      timers,
      onKeep: () => void storage.saveTrail(debug.snapshot()),
      ...(options.applicationErrorEvent
        ? { applicationErrorEvent: options.applicationErrorEvent }
        : {}),
    }),
    options.connection.subscribe(() => {
      if (options.connection.online()) void controller.flush();
    }),
    registerBugReports(document, { controller, shake }),
    renderBugReportSurface(options.host, controller, options),
  ];
  return {
    controller,
    shake,
    debug,
    ready: Promise.all([controller.ready, shake.ready, restored]).then(
      () => undefined
    ),
    dispose(): void {
      for (const cleanup of cleanups) cleanup();
      controller.dispose();
      shake.dispose();
    },
  };
}
