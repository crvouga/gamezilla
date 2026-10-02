import type { EnvFile } from './env-file';

export const ROOM_CLASS = 'RoomServerDurableObject';
export const ROOM_MIGRATION_TAG = 'v1-app-room';

export type WorkerNamespace = {
  readonly id: string;
  readonly script: string;
  readonly class: string;
};

export type RoomMigration = {
  readonly tag: string;
  readonly new_sqlite_classes?: readonly string[];
  readonly transferred_classes?: readonly {
    readonly from: string;
    readonly from_script: string;
    readonly to: string;
  }[];
};

/** Transfer existing storage; never create an empty replacement for it. */
export function roomMigration(
  env: EnvFile,
  namespaces: readonly WorkerNamespace[]
): RoomMigration {
  const source = namespaces.find(
    (ns) =>
      ns.script === env.worker.transfer_rooms_from && ns.class === ROOM_CLASS
  );
  const target = namespaces.find(
    (ns) => ns.script === env.worker.name && ns.class === ROOM_CLASS
  );
  if (source !== undefined && target !== undefined && source.id !== target.id) {
    throw new Error(
      'Both room namespaces exist: refusing to abandon either one'
    );
  }
  if (target !== undefined) return { tag: ROOM_MIGRATION_TAG };
  if (source !== undefined) {
    return {
      tag: ROOM_MIGRATION_TAG,
      transferred_classes: [
        { from: ROOM_CLASS, from_script: source.script, to: ROOM_CLASS },
      ],
    };
  }
  if (
    env.protection === 'production' &&
    env.worker.transfer_rooms_from !== undefined
  ) {
    throw new Error(
      'Production room storage is missing: refusing to create a replacement'
    );
  }
  return { tag: ROOM_MIGRATION_TAG, new_sqlite_classes: [ROOM_CLASS] };
}

export type WorkerDomain = {
  readonly hostname: string;
  readonly service: string;
};

/** Adoption must preserve the provider's namespace ID, including after resume. */
export function assertRoomNamespacePreserved(
  env: EnvFile,
  before: readonly WorkerNamespace[],
  after: readonly WorkerNamespace[]
): void {
  const previous = before.find(
    (ns) =>
      ns.class === ROOM_CLASS &&
      (ns.script === env.worker.name ||
        ns.script === env.worker.transfer_rooms_from)
  );
  const current = after.find(
    (ns) => ns.class === ROOM_CLASS && ns.script === env.worker.name
  );
  if (
    current === undefined ||
    (previous !== undefined && current.id !== previous.id)
  ) {
    throw new Error(
      'Room namespace was not preserved by the application deployment'
    );
  }
}

/** Retirement is allowed only after all domains and room storage have moved. */
export function assertWorkersRetirable(
  env: EnvFile,
  namespaces: readonly WorkerNamespace[],
  domains: readonly WorkerDomain[]
): void {
  if (env.worker.retire.includes(env.worker.name)) {
    throw new Error('Cannot retire the application Worker');
  }
  const room = namespaces.find(
    (ns) => ns.script === env.worker.name && ns.class === ROOM_CLASS
  );
  if (room === undefined)
    throw new Error('Application room namespace is missing');
  for (const ns of namespaces) {
    if (env.worker.retire.includes(ns.script)) {
      throw new Error(
        `Cannot retire ${ns.script}: it still owns namespace ${ns.id}`
      );
    }
  }
  for (const hostname of [env.hosts.api, env.hosts.web, env.hosts.apex]) {
    if (
      !domains.some(
        (d) => d.hostname === hostname && d.service === env.worker.name
      )
    ) {
      throw new Error(`Cannot retire Workers: ${hostname} has not moved`);
    }
  }
  for (const domain of domains) {
    if (env.worker.retire.includes(domain.service)) {
      throw new Error(
        `Cannot retire ${domain.service}: it still serves ${domain.hostname}`
      );
    }
  }
}
