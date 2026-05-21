import type { CommandId, RegisteredCommand } from './types';

export type CommandRegistryListener = () => void;

type Stored = {
  command: RegisteredCommand;
  /** Unique per `<RegisterCommand />` mount — unmount removes only its own registration. */
  registrationId: string;
};

/**
 * In-memory command map with subscribe semantics for the registry provider.
 */
export class CommandRegistryStore {
  private readonly commands = new Map<CommandId, Stored>();
  private readonly listeners = new Set<CommandRegistryListener>();
  private version = 0;

  subscribe(fn: CommandRegistryListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.version += 1;
    for (const fn of this.listeners) {
      fn();
    }
  }

  getVersion(): number {
    return this.version;
  }

  upsert(command: RegisteredCommand, registrationId: string): void {
    const prev = this.commands.get(command.id);
    if (prev !== undefined && prev.registrationId !== registrationId) {
      // Another component still holds this id — last writer wins.
      console.warn(
        `[CommandRegistry] Duplicate command id "${command.id}" — last registration wins.`
      );
    }
    this.commands.set(command.id, { command, registrationId });
    this.emit();
  }

  remove(id: CommandId, registrationId: string): void {
    const cur = this.commands.get(id);
    if (cur !== undefined && cur.registrationId === registrationId) {
      this.commands.delete(id);
      this.emit();
    }
  }

  get(id: CommandId): RegisteredCommand | undefined {
    return this.commands.get(id)?.command;
  }

  getAll(): RegisteredCommand[] {
    return [...this.commands.values()].map((s) => s.command);
  }
}
