import {
  type Accessor,
  createEffect,
  createSignal,
  type Resource,
} from 'solid-js';

/**
 * The resource's value without suspending: these screens draw their own
 * loading and error states, so a read never hands the route's loading
 * boundary a refetch (which would swap the whole screen for a spinner on
 * every live update).
 */
export function resourceValue<T>(resource: Resource<T>): T | undefined {
  return resource.state === 'ready' || resource.state === 'refreshing'
    ? resource.latest
    : undefined;
}

/**
 * The resource's value, or the last one it read when a reread fails: without
 * a connection, what was last read stays in view (the shell says the app
 * can't be reached) instead of being swapped for an error.
 */
export function lastKnownValue<T>(
  resource: Resource<T>
): Accessor<T | undefined> {
  const [last, setLast] = createSignal<T>();
  createEffect(() => {
    const value = resourceValue(resource);
    if (value !== undefined) setLast(() => value);
  });
  return () => resourceValue(resource) ?? last();
}
