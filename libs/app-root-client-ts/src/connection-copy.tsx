/** @jsxImportSource solid-js */
/**
 * What the shell says about the connection, per {@link ConnectionCause}.
 * One place so the header notice and Connection in Settings agree.
 */

import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { useLingui } from '@lingui/solid/macro';
import { createOriginAvailabilitySnapshot } from '@pkgs/http-client-client-ts/solid';
import type { Accessor } from 'solid-js';
import {
  type ConnectionCause,
  resolveConnectionCause,
} from './connection-cause';
import { useOfflinePreference } from './offline-preference';
import { createNetworkOnline } from './use-connectivity';

/** Live cause from the device, the work-offline choice and the product's reachability. */
export function createConnectionCause(
  syncLive: Accessor<boolean> = () => false
): Accessor<ConnectionCause> {
  const online = createNetworkOnline();
  const origin = createOriginAvailabilitySnapshot();
  const { offline } = useOfflinePreference();
  return () =>
    resolveConnectionCause({
      workingOffline: offline(),
      deviceOnline: online(),
      origin: origin().phase,
      syncLive: syncLive(),
    });
}

/** The header notice's words for a missing connection. */
export function useConnectionNoticeLabel(): (cause: ConnectionCause) => string {
  const { t } = useLingui();
  const productName = PRODUCT_NAME;
  return (cause) => {
    if (cause === 'workingOffline')
      return t`You’re working offline. What you do is kept on this device and shared when you work online again.`;
    if (cause === 'deviceOffline')
      return t`You’re offline. What you do is kept on this device and shared when you’re back online.`;
    return t`${productName} can’t be reached right now. This isn’t something you did. What you do here is kept on this device and shared when ${productName} is back.`;
  };
}

/** Connection in Settings: the status in a few words. */
export function useConnectionStatusLabel(): (cause: ConnectionCause) => string {
  const { t } = useLingui();
  const productName = PRODUCT_NAME;
  return (cause) => {
    if (cause === 'connected') return t`Connected`;
    if (cause === 'checking') return t`Checking…`;
    if (cause === 'workingOffline') return t`Working offline`;
    if (cause === 'deviceOffline') return t`This device is offline`;
    return t`Can’t reach ${productName}`;
  };
}

/** Connection in Settings: what the status means and what happens next. */
export function useConnectionExplanation(): (cause: ConnectionCause) => string {
  const { t } = useLingui();
  const productName = PRODUCT_NAME;
  return (cause) => {
    if (cause === 'connected')
      return t`${productName} can be reached. What you do is shared with everyone else.`;
    if (cause === 'checking')
      return t`Checking whether ${productName} can be reached.`;
    if (cause === 'workingOffline')
      return t`You chose to work offline. Turn off Work offline in Settings to share what you do.`;
    if (cause === 'deviceOffline')
      return t`This device has no internet connection. Check Wi-Fi or mobile data. The app keeps trying on its own.`;
    return t`This device is online, but ${productName} can’t be reached right now. This isn’t something you did. The app keeps trying on its own.`;
  };
}
