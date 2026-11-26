import { t } from '@lingui/core/macro';
import type { JSX } from '@solidjs/web';
import { createSignal, createUniqueId, onSettled, Show } from 'solid-js';
import { Button } from '../button/index';
import { VisuallyHidden } from '../visually-hidden/index';
import styles from './paddle-court.module.css';

type Point = { x: number; y: number };
const center = { x: 0.5, y: 0.5 };
const fit = { scale: 1, x: 0, y: 0 };
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

function contacts(points: Map<number, Point>, rect: DOMRect) {
  const [a, b] = points.values();
  if (!a) return undefined;
  if (!b) return { ...a, distance: 0 };
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot((a.x - b.x) * rect.width, (a.y - b.y) * rect.height),
  };
}

type ChangeView = (from: Point, to: Point, factor: number) => void;

function useInspectionPointers(active: () => boolean, change: ChangeView) {
  const pointers = new Map<number, Point>();
  let surface: HTMLDivElement | undefined;
  function point(event: MouseEvent, box: DOMRect) {
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }
  function down(event: PointerEvent) {
    if (!active() || !surface || event.button !== 0 || pointers.size >= 2)
      return;
    pointers.set(
      event.pointerId,
      point(event, surface.getBoundingClientRect())
    );
    surface.setPointerCapture(event.pointerId);
    surface.focus({ preventScroll: true });
  }
  function move(event: PointerEvent) {
    if (!surface || !pointers.has(event.pointerId)) return;
    const box = surface.getBoundingClientRect();
    const before = contacts(pointers, box);
    pointers.set(event.pointerId, point(event, box));
    const after = contacts(pointers, box);
    if (before && after)
      change(
        before,
        after,
        before.distance > 0 ? after.distance / before.distance : 1
      );
  }
  function end(event: PointerEvent) {
    pointers.delete(event.pointerId);
  }
  function wheel(event: WheelEvent) {
    if (!active() || !surface) return;
    event.preventDefault();
    const box = surface.getBoundingClientRect();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
    const focus = point(event, box);
    if (event.ctrlKey || event.metaKey)
      change(focus, focus, Math.exp((-event.deltaY * unit) / 300));
    else
      change(
        center,
        {
          x: center.x - (event.deltaX * unit) / box.width,
          y: center.y - (event.deltaY * unit) / box.height,
        },
        1
      );
  }
  const clear = () => pointers.clear();
  onSettled(() => {
    const element = surface;
    const listeners = new AbortController();
    const options = { signal: listeners.signal };

    element?.addEventListener('wheel', wheel, { ...options, passive: false });
    element?.addEventListener('pointerdown', down, options);
    element?.addEventListener('pointermove', move, options);
    element?.addEventListener('pointerup', end, options);
    element?.addEventListener('pointercancel', end, options);
    element?.addEventListener('lostpointercapture', end, options);
    window.addEventListener('blur', clear, options);
    document.addEventListener('visibilitychange', clear, options);
    return () => listeners.abort();
  });
  return {
    clear,
    ref: (element: HTMLDivElement) => {
      surface = element;
    },
  };
}

function inspectKey(
  event: KeyboardEvent,
  change: ChangeView,
  toggle: () => void
) {
  const steps: Record<string, Point> = {
    ArrowUp: { x: 0, y: 0.15 },
    ArrowDown: { x: 0, y: -0.15 },
    ArrowLeft: { x: 0.15, y: 0 },
    ArrowRight: { x: -0.15, y: 0 },
  };
  const step = steps[event.key];
  if (step) change(center, { x: center.x + step.x, y: center.y + step.y }, 1);
  else if (event.key === '+' || event.key === '=') change(center, center, 1.5);
  else if (event.key === '-') change(center, center, 1 / 1.5);
  else if (event.key === 'Escape' || event.key === 'Home') toggle();
  else return;
  event.preventDefault();
}

/** Spectator navigation is mounted separately from live paddle input. */
export function CourtInspection(props: { children: JSX.Element }): JSX.Element {
  const helpId = createUniqueId();
  const [active, setActive] = createSignal(false);
  const [view, setView] = createSignal(fit);
  function change(from: Point, to: Point, factor: number) {
    setView((v) => {
      const scale = clamp(v.scale * factor, 1, 3);
      return {
        scale,
        x: clamp(to.x - ((from.x - v.x) * scale) / v.scale, 1 - scale, 0),
        y: clamp(to.y - ((from.y - v.y) * scale) / v.scale, 1 - scale, 0),
      };
    });
  }
  function toggle() {
    input.clear();
    setView(fit);
    setActive(!active());
  }
  const input = useInspectionPointers(active, change);
  let panel: HTMLDivElement | undefined;
  onSettled(() => {
    const element = panel;
    const key = (event: KeyboardEvent) => {
      if (active()) inspectKey(event, change, toggle);
    };
    element?.addEventListener('keydown', key);
    return () => element?.removeEventListener('keydown', key);
  });
  return (
    <div ref={panel}>
      <div
        ref={input.ref}
        class={styles['inspectSurface']}
        data-inspecting={String(active())}
        role="group"
        aria-label={t`Court inspection`}
        tabindex={-1}
      >
        <div
          class={styles['projection']}
          style={{
            transform: `translate(${view().x * 100}%, ${view().y * 100}%) scale(${view().scale})`,
          }}
        >
          {props.children}
        </div>
      </div>
      <div
        class={styles['inspectTools']}
        role="group"
        aria-label={t`Court view`}
        aria-describedby={helpId}
      >
        <VisuallyHidden
          id={helpId}
        >{t`Pinch or use plus and minus to zoom. Drag or use arrow keys to pan.`}</VisuallyHidden>
        <Show when={active()}>
          <Button
            title="−"
            aria-label={t`Zoom out`}
            size="sm"
            variant="outline"
            disabled={view().scale <= 1}
            onClick={() => change(center, center, 1 / 1.5)}
          />
          <Button
            title="+"
            aria-label={t`Zoom in`}
            size="sm"
            variant="outline"
            disabled={view().scale >= 3}
            onClick={() => change(center, center, 1.5)}
          />
        </Show>
        <Button
          title={active() ? t`Fit court` : t`Inspect court`}
          size="sm"
          variant="outline"
          aria-pressed={active()}
          onClick={toggle}
        />
      </div>
    </div>
  );
}
