/** @jsxImportSource solid-js */
import {
  Button,
  CloseIconButton,
  dataAttrs,
  ResponsiveSurface,
  useLayoutMode,
  useThemeLayout,
} from '@pkgs/ui';
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
  let resizeObserver: ResizeObserver | undefined;
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
    if (frame && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(drag.clamp);
      resizeObserver.observe(frame);
    }
    drag.clamp();
  });
  onCleanup(() => {
    frame?.removeEventListener('keydown', escape);
    window.removeEventListener('resize', drag.clamp);
    resizeObserver?.disconnect();
    if (previous instanceof HTMLElement) previous.focus();
  });
  return (
    <section
      ref={frame}
      role="dialog"
      aria-modal="false"
      aria-label="Feedback"
      class="box fixed right-4 bottom-4 w-128 h-160 max-w-full rounded-2xl border border-border bg-surface shadow-2xl pointer-events-auto overflow-hidden"
      style={{
        transform: `translate(${position().x}px, ${position().y}px)`,
        'max-height': `${Math.max(0, layout.layout().height - 48)}px`,
      }}
      {...dataAttrs({ component: 'FeedbackWidget', testid: 'feedback-widget' })}
    >
      <div class="box flex-row items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          class="text flex-1 text-left cursor-grab touch-none font-semibold"
          aria-label="Move feedback widget; use arrow keys"
          onPointerDown={drag.down}
          onPointerMove={drag.move}
          onPointerUp={drag.up}
          onPointerCancel={drag.up}
          onKeyDown={drag.key}
          data-testid="feedback-drag"
          {...dataAttrs({ component: 'FeedbackWidgetHandle' })}
        >
          <span class="text-tint mr-2" aria-hidden="true">
            ⠿
          </span>
          Feedback
        </button>
        <CloseIconButton
          onClick={props.controller.close}
          dataSet={{ testid: 'feedback-close' }}
        />
      </div>
      <div class="box flex-1 min-h-0 shrink overflow-hidden">
        <FeedbackPanel controller={props.controller} />
      </div>
    </section>
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
        <div
          class="box fixed bottom-6 right-4 rounded-xl border border-border bg-surface p-3 gap-2 pointer-events-auto"
          data-component="FeedbackRecordingControls"
        >
          <p class="text textCaption" role="status">
            Recording reproduction…
          </p>
          <Button
            title="Stop recording"
            onClick={() => {
              void props.controller.recorder.stop();
            }}
            dataSet={{ testid: 'feedback-stop' }}
          />
        </div>
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
