/**
 * System-aligned node kinds for console chrome (simulator + tests).
 * Addresses are `kind` or `kind:instanceId` (`client:alice`, `room:<topic>`).
 */

export const SIM_NODE_KINDS = [
  'client',
  'lb',
  'server',
  'events',
  'room',
  'db',
] as const;

export type SimNodeKind = (typeof SIM_NODE_KINDS)[number];

/** ProductSimulator kind tabs (DB is a pane under Server, not its own tab). */
export const SIM_CHROME_KINDS = [
  'client',
  'lb',
  'server',
  'events',
  'room',
] as const;

export type SimChromeKind = (typeof SIM_CHROME_KINDS)[number];

export const SIM_NODE_KIND_ALIASES: Readonly<Record<string, SimNodeKind>> = {
  api: 'server',
  pubsub: 'events',
  actor: 'room',
  balancer: 'lb',
  loadbalancer: 'lb',
};

export const SIM_NODE_LABELS: Readonly<Record<SimNodeKind, string>> = {
  client: 'Client',
  lb: 'Balancer',
  server: 'Server',
  events: 'PubSub',
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
  const kind = coerceSimNodeKind(args.kind) ?? coerceSimNodeKind(fromId.kind);
  if (fromId.instanceId !== null) {
    // Room topics are UUIDs — show a short chip, not the full id.
    if (kind === 'room' || looksLikeUuid(fromId.instanceId)) {
      return shortId(fromId.instanceId);
    }
    return fromId.instanceId;
  }
  // Bare room topic UUID tab ids (unified strip uses topic as id).
  if (looksLikeUuid(args.id)) return shortId(args.id);
  // Bare kind tokens (server / events / …) keep the chrome label.
  const bareKind = coerceSimNodeKind(args.id);
  if (bareKind !== null) return SIM_NODE_LABELS[bareKind];
  // Instance ids with a kind hint (client-1, alice, …) keep the id.
  return args.id;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function shortId(value: string): string {
  return value.length <= 10 ? value : `${value.slice(0, 8)}…`;
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
    { id: 'lb', kind: 'lb', attributes: ['round-robin', 'ingress', 'egress'] },
    {
      id: 'server',
      kind: 'server',
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
