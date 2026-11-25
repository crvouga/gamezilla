import { t } from '@lingui/core/macro';
import { onCleanup, untrack } from 'solid-js';
import { Button } from '../button/index';
import { type ArenaCamera, FIT, inspectionCamera } from './camera';
import styles from './inspection.module.css';

type InspectionProps = {
  drawing: () => SVGSVGElement;
  camera: ArenaCamera;
  paint: (view: ArenaCamera) => void;
};

function point(event: MouseEvent, rect: DOMRect) {
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function inspectionKey(
  camera: ReturnType<typeof inspectionCamera>,
  event: KeyboardEvent
) {
  const actions: Record<string, () => void> = {
    '+': () => camera.scale(1.5),
    '=': () => camera.scale(1.5),
    '-': () => camera.scale(1 / 1.5),
    Home: camera.fit,
    Escape: camera.fit,
    ArrowLeft: () => camera.pan(-0.15, 0),
    ArrowRight: () => camera.pan(0.15, 0),
    ArrowUp: () => camera.pan(0, -0.15),
    ArrowDown: () => camera.pan(0, 0.15),
  };
  const action = actions[event.key];
  if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  action();
}

/** Only mounted for watchers. Its captured contacts never enter a riding session. */
export function ArenaInspection(props: InspectionProps) {
  const camera = inspectionCamera(untrack(() => props.paint));
  let surface: HTMLElement | undefined;
  onCleanup(() => {
    surface?.removeEventListener('wheel', wheel);
    window.removeEventListener('blur', camera.clear);
    props.paint(FIT);
  });
  function wheel(event: WheelEvent) {
    if (!event.ctrlKey && props.camera.zoom === 1) return;
    event.preventDefault();
    const rect = props.drawing().getBoundingClientRect();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
    const anchor = point(event, rect);
    if (event.ctrlKey)
      camera.move(anchor, anchor, Math.exp((-event.deltaY * unit) / 220));
    else
      camera.pan(
        (event.deltaX * unit) / rect.width,
        (event.deltaY * unit) / rect.height
      );
  }
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- This spatial application accepts captured pointers and keyboard pan commands. */}
      <div
        class={styles['viewport']}
        role="application"
        aria-label={t`Inspect arena. Pinch to zoom, then drag to pan. Use plus or minus to zoom, arrow keys to pan, and Home to fit.`}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users focus the spatial application to pan and zoom it.
        tabindex={0}
        ref={(element) => {
          surface = element;
          element.addEventListener('wheel', wheel, { passive: false });
          window.addEventListener('blur', camera.clear);
        }}
        onKeyDown={(event) => inspectionKey(camera, event)}
        onBlur={camera.clear}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          camera.start(
            event.pointerId,
            point(event, props.drawing().getBoundingClientRect())
          );
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const rect = props.drawing().getBoundingClientRect();
          camera.drag(
            event.pointerId,
            point(event, rect),
            rect.width / rect.height
          );
        }}
        onPointerUp={(event) => camera.end(event.pointerId)}
        onLostPointerCapture={(event) => camera.end(event.pointerId)}
        onPointerCancel={camera.clear}
      />
      <div class={styles['tools']}>
        <Button
          size="sm"
          title={props.camera.zoom === 1 ? t`Zoom in` : t`Fit arena`}
          onClick={() =>
            props.camera.zoom === 1 ? camera.scale(2) : camera.fit()
          }
        />
      </div>
    </>
  );
}
