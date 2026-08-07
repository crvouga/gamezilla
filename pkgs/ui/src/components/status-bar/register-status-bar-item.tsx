import { useId, useLayoutEffect, useRef } from 'react';

import { useStatusBarRegistry } from './status-bar-registry-context';
import type { RegisteredStatusBarItem, StatusBarItem } from './types';

export type RegisterStatusBarItemProps = StatusBarItem & {
  /**
   * Stable key for indicator/panel visuals. Bump when the strip glyph must
   * refresh. Do not depend on fresh ReactNode identities — that loops with
   * provider state updates.
   */
  contentKey?: string | number | boolean | null;
};

function toRegisteredItem(
  props: RegisterStatusBarItemProps
): RegisteredStatusBarItem {
  return {
    id: props.id,
    ...(props.order !== undefined ? { order: props.order } : {}),
    indicator: props.indicator,
    ...(props.accessibilityLabel !== undefined
      ? { accessibilityLabel: props.accessibilityLabel }
      : {}),
    title: props.title,
    ...(props.caption !== undefined ? { caption: props.caption } : {}),
    ...(props.leading !== undefined ? { leading: props.leading } : {}),
    panel: props.panel,
    ...(props.visible !== undefined ? { visible: props.visible } : {}),
    _version: 0,
  };
}

/**
 * Declaratively registers a status-bar item while mounted. Unregisters on
 * unmount. Re-upserts only when membership / `contentKey` changes.
 */
export function RegisterStatusBarItem(props: RegisterStatusBarItemProps) {
  const { upsert, remove } = useStatusBarRegistry();
  const registrationId = useId();
  const propsRef = useRef(props);
  propsRef.current = props;
  const { id, order, visible, contentKey } = props;

  useLayoutEffect(() => {
    const item = toRegisteredItem(propsRef.current);
    upsert(item, registrationId);
    return () => {
      remove(id, registrationId);
    };
  }, [upsert, remove, registrationId, id, order, visible, contentKey]);

  return null;
}
