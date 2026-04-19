import { useEffect, useId } from 'react';

import { useCommandRegistry } from './command-registry-context';
import type { Command, RegisteredCommand } from './types';

export type RegisterCommandProps = Command;

/**
 * Declaratively registers a command while mounted. Unregisters on unmount.
 */
export function RegisterCommand(props: RegisterCommandProps) {
  const { store } = useCommandRegistry();
  const registrationId = useId();

  const {
    id,
    title,
    subtitle,
    category,
    icon,
    keywords,
    shortcut,
    enabled,
    visible,
    run,
  } = props;

  useEffect(() => {
    const cmd: RegisteredCommand = {
      id,
      title,
      ...(subtitle !== undefined ? { subtitle } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(keywords !== undefined ? { keywords } : {}),
      ...(shortcut !== undefined ? { shortcut } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(visible !== undefined ? { visible } : {}),
      run,
      _version: 0,
    };
    store.upsert(cmd, registrationId);
    return () => {
      store.remove(id, registrationId);
    };
  }, [
    store,
    registrationId,
    id,
    title,
    subtitle,
    category,
    icon,
    keywords,
    shortcut,
    enabled,
    visible,
    run,
  ]);

  return null;
}
