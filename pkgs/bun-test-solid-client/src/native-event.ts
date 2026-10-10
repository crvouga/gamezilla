/**
 * Bun test workers keep their own `dispatchEvent` so the parent channel stays
 * connected, while happy-dom replaces `Event`. Window dispatch needs the
 * constructor from before that replacement. Element dispatch keeps happy-dom's.
 */
let saved: typeof Event | undefined;

/** Remember the pre-registration constructor. `undefined` clears it. */
export function rememberNativeEvent(
  ctor: typeof Event | undefined
): typeof Event | undefined {
  const previous = saved;
  saved = ctor;
  return previous;
}

/** The constructor `view.dispatchEvent` will accept. */
export function eventConstructor(view: Pick<Window, 'Event'>): typeof Event {
  return saved ?? view.Event;
}
