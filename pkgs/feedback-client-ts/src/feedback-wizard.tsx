/** @jsxImportSource solid-js */
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CloseIconButton } from '@pkgs/ui-root-client-ts/close-icon-button';
import {
  FloatingPanel,
  FloatingPanelHeader,
} from '@pkgs/ui-root-client-ts/floating-panel';
import { observeElementResize } from '@pkgs/ui-root-client-ts/observe-element-resize';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useThemeLayout } from '@pkgs/ui-root-client-ts/theme-context';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { onCleanup, onMount, Show } from 'solid-js';
import type { FeedbackController } from './controller';
import { FeedbackPanel } from './feedback-panel';
import { useFeedbackState, useRecordingState } from './use-feedback-state';
import { useWidgetDrag } from './widget-drag';

function DesktopWidget(props: { controller: FeedbackController }) {
  const state = useFeedbackState(() => props.controller);
  let frame: HTMLElement | undefined;
  const layout = useThemeLayout();
  const drag = useWidgetDrag(
    () => props.controller,
    () => frame,
    layout.layout
  );
  const position = () => {
    state();
    return props.controller.workspace.state().position;
  };
  const previous = document.activeElement;
  let stopResize: (() => void) | undefined;
  const escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      props.controller.close();
    }
  };
  onMount(() => {
    frame?.querySelector<HTMLInputElement>('input')?.focus();
    frame?.addEventListener('keydown', escape);
    window.addEventListener('resize', drag.clamp);
    if (frame) stopResize = observeElementResize(frame, drag.clamp);
    drag.clamp();
  });
  onCleanup(() => {
    frame?.removeEventListener('keydown', escape);
    window.removeEventListener('resize', drag.clamp);
    stopResize?.();
    if (previous instanceof HTMLElement) previous.focus();
  });
  return (
    <FloatingPanel
      label="Feedback"
      size="window"
      offset={position()}
      maxHeight={layout.layout().height - 48}
      panelRef={(element) => {
        frame = element;
      }}
      testId="feedback-widget"
      header={
        <FloatingPanelHeader
          title="Feedback"
          handleLabel="Move feedback widget; use arrow keys"
          handleTestId="feedback-drag"
          drag={drag}
          trailing={
            <CloseIconButton
              onClick={props.controller.close}
              dataSet={{ testid: 'feedback-close' }}
            />
          }
        />
      }
    >
      <FeedbackPanel controller={props.controller} />
    </FloatingPanel>
  );
}
export function FeedbackWizard(props: { controller: FeedbackController }) {
  const state = useFeedbackState(() => props.controller);
  const recording = useRecordingState(() => props.controller);
  const layout = useLayoutMode();
  const themeLayout = useThemeLayout();
  return (
    <>
      <Show when={recording().phase === 'recording'}>
        <FloatingPanel
          label="Recording"
          role="region"
          testId="feedback-recording-controls"
        >
          <P variant="caption" role="status">
            Recording reproduction…
          </P>
          <Button
            title="Stop recording"
            onClick={() => {
              void props.controller.recorder.stop();
            }}
            dataSet={{ testid: 'feedback-stop' }}
          />
        </FloatingPanel>
      </Show>
      <Show when={state().visible}>
        <Show
          when={layout() === 'wide'}
          fallback={
            <ResponsiveSurface
              visible={state().visible}
              onClose={props.controller.close}
              title="Feedback"
              stackId="feedback"
              bodyHeight={Math.max(
                0,
                Math.min(640, themeLayout.layout().height - 120)
              )}
              dataSet={{ testid: 'feedback-surface' }}
              closeDataSet={{ testid: 'feedback-close' }}
            >
              <FeedbackPanel controller={props.controller} />
            </ResponsiveSurface>
          }
        >
          <DesktopWidget controller={props.controller} />
        </Show>
      </Show>
    </>
  );
}
