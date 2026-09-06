/**
 * Framework-free command registry with `getSnapshot` / `subscribe`
 * semantics (bridge into Solid with `createSubscriptionSignal`).
 *
 * Each registration is stamped with a `registrationId` so a component that
 * unmounts removes only its own entry; a later registration of the same id
 * wins (last writer) while the earlier owner is still mounted.
 */

import type { CommandId, RegisteredCommand } from './types';

export type CommandRegistryListener = () => void;

export type CommandRegistrySnapshot = readonly RegisteredCommand[];

type Stored = {
  command: RegisteredCommand;
  registrationId: string;
};

export class CommandRegistryStore {
  private readonly commands = new Map<CommandId, Stored>();
  private readonly listeners = new Set<CommandRegistryListener>();
  private version = 0;
  private snapshot: CommandRegistrySnapshot = [];

  subscribe(fn: CommandRegistryListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Stable array reference until the next mutation. */
  getSnapshot(): CommandRegistrySnapshot {
    return this.snapshot;
  }

  getVersion(): number {
    return this.version;
  }

  upsert(command: RegisteredCommand, registrationId: string): void {
    this.commands.set(command.id, { command, registrationId });
    this.emit();
  }

  remove(id: CommandId, registrationId: string): void {
    const current = this.commands.get(id);
    if (current?.registrationId === registrationId) {
      this.commands.delete(id);
      this.emit();
    }
  }

  get(id: CommandId): RegisteredCommand | undefined {
    return this.commands.get(id)?.command;
  }

  getAll(): RegisteredCommand[] {
    return [...this.snapshot];
  }

  private emit(): void {
    this.version += 1;
    this.snapshot = [...this.commands.values()].map((s) => s.command);
    for (const fn of this.listeners) {
      fn();
    }
  }
}

/** Convenience factory for tests and composition roots. */
export function createCommandRegistryStore(): CommandRegistryStore {
  return new CommandRegistryStore();
}
