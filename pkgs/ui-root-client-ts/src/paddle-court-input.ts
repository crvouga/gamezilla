import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

import { createRenderEffect, createSignal, onSettled, untrack } from 'solid-js';

export type CourtSide = 'first' | 'second';
export type CourtControls = {
  readonly controlled: readonly CourtSide[];
  readonly enabled: boolean;
  readonly onDirection: (side: CourtSide, direction: -1 | 0 | 1) => void;
  readonly onTarget: (side: CourtSide, target: number) => void;
  readonly onRelease: () => void;
};

/** Raw device events end here; consumers receive normalized directions and court fractions. */
export function paddleCourtInput(props: CourtControls) {
  const pointers = new Map<number, CourtSide>();
  const [held, setHeld] = createSignal<readonly CourtSide[]>([]);
  const keyboard = paddleCourtKeyboard(props);
  const target = (
    event: PointerEvent,
    element: HTMLElement,
    side: CourtSide
  ) => {
    const rect = element.getBoundingClientRect();
    if (rect.height > 0)
      props.onTarget(
        side,
        Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      );
  };
  const release = (sides: readonly CourtSide[] = props.controlled) => {
    for (const side of sides) props.onDirection(side, 0);
    pointers.clear();
    setHeld([]);
    keyboard.release();
    props.onRelease();
  };

  return {
    held,
    keyDown: (event: KeyboardEvent) => keyboard.key(event, true),
    keyUp: (event: KeyboardEvent) => keyboard.key(event, false),
    release,
    pointerDown: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
      if (
        !props.enabled ||
        props.controlled.length === 0 ||
        (event.pointerType === 'mouse' && event.button !== 0)
      )
        return;
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      const side =
        props.controlled.length === 1
          ? (props.controlled[0] ?? 'first')
          : event.clientX - rect.left < rect.width / 2
            ? 'first'
            : 'second';
      if ([...pointers.values()].includes(side)) return;
      pointers.set(event.pointerId, side);
      setHeld([...pointers.values()]);
      element.setPointerCapture(event.pointerId);
      element.focus();
      target(event, element, side);
    },
    pointerMove: (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
      const side = pointers.get(event.pointerId);
      if (side !== undefined && props.enabled)
        target(event, event.currentTarget, side);
    },
    pointerUp: (event: PointerEvent) => {
      const side = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (side !== undefined) {
        setHeld([...pointers.values()]);
        props.onDirection(side, 0);
      }
    },
  };
}

function paddleCourtKeyboard(props: CourtControls) {
  const pressed = new Set<string>();
  const key = (event: KeyboardEvent, down: boolean) => {
    if (
      !props.enabled ||
      event.target !== event.currentTarget ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const name = event.key.toLowerCase();
    const side = keySide(name, props.controlled);
    if (side === undefined || !props.controlled.includes(side)) return;
    event.preventDefault();
    if (down) pressed.add(name);
    else pressed.delete(name);
    const arrows = side === 'second' || props.controlled.length === 1;
    const above =
      (side === 'first' && pressed.has('w')) ||
      (arrows && pressed.has('arrowup'));
    const below =
      (side === 'first' && pressed.has('s')) ||
      (arrows && pressed.has('arrowdown'));
    props.onDirection(side, above === below ? 0 : above ? -1 : 1);
  };
  return { key, release: () => pressed.clear() };
}

function keySide(
  name: string,
  controlled: readonly CourtSide[]
): CourtSide | undefined {
  if (name === 'w' || name === 's') return 'first';
  if (name === 'arrowup' || name === 'arrowdown')
    return controlled.length === 1 ? controlled[0] : 'second';
  return undefined;
}

type PaddleActions = Pick<
  CourtControls,
  'controlled' | 'enabled' | 'onDirection' | 'onTarget'
>;

function requirePaddle(options: PaddleActions, side: unknown): CourtSide {
  if (
    !options.enabled ||
    (side !== 'first' && side !== 'second') ||
    !options.controlled.includes(side)
  )
    throw new Error('Choose a paddle controlled by this device.');
  return side;
}

const courtState = (options: PaddleActions) => ({
  disabled: !options.enabled || options.controlled.length === 0,
});

const court = definePrimitive({
  name: 'paddle-court',
  options: {
    controlled: 'value',
    enabled: 'boolean',
    onDirection: 'callback',
    onTarget: 'callback',
  },
  state: courtState,
  sync: courtState,
  api: (context) => ({
    paddles: () =>
      context
        .options()
        .controlled.map((side) => ({ value: side, label: side })),
    moveUp(side: unknown) {
      const options = context.options();
      options.onDirection(requirePaddle(options, side), -1);
    },
    moveDown(side: unknown) {
      const options = context.options();
      options.onDirection(requirePaddle(options, side), 1);
    },
    stop(side: unknown) {
      const options = context.options();
      options.onDirection(requirePaddle(options, side), 0);
    },
    setTargetFraction(side: unknown, fraction: unknown) {
      const options = context.options();
      if (
        typeof fraction !== 'number' ||
        !Number.isFinite(fraction) ||
        fraction < 0 ||
        fraction > 1
      )
        throw new Error('Choose a position from 0 (top) to 1 (bottom).');
      options.onTarget(requirePaddle(options, side), fraction);
    },
  }),
  agent: {
    actions: ['moveUp', 'moveDown', 'stop', 'setTargetFraction'],
    items: (api) => api.paddles(),
  },
  slots: (slot) => ({ root: slot({}) }),
});

export const { Root: CourtSurface } = createParts(court, { root: 'div' });

const PADDLE_KEYS = new Set(['arrowup', 'arrowdown', 'w', 's']);

/** An interruption ends held input; returning always requires a fresh action. */
export function useCourtInputLifecycle(
  props: CourtControls,
  release: (sides?: readonly CourtSide[]) => void,
  court: () => HTMLElement | undefined
): void {
  createRenderEffect(
    () => ({ enabled: props.enabled, sides: [...props.controlled] }),
    (next, previous) => {
      if (
        previous?.enabled === true &&
        (!next.enabled || previous.sides.join() !== next.sides.join())
      )
        // The host's handlers are called, not followed.
        untrack(() => release(previous.sides));
    }
  );
  onSettled(() => {
    const blur = () => release();
    const visibility = () => {
      if (document.visibilityState === 'hidden') release();
    };
    // A paddle key pressed while nothing has focus goes to the court, so
    // play starts without first tabbing to it. Focus anywhere else (a
    // field, a dialog, a button) keeps its keys.
    const enter = (event: KeyboardEvent) => {
      const target = court();
      const name = event.key.toLowerCase();
      if (
        target === undefined ||
        !props.enabled ||
        props.controlled.length === 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        // Only keys aimed at nothing in particular: the page itself.
        (event.target !== document.body &&
          event.target !== document.documentElement) ||
        !PADDLE_KEYS.has(name) ||
        // W and S move only the left paddle.
        ((name === 'w' || name === 's') && !props.controlled.includes('first'))
      )
        return;
      event.preventDefault();
      target.focus();
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: event.key, bubbles: true })
      );
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', enter);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', enter);
    };
  });
}
