/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import { createSignal, ErrorBoundary, lazy, Suspense } from 'solid-js';
import { ClockProvider, type ClockServices } from './clock-context';
import { type Settings, SettingsPanel } from './settings-panel';
import { ThemeSchemeProvider, ThemeToggle } from './theme-context';
import { TickingClock } from './ticking-clock';
import { VirtualizedList } from './virtualized-list';

const ThemedBadge = lazy(() => import('./themed-badge'));

export type ExemplarsAppProps = ClockServices;

const DEMO_SETTINGS: Settings = {
  displayName: 'Guest',
  soundEnabled: true,
  volume: 50,
  tags: ['blitz', 'puzzles'],
};

export function ExemplarsApp(props: ExemplarsAppProps) {
  const [saved, setSaved] = createSignal<Settings | null>(null);
  return (
    <ClockProvider clock={props.clock} timers={props.timers}>
      <ThemeSchemeProvider>
        <main data-screen="exemplars">
          <h1>
            <Trans>Solid exemplars</Trans>
          </h1>
          <TickingClock />
          <VirtualizedList
            count={10_000}
            fixedViewport={{ width: 360, height: 320 }}
            renderRow={(i) => `space-${i}`}
          />
          <SettingsPanel initial={DEMO_SETTINGS} onSave={setSaved} />
          <pre data-testid="saved-settings">
            {saved() === null ? '—' : JSON.stringify(saved())}
          </pre>
          <ThemeToggle />
          <ErrorBoundary
            fallback={(error: unknown) => (
              <p role="alert">{error instanceof Error ? error.message : ''}</p>
            )}
          >
            <Suspense
              fallback={
                <span>
                  <Trans>Loading…</Trans>
                </span>
              }
            >
              <ThemedBadge />
            </Suspense>
          </ErrorBoundary>
        </main>
      </ThemeSchemeProvider>
    </ClockProvider>
  );
}
