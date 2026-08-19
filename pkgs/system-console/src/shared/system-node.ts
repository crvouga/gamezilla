/**
 * World-aligned node kinds for console chrome (playground + reports).
 * Addresses are `kind` or `kind:instanceId` (`client:alice`, `room:<topic>`).
 */

export const SYSTEM_NODE_KINDS = [
  'client',
  'api',
  'events',
  'room',
  'db',
] as const;

export type SystemNodeKind = (typeof SYSTEM_NODE_KINDS)[number];

/** Playground kind tabs (DB is a pane under API, not its own tab). */
export const SYSTEM_CHROME_KINDS = ['client', 'api', 'events', 'room'] as const;

export type SystemChromeKind = (typeof SYSTEM_CHROME_KINDS)[number];

export const SYSTEM_NODE_KIND_ALIASES: Readonly<
  Record<string, SystemNodeKind>
> = {
  server: 'api',
  pubsub: 'events',
  actor: 'room',
};

export const SYSTEM_NODE_LABELS: Readonly<Record<SystemNodeKind, string>> = {
  client: 'Client',
  api: 'API',
  events: 'Events',
  room: 'Room',
  db: 'DB',
};

const NODE_KIND_SET: ReadonlySet<string> = new Set(SYSTEM_NODE_KINDS);
const CHROME_KIND_SET: ReadonlySet<string> = new Set(SYSTEM_CHROME_KINDS);

export function coerceSystemNodeKind(
  raw: string | null | undefined
): SystemNodeKind | null {
  if (raw === null || raw === undefined) return null;
  const aliased = SYSTEM_NODE_KIND_ALIASES[raw] ?? raw;
  return NODE_KIND_SET.has(aliased) ? (aliased as SystemNodeKind) : null;
}

export function coerceSystemChromeKind(
  raw: string | null | undefined
): SystemChromeKind {
  const kind = coerceSystemNodeKind(raw);
  if (kind !== null && CHROME_KIND_SET.has(kind)) {
    return kind as SystemChromeKind;
  }
  return 'client';
}

export function parseSystemNodeAddress(id: string): {
  readonly kind: string;
  readonly instanceId: string | null;
} {
  const colon = id.indexOf(':');
  if (colon <= 0) {
    return { kind: coerceSystemNodeKind(id) ?? id, instanceId: null };
  }
  const prefix = id.slice(0, colon);
  const instanceId = id.slice(colon + 1);
  return {
    kind: coerceSystemNodeKind(prefix) ?? prefix,
    instanceId: instanceId.length > 0 ? instanceId : null,
  };
}

export function formatSystemNodeLabel(args: {
  readonly id: string;
  readonly kind?: string;
}): string {
  const fromId = parseSystemNodeAddress(args.id);
  if (fromId.instanceId !== null) return fromId.instanceId;
  const kind =
    coerceSystemNodeKind(args.kind) ?? coerceSystemNodeKind(fromId.kind);
  if (kind !== null) return SYSTEM_NODE_LABELS[kind];
  return args.id;
}

export type FallbackReportNode = {
  readonly id: string;
  readonly kind: SystemNodeKind;
  readonly attributes: readonly string[];
};

/** Topology stubs while `topology.json` is still loading. */
export function fallbackReportNodes(
  actorIds: readonly string[]
): readonly FallbackReportNode[] {
  const out: FallbackReportNode[] = [
    {
      id: 'api',
      kind: 'api',
      attributes: ['sqlite', 'ingress', 'egress'],
    },
    { id: 'events', kind: 'events', attributes: ['ingress', 'egress'] },
  ];
  for (const id of actorIds) {
    out.push({
      id,
      kind: 'client',
      attributes: ['html', 'sqlite', 'ingress', 'egress'],
    });
  }
  return out;
}
