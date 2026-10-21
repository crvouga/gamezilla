/** @jsxImportSource solid-js */
import { afterEach, expect, spyOn, test } from 'bun:test';
import { AppThemeProvider } from '@libs/app-root-client/app-theme-provider';
import { RootErrorBoundary } from '@libs/app-root-client/root-error-boundary';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { type Tracer, trace } from '@opentelemetry/api';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createRecordingClipboard } from '@pkgs/device-shared/clipboard';
import { createMotionPreference } from '@pkgs/device-shared/motion-preference';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';
import { TestViewportProvider } from '@pkgs/ui-root-client/test-viewport';
import { useThemePreference } from '@pkgs/ui-root-client/theme-preference';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

const FAILURE =
  'useAuthModals: AuthModalsProvider missing — wrap with AppProviders';

afterEach(cleanup);

function mountCrash(copy?: (text: string) => Promise<void>) {
  const harness = createHarnessClock();
  const departures: (() => void)[] = [];
  const clipboard = createRecordingClipboard();
  const [broken, setBroken] = createSignal(true);
  let setTheme: (scheme: 'light' | 'dark') => void = () => {
    /* Bound when Contents mounts. */
  };
  function Contents(): JSX.Element {
    setTheme = useThemePreference().setPreference;
    return (
      <RootErrorBoundary
        copyError={copy ?? clipboard.writeText}
        goToSpaces={(reset) => departures.push(reset)}
      >
        {(() => {
          if (broken()) throw new Error(FAILURE);
          return <p>Recovered screen</p>;
        })()}
      </RootErrorBoundary>
    );
  }
  const view = render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <TestViewportProvider value={{ width: 320, height: 480 }}>
          <AppThemeProvider
            kv={new KvImplInMemory()}
            motion={createMotionPreference()}
          >
            <Contents />
          </AppThemeProvider>
        </TestViewportProvider>
      </ClockProvider>
    </I18nProvider>
  ));
  return { ...view, harness, clipboard, departures, setBroken, setTheme };
}

// regression: crash-screen-hardcoded-theme
test.each(['light', 'dark'] as const)(
  'a provider crash retains the %s theme and recovery controls',
  (scheme) => {
    const view = mountCrash();
    view.setTheme(scheme);
    const alert = screen.getByRole('alert');
    const root = alert.closest('[data-component="RootErrorBoundary"]');
    expect(root?.closest('[data-theme]')?.getAttribute('data-theme')).toBe(
      scheme
    );
    expect(root?.classList.contains('bg-background')).toBe(true);
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' })
    ).toBeTruthy();
    const details = screen.getByText('Error details').closest('details');
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain(FAILURE);
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeTruthy();
    expect(screen.queryByText(/^Reference:/)).toBeNull();
    view.setBroken(false);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Recovered screen')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe(scheme);
  }
);

test('copies diagnostic text and releases its feedback timer when recovered', async () => {
  const view = mountCrash();
  fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
  await Promise.resolve();
  expect(view.clipboard.last()).toBe(
    `Something went wrong\n\n${FAILURE}\n\nVersion: 1.0.0`
  );
  expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  expect(auditTree(document.body).map(formatFailure)).toEqual([]);
  view.harness.clock.advance(2000);
  expect(
    screen.getByRole('button', { name: 'Copy error' }).textContent
  ).toContain('Copy error');
  fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
  await Promise.resolve();
  expect(view.harness.clock.pendingOneShotCount()).toBe(1);
  view.setBroken(false);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(view.harness.clock.pendingOneShotCount()).toBe(0);
});

// regression: crash-copy-rejection
test('a denied clipboard write keeps recovery usable and shows a retryable error', async () => {
  let attempts = 0;
  const view = mountCrash(() => {
    attempts += 1;
    return attempts === 1
      ? Promise.reject(new Error('Clipboard access denied'))
      : Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
  await Promise.resolve();
  expect(screen.getByRole('status').textContent).toContain('Couldn’t copy');
  expect(screen.queryByText('Copied')).toBeNull();
  expect(view.harness.clock.pendingOneShotCount()).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
  await Promise.resolve();
  expect(attempts).toBe(2);
  expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
});

test('reload invokes the host reload action', () => {
  const reload = spyOn(globalThis.location, 'reload').mockImplementation(() => {
    /* Record reload without navigating the test host. */
  });
  try {
    mountCrash();
    fireEvent.click(screen.getByRole('button', { name: 'Reload app' }));
    expect(reload).toHaveBeenCalledTimes(1);
  } finally {
    reload.mockRestore();
  }
});

test('a clipboard write settling after recovery leaves no feedback timer', async () => {
  const pending = Promise.withResolvers<undefined>();
  const view = mountCrash(() => pending.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Copy error' })
      .disabled
  ).toBe(true);
  view.setBroken(false);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  pending.resolve(undefined);
  await pending.promise;
  expect(view.harness.clock.pendingOneShotCount()).toBe(0);
  expect(screen.getByText('Recovered screen')).toBeTruthy();
});

// regression: crash-screen-no-way-out
test('a screen that crashes again on Try again still offers a way to Spaces', () => {
  const view = mountCrash();
  expect(screen.getByRole('alert').textContent).toContain(
    'Anything already saved on this device is kept'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Go to Spaces' }));
  expect(view.departures).toHaveLength(1);
  view.setBroken(false);
  view.departures[0]?.();
  expect(screen.getByText('Recovered screen')).toBeTruthy();
});

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

/** A tracer whose every span carries {@link TRACE_ID}, as a live exporter would. */
function installTracer(): void {
  const span = () =>
    trace.wrapSpanContext({
      traceId: TRACE_ID,
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
    });
  const tracer = { startSpan: span } as unknown as Tracer;
  trace.setGlobalTracerProvider({ getTracer: () => tracer });
}

// regression: crash-screen-no-way-out
test('the crash reference is visible and the copied text carries it without the stack', async () => {
  installTracer();
  try {
    const view = mountCrash();
    const reference = screen.getByText(`Reference: ${TRACE_ID}`);
    expect(reference.closest('details')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
    await Promise.resolve();
    expect(view.clipboard.last()).toBe(
      `Something went wrong\n\n${FAILURE}\n\nReference: ${TRACE_ID}\n\nVersion: 1.0.0`
    );
  } finally {
    trace.disable();
  }
});
