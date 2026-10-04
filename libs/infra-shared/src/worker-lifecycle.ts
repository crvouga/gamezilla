import type { EnvFile } from './env-file';

export const ROOM_CLASS = 'RoomServerDurableObject';
export const ROOM_MIGRATION_TAG = 'v1-app-room';
export const ROOM_ARCHIVE_CLASS = 'RoomStorageArchive';
export const ROOM_ARCHIVE_TAG = 'v2-app-room-archive';
export const ROOM_TRANSFER_TAG = 'v3-app-room-transfer';

export type WorkerNamespace = {
  readonly id: string;
  readonly script: string;
  readonly class: string;
};

export type RoomMigration = {
  readonly tag: string;
  readonly new_sqlite_classes?: readonly string[];
  readonly renamed_classes?: readonly {
    readonly from: string;
    readonly to: string;
  }[];
  readonly transferred_classes?: readonly {
    readonly from: string;
    readonly from_script: string;
    readonly to: string;
  }[];
};

/** Transfer existing storage; never create an empty replacement for it. */
export function roomMigrations(
  env: EnvFile,
  namespaces: readonly WorkerNamespace[]
): readonly RoomMigration[] {
  const source = namespaces.find(
    (ns) =>
      ns.script === env.worker.transfer_rooms_from && ns.class === ROOM_CLASS
  );
  const target = namespaces.find(
    (ns) => ns.script === env.worker.name && ns.class === ROOM_CLASS
  );
  const archive = namespaces.find(
    (ns) => ns.script === env.worker.name && ns.class === ROOM_ARCHIVE_CLASS
  );
  const resolution = env.worker.room_namespace_resolution;
  const pinnedTarget =
    target !== undefined &&
    (target.id === resolution?.source_id ||
      target.id === resolution?.target_id);
  if (
    archive !== undefined ||
    pinnedTarget ||
    (resolution !== undefined && source?.id === resolution.source_id) ||
    (source && target && source.id !== target.id)
  ) {
    return resolvedRoomMigrations(env, source, target, archive);
  }
  if (target !== undefined) return [{ tag: ROOM_MIGRATION_TAG }];
  if (source !== undefined) {
    return [
      {
        tag: ROOM_MIGRATION_TAG,
        transferred_classes: [
          { from: ROOM_CLASS, from_script: source.script, to: ROOM_CLASS },
        ],
      },
    ];
  }
  if (
    env.protection === 'production' &&
    env.worker.transfer_rooms_from !== undefined
  ) {
    throw new Error(
      'Production room storage is missing: refusing to create a replacement'
    );
  }
  return [{ tag: ROOM_MIGRATION_TAG, new_sqlite_classes: [ROOM_CLASS] }];
}

/** Exact IDs authorize retention, never deletion or choosing an empty namespace. */
function resolvedRoomMigrations(
  env: EnvFile,
  source: WorkerNamespace | undefined,
  target: WorkerNamespace | undefined,
  archive: WorkerNamespace | undefined
): readonly RoomMigration[] {
  const resolution = env.worker.room_namespace_resolution;
  if (resolution === undefined) {
    throw new Error(
      'Both room namespaces exist: refusing to abandon either one'
    );
  }
  const fromScript = env.worker.transfer_rooms_from;
  const active = source ?? target;
  const retained = archive ?? target;
  if (
    fromScript === undefined ||
    resolution.source_id === resolution.target_id ||
    active?.id !== resolution.source_id ||
    retained?.id !== resolution.target_id ||
    (archive !== undefined && source !== undefined && target !== undefined)
  ) {
    throw new Error(
      'Room namespace resolution does not match the live namespace IDs'
    );
  }
  // Wrangler validates the entire history locally. Cloudflare applies only
  // steps after its committed tag, so retain history even after adoption.
  return [
    { tag: ROOM_MIGRATION_TAG, new_sqlite_classes: [ROOM_CLASS] },
    {
      tag: ROOM_ARCHIVE_TAG,
      renamed_classes: [{ from: ROOM_CLASS, to: ROOM_ARCHIVE_CLASS }],
    },
    {
      tag: ROOM_TRANSFER_TAG,
      transferred_classes: [
        { from: ROOM_CLASS, from_script: fromScript, to: ROOM_CLASS },
      ],
    },
  ];
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
  roomMigrations(env, before);
  const source = before.find(
    (ns) =>
      ns.class === ROOM_CLASS && ns.script === env.worker.transfer_rooms_from
  );
  const target = before.find(
    (ns) => ns.class === ROOM_CLASS && ns.script === env.worker.name
  );
  const current = after.find(
    (ns) => ns.class === ROOM_CLASS && ns.script === env.worker.name
  );
  const previous = source ?? target;
  if (current === undefined || (previous && current.id !== previous.id)) {
    throw new Error(
      'Room namespace was not preserved by the application deployment'
    );
  }
  for (const ns of before) {
    if (ns.script !== env.worker.name || ns.id === previous?.id) continue;
    if (
      !after.some(
        (item) => item.id === ns.id && item.script === env.worker.name
      )
    ) {
      throw new Error(
        'Retained room namespace was not preserved by the application deployment'
      );
    }
  }
  roomMigrations(env, after);
}

/** Retirement is allowed only after all domains and room storage have moved. */
export function assertWorkersRetirable(
  env: EnvFile,
  namespaces: readonly WorkerNamespace[],
  domains: readonly WorkerDomain[]
): void {
  roomMigrations(env, namespaces);
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
