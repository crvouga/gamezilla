import { t } from '@lingui/core/macro';
import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';
import { createEffect, onCleanup, untrack } from 'solid-js';
import { Button } from './button/index';
import styles from './trail-arena/trail-arena.module.css';
import {
  type ArenaCamera,
  FIT,
  inspectionCamera,
} from './trail-arena-geometry';
import type {
  TrailControls,
  TrailHeading,
  TrailSlot,
} from './trail-arena-types';

const ARROWS: Readonly<Record<string, TrailHeading>> = {
  arrowup: 'up',
  arrowright: 'right',
  arrowdown: 'down',
  arrowleft: 'left',
};

/** By character first, then by key position, so ZQSD layouts steer too. */
const LETTERS: Readonly<Record<string, TrailHeading>> = {
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left',
  keyw: 'up',
  keyd: 'right',
  keys: 'down',
  keya: 'left',
};

/** Pixels a touch travels before it counts as a swipe. */
const SWIPE_DISTANCE = 24;

/** How many local riders this device steers: none, one or two. */
export function controlledSlots(controls: TrailControls): number {
  let count = 0;
  for (const rider of controls.riders) if (rider.controlSlot !== null) count++;
  return Math.min(count, 2);
}

function keyIntent(
  event: KeyboardEvent,
  slots: number
): { heading: TrailHeading; slot: TrailSlot } | undefined {
  const name = event.key.toLowerCase();
  const arrow = ARROWS[name];
  if (arrow !== undefined) return { heading: arrow, slot: 0 };
  const letter = LETTERS[name] ?? LETTERS[event.code.toLowerCase()];
  if (letter === undefined) return undefined;
  return { heading: letter, slot: slots >= 2 ? 1 : 0 };
}

function swipeHeading(dx: number, dy: number): TrailHeading | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return undefined;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

type Swipe = { slot: TrailSlot; x: number; y: number };

/**
 * Raw device events end here; consumers receive a heading and the local
 * rider slot it steers. Arrow keys steer slot 0; WASD steers slot 1 when
 * two riders share the keyboard, and slot 0 otherwise. A swipe steers the
 * rider on its side of the arena: the WASD rider on the left half when two
 * share the screen.
 */
export function trailArenaInput(props: TrailControls) {
  const swipes = new Map<number, Swipe>();
  // A held finger belongs to the control session in which it began. A
  // reconnect, round break or ownership change requires a fresh gesture.
  let previousSession = '';
  createEffect(
    () =>
      `${props.enabled}:${props.riders
        .filter((rider) => rider.controlSlot !== null)
        .map((rider) => `${rider.index}:${rider.controlSlot}`)
        .join(',')}`,
    (session) => {
      if (session !== previousSession) swipes.clear();
      previousSession = session;
    }
  );
  const keyDown = (event: KeyboardEvent) => {
    const slots = controlledSlots(props);
    if (
      !props.enabled ||
      slots === 0 ||
      event.target !== event.currentTarget ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const intent = keyIntent(event, slots);
    if (intent === undefined) return;
    event.preventDefault();
    if (!event.repeat) props.onDirection(intent.heading, intent.slot);
  };
  const pointerDown = (
    event: PointerEvent & { currentTarget: HTMLDivElement }
  ) => {
    const slots = controlledSlots(props);
    if (
      !props.enabled ||
      slots === 0 ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const left = event.clientX - rect.left < rect.width / 2;
    swipes.set(event.pointerId, {
      slot: slots >= 2 && left ? 1 : 0,
      x: event.clientX,
      y: event.clientY,
    });
    element.setPointerCapture(event.pointerId);
    element.focus();
  };
  const pointerMove = (event: PointerEvent) => {
    const swipe = swipes.get(event.pointerId);
    if (swipe === undefined || !props.enabled) return;
    const heading = swipeHeading(
      event.clientX - swipe.x,
      event.clientY - swipe.y
    );
    if (heading === undefined) return;
    swipe.x = event.clientX;
    swipe.y = event.clientY;
    props.onDirection(heading, swipe.slot);
  };
  const pointerUp = (event: PointerEvent) => {
    swipes.delete(event.pointerId);
  };
  return { keyDown, pointerDown, pointerMove, pointerUp };
}

function steeringChoices(options: TrailControls) {
  return options.riders.flatMap((rider) => {
    const slot = rider.controlSlot;
    if (slot === null || !rider.alive || !options.enabled) return [];
    return Object.values(ARROWS).map((heading) => ({
      value: `${rider.index}-${heading}`,
      label: `${rider.label} ${heading}`,
      heading,
      slot,
    }));
  });
}

const arenaState = (options: TrailControls) => ({
  disabled:
    !options.enabled ||
    !options.riders.some((rider) => rider.controlSlot !== null && rider.alive),
});

const arena = definePrimitive({
  name: 'trail-arena',
  options: { riders: 'value', enabled: 'boolean', onDirection: 'callback' },
  state: arenaState,
  sync: arenaState,
  api: (context) => ({
    choices: () => steeringChoices(context.options()),
    steer(choice: unknown) {
      const options = context.options();
      const turn = steeringChoices(options).find(
        ({ value, label }) => choice === value || choice === label
      );
      if (!turn) throw new Error('Choose an available rider and direction.');
      options.onDirection(turn.heading, turn.slot);
    },
  }),
  agent: { actions: ['steer'], items: (api) => api.choices(), closed: true },
  slots: (slot) => ({ root: slot({}) }),
});

export const { Root: ArenaSurface } = createParts(arena, { root: 'div' });

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
        class={styles['inspectionViewport']}
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
      <div class={styles['inspectionTools']}>
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
