import type { Resource } from 'solid-js';

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
