import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';

import type { WorkloadAction } from '../../domain-packs/notes-app/workload-actions';

export type WorkloadModel = {
  readonly clientIds: string[];
  online: Set<string>;
  partitioned: Set<string>;
  held: Set<string>;
  crashed: Set<string>;
  mutations: number;
};

export type WorkloadReal = {
  readonly actions: WorkloadAction[];
};

const clientArb = fc.constantFrom('c0', 'c1', 'c2');

class MutateCmd implements AsyncCommand<WorkloadModel, WorkloadReal> {
  constructor(
    readonly clientId: string,
    readonly noteId: string,
    readonly body: string
  ) {}
  check(m: WorkloadModel): boolean {
    return m.online.has(this.clientId) && !m.crashed.has(this.clientId);
  }
  async run(m: WorkloadModel, r: WorkloadReal): Promise<void> {
    m.mutations += 1;
    r.actions.push({
      kind: 'mutate',
      clientId: this.clientId,
      noteId: this.noteId,
      body: this.body,
    });
  }
  toString(): string {
    return `mutate(${this.clientId},${this.noteId})`;
  }
}

class OfflineCmd implements AsyncCommand<WorkloadModel, WorkloadReal> {
  constructor(readonly clientId: string) {}
  check(m: WorkloadModel): boolean {
    return m.online.has(this.clientId) && !m.crashed.has(this.clientId);
  }
  async run(m: WorkloadModel, r: WorkloadReal): Promise<void> {
    m.online.delete(this.clientId);
    r.actions.push({ kind: 'offline', clientId: this.clientId });
  }
  toString(): string {
    return `offline(${this.clientId})`;
  }
}

class OnlineCmd implements AsyncCommand<WorkloadModel, WorkloadReal> {
  constructor(readonly clientId: string) {}
  check(m: WorkloadModel): boolean {
    return !m.online.has(this.clientId) && !m.crashed.has(this.clientId);
  }
  async run(m: WorkloadModel, r: WorkloadReal): Promise<void> {
    m.online.add(this.clientId);
    r.actions.push({ kind: 'online', clientId: this.clientId });
  }
  toString(): string {
    return `online(${this.clientId})`;
  }
}

class PartitionCmd implements AsyncCommand<WorkloadModel, WorkloadReal> {
  constructor(readonly nodeId: string) {}
  check(m: WorkloadModel): boolean {
    return !m.partitioned.has(this.nodeId);
  }
  async run(m: WorkloadModel, r: WorkloadReal): Promise<void> {
    m.partitioned.add(this.nodeId);
    r.actions.push({
      kind: 'partition',
      nodeId: this.nodeId,
      traffic: 'live',
    });
  }
  toString(): string {
    return `partition(${this.nodeId})`;
  }
}

class HealCmd implements AsyncCommand<WorkloadModel, WorkloadReal> {
  check(m: WorkloadModel): boolean {
    return m.partitioned.size > 0 || m.held.size > 0;
  }
  async run(m: WorkloadModel, r: WorkloadReal): Promise<void> {
    m.partitioned.clear();
    m.held.clear();
    r.actions.push({ kind: 'heal' });
  }
  toString(): string {
    return 'heal';
  }
}

class IdleCmd implements AsyncCommand<WorkloadModel, WorkloadReal> {
  constructor(readonly ms: number) {}
  check(_m: WorkloadModel): boolean {
    return true;
  }
  async run(_m: WorkloadModel, r: WorkloadReal): Promise<void> {
    r.actions.push({ kind: 'idle', ms: this.ms });
  }
  toString(): string {
    return `idle(${this.ms})`;
  }
}

export const workloadCommands = (
  maxCommands = 12
): fc.Arbitrary<Iterable<AsyncCommand<WorkloadModel, WorkloadReal>>> =>
  fc.commands(
    [
      fc
        .tuple(
          clientArb,
          fc.constantFrom('n0', 'n1', 'n2'),
          fc.string({ maxLength: 8 })
        )
        .map(([c, n, b]) => new MutateCmd(c, n, b)),
      clientArb.map((c) => new OfflineCmd(c)),
      clientArb.map((c) => new OnlineCmd(c)),
      clientArb.map((c) => new PartitionCmd(c)),
      fc.constant(new HealCmd()),
      fc.integer({ min: 1, max: 50 }).map((ms) => new IdleCmd(ms)),
    ],
    { maxCommands, size: 'small' }
  );

export function initialWorkloadModel(): WorkloadModel {
  const clientIds = ['c0', 'c1', 'c2'];
  return {
    clientIds,
    online: new Set(clientIds),
    partitioned: new Set(),
    held: new Set(),
    crashed: new Set(),
    mutations: 0,
  };
}
