import { useId, useLayoutEffect } from 'react';

import { useStatusBarRegistry } from './status-bar-registry-context';
import type { RegisteredStatusBarItem, StatusBarItem } from './types';

export type RegisterStatusBarItemProps = StatusBarItem;

/**
 * Declaratively registers a status-bar item while mounted. Unregisters on
 * unmount. Features call this to invert dependency — the bar does not import
 * feature UI; features push their indicator + panel into the registry.
 *
 * Uses `useLayoutEffect` so sibling hosts that subscribe in layout (or flush
 * after subscribe) see items before paint — plain `useEffect` races and leaves
 * the strip empty on first mount.
 */
export function RegisterStatusBarItem(props: RegisterStatusBarItemProps) {
  const { store } = useStatusBarRegistry();
  const registrationId = useId();

  const {
    id,
    order,
    indicator,
    accessibilityLabel,
    title,
    caption,
    leading,
    panel,
    visible,
  } = props;

  useLayoutEffect(() => {
    const item: RegisteredStatusBarItem = {
      id,
      ...(order !== undefined ? { order } : {}),
      indicator,
      ...(accessibilityLabel !== undefined ? { accessibilityLabel } : {}),
      title,
      ...(caption !== undefined ? { caption } : {}),
      ...(leading !== undefined ? { leading } : {}),
      panel,
      ...(visible !== undefined ? { visible } : {}),
      _version: 0,
    };
    store.upsert(item, registrationId);
    return () => {
      store.remove(id, registrationId);
    };
  }, [
    store,
    registrationId,
    id,
    order,
    indicator,
    accessibilityLabel,
    title,
    caption,
    leading,
    panel,
    visible,
  ]);

  return null;
}
