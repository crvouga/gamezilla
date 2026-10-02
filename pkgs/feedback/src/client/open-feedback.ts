export const FEEDBACK_OPEN_EVENT = 'feedback:open';
/** A tiny shell bridge; reporting owns its own runtime and UI. */
export function requestFeedback(target: EventTarget = document): void {
  target.dispatchEvent(new Event(FEEDBACK_OPEN_EVENT));
}
