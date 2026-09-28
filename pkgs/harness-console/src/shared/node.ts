/**
 * System-aligned node kinds for harness console chrome.
 * Addresses are `kind` or `kind:instanceId` (`client:client-a`, `room:<topic>`).
 */

export const HARNESS_NODE_KINDS = [
  'client',
  'lb',
  'server',
  'events',
  'room',
  'db',
] as const;

export type HarnessNodeKind = (typeof HARNESS_NODE_KINDS)[number];

/** ProductHarness kind tabs (DB is a pane under Server, not its own tab). */
export const HARNESS_CHROME_KINDS = [
  'client',
  'lb',
  'server',
  'events',
  'room',
] as const;

export type HarnessChromeKind = (typeof HARNESS_CHROME_KINDS)[number];

export const HARNESS_NODE_KIND_ALIASES: Readonly<
  Record<string, HarnessNodeKind>
> = {
  api: 'server',
  pubsub: 'events',
  actor: 'room',
  balancer: 'lb',
  loadbalancer: 'lb',
};

export const HARNESS_NODE_LABELS: Readonly<Record<HarnessNodeKind, string>> = {
  client: 'client',
  lb: 'balancer',
  server: 'server',
  events: 'pubsub',
  room: 'room-server',
  db: 'db',
};

const NODE_KIND_SET: ReadonlySet<string> = new Set(HARNESS_NODE_KINDS);
const CHROME_KIND_SET: ReadonlySet<string> = new Set(HARNESS_CHROME_KINDS);

export function coerceHarnessNodeKind(
  raw: string | null | undefined
): HarnessNodeKind | null {
  if (raw === null || raw === undefined) return null;
  const aliased = HARNESS_NODE_KIND_ALIASES[raw] ?? raw;
  return NODE_KIND_SET.has(aliased) ? (aliased as HarnessNodeKind) : null;
}

export function coerceHarnessChromeKind(
  raw: string | null | undefined
): HarnessChromeKind {
  const kind = coerceHarnessNodeKind(raw);
  if (kind !== null && CHROME_KIND_SET.has(kind)) {
    return kind as HarnessChromeKind;
  }
  return 'client';
}

export function parseHarnessNodeAddress(id: string): {
  readonly kind: string;
  readonly instanceId: string | null;
} {
  const colon = id.indexOf(':');
  if (colon <= 0) {
    return { kind: coerceHarnessNodeKind(id) ?? id, instanceId: null };
  }
  const prefix = id.slice(0, colon);
  const instanceId = id.slice(colon + 1);
  return {
    kind: coerceHarnessNodeKind(prefix) ?? prefix,
    instanceId: instanceId.length > 0 ? instanceId : null,
  };
}

export function formatHarnessNodeLabel(args: {
  readonly id: string;
  readonly kind?: string;
}): string {
  const fromId = parseHarnessNodeAddress(args.id);
  const kind =
    coerceHarnessNodeKind(args.kind) ?? coerceHarnessNodeKind(fromId.kind);
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
  const bareKind = coerceHarnessNodeKind(args.id);
  if (bareKind !== null) return HARNESS_NODE_LABELS[bareKind];
  // Instance ids with a kind hint (client-a, server-b, …) keep the id.
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
  readonly kind: HarnessNodeKind;
  readonly attributes: readonly string[];
};

/** Topology stubs while `topology.json` is still loading. */
export function fallbackReportNodes(
  actorIds: readonly string[]
): readonly FallbackReportNode[] {
  const out: FallbackReportNode[] = [
    { id: 'lb', kind: 'lb', attributes: ['round-robin', 'ingress', 'egress'] },
    {
      id: 'server-a',
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
