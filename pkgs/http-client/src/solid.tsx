/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import type { Accessor, JSX, ParentProps } from 'solid-js';

import {
  createAlwaysAvailableOrigin,
  type OriginAvailability,
  type OriginAvailabilitySnapshot,
} from './origin-availability';
import type { HttpClient } from './types';

const HttpClientContext = defineContext<HttpClient>('HttpClient');

export type HttpClientProviderProps = ParentProps<{
  readonly value: HttpClient;
}>;

/** Injects the app {@link HttpClient} (wall or sim) for the Solid tree. */
export const HttpClientProvider: (
  props: HttpClientProviderProps
) => JSX.Element = HttpClientContext.Provider;

export function useHttpClient(): HttpClient {
  return HttpClientContext.use();
}

const OriginAvailabilityContext =
  defineContext<OriginAvailability>('OriginAvailability');

const alwaysAvailable = createAlwaysAvailableOrigin();

export type OriginAvailabilityProviderProps = ParentProps<{
  readonly value: OriginAvailability;
}>;

export const OriginAvailabilityProvider: (
  props: OriginAvailabilityProviderProps
) => JSX.Element = OriginAvailabilityContext.Provider;

export function useOptionalOriginAvailability():
  | OriginAvailability
  | undefined {
  return OriginAvailabilityContext.useOptional();
}

export function useOriginAvailability(): OriginAvailability {
  return OriginAvailabilityContext.use();
}

/**
 * Reactive origin availability snapshot. Falls back to an always-available
 * origin when no provider is mounted (isolated previews / tests).
 */
export function createOriginAvailabilitySnapshot(): Accessor<OriginAvailabilitySnapshot> {
  const availability =
    OriginAvailabilityContext.useOptional() ?? alwaysAvailable;
  return createSubscriptionSignal(availability);
}
