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
  const release = () => {
    for (const side of props.controlled) props.onDirection(side, 0);
    pointers.clear();
    keyboard.release();
    props.onRelease();
  };

  return {
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
      pointers.set(event.pointerId, side);
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
      if (side !== undefined) props.onDirection(side, 0);
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
