/**
 * World-aligned node kinds for console chrome (playground + reports).
 * Addresses are `kind` or `kind:instanceId` (`client:alice`, `room:<topic>`).
 */

export const SIM_NODE_KINDS = [
  'client',
  'api',
  'events',
  'room',
  'db',
] as const;

export type SimNodeKind = (typeof SIM_NODE_KINDS)[number];

/** Playground kind tabs (DB is a pane under API, not its own tab). */
export const SIM_CHROME_KINDS = ['client', 'api', 'events', 'room'] as const;

export type SimChromeKind = (typeof SIM_CHROME_KINDS)[number];

export const SIM_NODE_KIND_ALIASES: Readonly<Record<string, SimNodeKind>> = {
  server: 'api',
  pubsub: 'events',
  actor: 'room',
};

export const SIM_NODE_LABELS: Readonly<Record<SimNodeKind, string>> = {
  client: 'Client',
  api: 'API',
  events: 'Events',
  room: 'Room server',
  db: 'DB',
};

const NODE_KIND_SET: ReadonlySet<string> = new Set(SIM_NODE_KINDS);
const CHROME_KIND_SET: ReadonlySet<string> = new Set(SIM_CHROME_KINDS);

export function coerceSimNodeKind(
  raw: string | null | undefined
): SimNodeKind | null {
  if (raw === null || raw === undefined) return null;
  const aliased = SIM_NODE_KIND_ALIASES[raw] ?? raw;
  return NODE_KIND_SET.has(aliased) ? (aliased as SimNodeKind) : null;
}

export function coerceSimChromeKind(
  raw: string | null | undefined
): SimChromeKind {
  const kind = coerceSimNodeKind(raw);
  if (kind !== null && CHROME_KIND_SET.has(kind)) {
    return kind as SimChromeKind;
  }
  return 'client';
}

export function parseSimNodeAddress(id: string): {
  readonly kind: string;
  readonly instanceId: string | null;
} {
  const colon = id.indexOf(':');
  if (colon <= 0) {
    return { kind: coerceSimNodeKind(id) ?? id, instanceId: null };
  }
  const prefix = id.slice(0, colon);
  const instanceId = id.slice(colon + 1);
  return {
    kind: coerceSimNodeKind(prefix) ?? prefix,
    instanceId: instanceId.length > 0 ? instanceId : null,
  };
}

export function formatSimNodeLabel(args: {
  readonly id: string;
  readonly kind?: string;
}): string {
  const fromId = parseSimNodeAddress(args.id);
  if (fromId.instanceId !== null) return fromId.instanceId;
  const kind = coerceSimNodeKind(args.kind) ?? coerceSimNodeKind(fromId.kind);
  if (kind !== null) return SIM_NODE_LABELS[kind];
  return args.id;
}

export type FallbackReportNode = {
  readonly id: string;
  readonly kind: SimNodeKind;
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
