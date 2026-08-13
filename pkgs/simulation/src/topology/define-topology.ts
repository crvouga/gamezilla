import type {
  SpawnKindTemplate,
  TopologyDefinition,
  TopologyEdgeDef,
  TopologyKindDef,
  TopologyNodeDef,
} from './types';

export type DefineTopologyArgs = {
  readonly kinds: Readonly<Record<string, TopologyKindDef>>;
  readonly nodes?: readonly TopologyNodeDef[];
  readonly edges?: readonly TopologyEdgeDef[];
  readonly spawn?: Readonly<Record<string, SpawnKindTemplate>>;
};

/** Validate and freeze a declarative topology used by runtime + reports. */
export function defineTopology(args: DefineTopologyArgs): TopologyDefinition {
  const kinds = { ...args.kinds };
  const nodes = [...(args.nodes ?? [])];
  const edges = [...(args.edges ?? [])];
  const spawn = { ...(args.spawn ?? {}) };

  for (const node of nodes) {
    if (!(node.kind in kinds)) {
      throw new Error(
        `defineTopology: node '${node.id}' has unknown kind '${node.kind}'`
      );
    }
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      throw new Error(`defineTopology: edge from unknown node '${edge.from}'`);
    }
    if (!nodeIds.has(edge.to)) {
      throw new Error(`defineTopology: edge to unknown node '${edge.to}'`);
    }
  }
  for (const [kind, template] of Object.entries(spawn)) {
    if (!(kind in kinds)) {
      throw new Error(`defineTopology: spawn kind '${kind}' is not declared`);
    }
    for (const e of template.edges) {
      if (!nodeIds.has(e.to)) {
        throw new Error(
          `defineTopology: spawn.${kind} edge to unknown node '${e.to}'`
        );
      }
    }
  }

  return {
    kinds,
    nodes,
    edges,
    spawn,
  };
}

/** True when a kind declares the `html` attribute (UI actor sugar). */
export function kindHasHtml(
  definition: TopologyDefinition,
  kind: string
): boolean {
  const def = definition.kinds[kind];
  return def?.attributes.includes('html') === true;
}

/** First spawnable kind that has an `html` attribute (default client role). */
export function defaultHtmlSpawnKind(
  definition: TopologyDefinition
): string | null {
  for (const [kind, template] of Object.entries(definition.spawn)) {
    void template;
    if (kindHasHtml(definition, kind)) return kind;
  }
  for (const kind of Object.keys(definition.kinds)) {
    if (kindHasHtml(definition, kind)) return kind;
  }
  return null;
}
