/** App-agnostic topology types for simulation graphs. */

export type AttributeKind =
  | 'html'
  | 'sqlite'
  | 'ingress'
  | 'egress'
  | (string & {});

export type EdgeKind = 'http' | 'pubsub' | (string & {});

export type TopologyKindDef = {
  readonly attributes: readonly AttributeKind[];
};

export type TopologyNodeDef = {
  readonly id: string;
  readonly kind: string;
};

export type TopologyEdgeDef = {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
};

export type SpawnEdgeTemplate = {
  readonly to: string;
  readonly kind: EdgeKind;
};

export type SpawnKindTemplate = {
  readonly edges: readonly SpawnEdgeTemplate[];
};

export type TopologyDefinition = {
  readonly kinds: Readonly<Record<string, TopologyKindDef>>;
  readonly nodes: readonly TopologyNodeDef[];
  readonly edges: readonly TopologyEdgeDef[];
  readonly spawn: Readonly<Record<string, SpawnKindTemplate>>;
};

export type AttributeSnapshot =
  | { readonly kind: 'html'; readonly html: string }
  | { readonly kind: 'sqlite'; readonly bytes: Uint8Array }
  | {
      readonly kind: 'ingress' | 'egress';
      readonly eventIds: readonly string[];
    }
  | { readonly kind: string; readonly data?: unknown };

export type NodeStatus = 'ok' | 'crashed' | 'paused';

export type EdgeLinkState = 'ok' | 'hold' | 'down';

export type EdgeDirection = 'from' | 'to' | 'both';

export type LiveEdgeSnapshot = {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  readonly state: EdgeLinkState;
  readonly latencyMs: number;
  readonly jitterMs: number;
  readonly dropRate: number;
  readonly duplicateRate: number;
  readonly failWithRemaining: number;
};

export type LiveNodeSnapshot = {
  readonly id: string;
  readonly kind: string;
  readonly status: NodeStatus;
  readonly attributes: readonly AttributeKind[];
  readonly clockSkewMs: number;
};

export type TopologySnapshot = {
  readonly definition: TopologyDefinition;
  readonly nodes: readonly LiveNodeSnapshot[];
  readonly edges: readonly LiveEdgeSnapshot[];
  readonly seed: string;
  readonly fuzz: FuzzConfigSnapshot | null;
};

export type FuzzConfigSnapshot = {
  readonly enabled: boolean;
  readonly intensity: number;
  readonly streamId: string;
};
