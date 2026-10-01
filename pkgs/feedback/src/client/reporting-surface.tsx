/** @jsxImportSource solid-js */
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock/solid';
import {
  Button,
  InfoIcon,
  OVERLAY_PORTAL_Z_INDEX,
  OverflowMenuButton,
  OverlayPortalProvider,
  ResponsiveSurface,
  SuccessState,
  SurfaceStackProvider,
  ThemeProvider,
} from '@pkgs/ui';
import { createSignal, onCleanup, Show } from 'solid-js';
import { render } from 'solid-js/web';
import type { FeedbackKind } from '../shared/types';
import type {
  FeedbackController,
  FeedbackControllerOptions,
} from './controller';
import { FeedbackForm } from './feedback-form';
import { useFeedbackState, useRecordingState } from './use-feedback-state';

const KINDS: readonly { kind: FeedbackKind; label: string }[] = [
  { kind: 'problem', label: 'Report a problem' },
  { kind: 'feature', label: 'Request a feature' },
  { kind: 'gap', label: 'Something is missing' },
  { kind: 'polish', label: 'Suggest some polish' },
];
function SupportSurface(props: { controller: FeedbackController }) {
  const state = useFeedbackState(() => props.controller);
  const recording = useRecordingState(() => props.controller);
  return (
    <>
      <div class="box fixed right-3 bottom-20 gap-2 pointer-events-auto safeBottom">
        <Show
          when={recording().phase === 'recording'}
          fallback={
            <OverflowMenuButton
              aria-label="Support"
              icon={InfoIcon}
              placement="top-end"
              header={{ title: 'Support & feedback' }}
              dataSet={{ testid: 'feedback-open' }}
              actions={[
                ...KINDS.map((item) => ({
                  id: item.kind,
                  label: item.label,
                  onClick: () => props.controller.open(item.kind),
                  dataSet: { testid: `feedback-kind-${item.kind}` },
                })),
                {
                  id: 'record',
                  label:
                    recording().phase === 'ready'
                      ? 'Review reproduction'
                      : 'Record reproduction',
                  onClick: () => {
                    props.controller.open('problem');
                    if (recording().phase === 'idle')
                      void props.controller.recorder.start();
                  },
                },
              ]}
            />
          }
        >
          <Button
            title="Stop recording"
            onClick={() => {
              void props.controller.recorder.stop();
            }}
            dataSet={{ testid: 'feedback-stop' }}
          />
        </Show>
      </div>
      <ResponsiveSurface
        visible={state().visible}
        onClose={props.controller.close}
        title={
          KINDS.find((item) => item.kind === state().draft.kind)?.label ??
          'Share feedback'
        }
        size="medium"
        stackId="feedback"
        dataSet={{ testid: 'feedback-surface' }}
      >
        <Show
          when={state().phase === 'saved'}
          fallback={
            <FeedbackForm controller={props.controller} state={state} />
          }
        >
          <SuccessState
            title="Feedback received"
            body="Your feedback and reproduction context have been saved."
            action={{ label: 'Done', onClick: props.controller.close }}
            variant="compact"
          />
        </Show>
      </ResponsiveSurface>
    </>
  );
}
export function createReportingSurface(
  host: HTMLElement,
  controller: FeedbackController,
  ports: Pick<FeedbackControllerOptions, 'clock' | 'timers' | 'theme'>
) {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  host.style.setProperty('z-index', String(OVERLAY_PORTAL_Z_INDEX));
  return render(() => {
    const readTheme = () =>
      ports.theme?.read() ??
      (host.ownerDocument.documentElement.dataset['theme'] === 'light'
        ? 'light'
        : 'dark');
    const [scheme, setScheme] = createSignal(readTheme());
    const unsubscribe = ports.theme?.subscribe(() => setScheme(readTheme()));
    onCleanup(() => unsubscribe?.());
    return (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={ports.clock} timers={ports.timers}>
          <ThemeProvider
            colorScheme={scheme()}
            transparent
            manageDocumentTheme={false}
          >
            <OverlayPortalProvider>
              <SurfaceStackProvider>
                <SupportSurface controller={controller} />
              </SurfaceStackProvider>
            </OverlayPortalProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    );
  }, host);
}
