/**
 * The toast stack as data: at most {@link TOAST_MAX_VISIBLE} entries, newest
 * last, the oldest pushed out when a new one arrives. Framework-free.
 */

/** How many toasts are on screen at once. */
export const TOAST_MAX_VISIBLE = 3;

/** How long a toast stays when the caller does not say. */
export const TOAST_DEFAULT_DURATION_MS = 4000;

/** How long a toast takes to leave before it is removed. */
export const TOAST_EXIT_MS = 200;

type Keyed = { readonly id: string };

/**
 * `entries` with `next` appended (replacing an entry with the same id in
 * place), trimmed to the newest `max`.
 */
export function enqueueToast<T extends Keyed>(
  entries: readonly T[],
  next: T,
  max: number = TOAST_MAX_VISIBLE
): readonly T[] {
  const existing = entries.findIndex((entry) => entry.id === next.id);
  if (existing >= 0) {
    return entries.map((entry, index) => (index === existing ? next : entry));
  }
  const appended = [...entries, next];
  return appended.slice(Math.max(0, appended.length - max));
}

/** `entries` without the toast `id`. */
export function removeToast<T extends Keyed>(
  entries: readonly T[],
  id: string
): readonly T[] {
  return entries.filter((entry) => entry.id !== id);
}
