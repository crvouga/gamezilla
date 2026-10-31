/** @jsxImportSource solid-js */
/**
 * Command registration: `useRegisterCommands(() => [...])` keeps a reactive
 * list of commands registered while the owner lives; `RegisterCommand` is
 * the declarative single-command form.
 */

import {
  type Accessor,
  createEffect,
  createUniqueId,
  type JSX,
  onCleanup,
} from 'solid-js';
import { useCommandRegistry } from '../command-registry-context/index';
import type { Command, RegisteredCommand } from '../types';

export type RegisterCommandProps = Command;

function toRegistered(cmd: Command, version: number): RegisteredCommand {
  return { ...cmd, _version: version };
}

/**
 * Register every command returned by `commands()`; re-registers when the
 * accessor changes and removes commands that disappear. Unregisters all on
 * cleanup.
 */
export function useRegisterCommands(
  commands: Accessor<readonly Command[]>
): void {
  const { store } = useCommandRegistry();
  const registrationId = `reg-${createUniqueId()}`;
  let version = 0;
  let registeredIds = new Set<string>();

  createEffect(() => {
    const next = commands();
    version += 1;
    const nextIds = new Set<string>();
    for (const cmd of next) {
      store.upsert(toRegistered(cmd, version), registrationId);
      nextIds.add(cmd.id);
    }
    for (const id of registeredIds) {
      if (!nextIds.has(id)) store.remove(id, registrationId);
    }
    registeredIds = nextIds;
  });

  onCleanup(() => {
    for (const id of registeredIds) store.remove(id, registrationId);
  });
}

/** Declaratively registers one command while mounted. Renders nothing. */
export function RegisterCommand(props: RegisterCommandProps): JSX.Element {
  useRegisterCommands(() => [props]);
  return null;
}
