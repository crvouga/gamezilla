import type { Keyword } from '@pkgs/keyword';
import type { Entity } from '../interface';
import { assertAttribute } from '../interface';

export type NodeSnapshot = { nodeId: string; entities: Entity[] };

function canonicalizeEntity(e: Entity): string {
  const sortedAttrs: Record<string, unknown> = {};
  for (const key of Object.keys(e.attributes).sort()) {
    assertAttribute(key);
    sortedAttrs[key] = e.attributes[key as Keyword];
  }
  return JSON.stringify({
    entityId: e.entityId,
    entityType: e.entityType,
    attributes: sortedAttrs,
  });
}

function buildEntitySetMismatchError(
  firstNodeId: string,
  otherNodeId: string,
  missingFromOther: string[],
  extraInOther: string[]
): Error {
  const parts: string[] = [
    `Entity set mismatch between ${firstNodeId} and ${otherNodeId}.`,
  ];
  if (missingFromOther.length > 0) {
    parts.push(`  Missing from ${otherNodeId}: ${missingFromOther.join(', ')}`);
  }
  if (extraInOther.length > 0) {
    parts.push(`  Extra in ${otherNodeId}: ${extraInOther.join(', ')}`);
  }
  return new Error(parts.join('\n'));
}

function assertSameEntitySets(nodes: NodeSnapshot[]): void {
  const first = nodes[0];
  if (!first) return;
  const firstIds = new Set(first.entities.map((e) => e.entityId));
  for (let i = 1; i < nodes.length; i++) {
    const other = nodes[i];
    if (!other) continue;
    const otherIds = new Set(other.entities.map((e) => e.entityId));
    const missingFromOther = [...firstIds].filter((id) => !otherIds.has(id));
    const extraInOther = [...otherIds].filter((id) => !firstIds.has(id));
    if (missingFromOther.length > 0 || extraInOther.length > 0) {
      throw buildEntitySetMismatchError(
        first.nodeId,
        other.nodeId,
        missingFromOther,
        extraInOther
      );
    }
  }
}

function buildEntityMap(
  nodes: NodeSnapshot[]
): Map<string, Map<string, string>> {
  const entityMap = new Map<string, Map<string, string>>();
  for (const node of nodes) {
    for (const entity of node.entities) {
      let perNode = entityMap.get(entity.entityId);
      if (!perNode) {
        perNode = new Map();
        entityMap.set(entity.entityId, perNode);
      }
      perNode.set(node.nodeId, canonicalizeEntity(entity));
    }
  }
  return entityMap;
}

function assertEntityAttributesEqual(
  entityMap: Map<string, Map<string, string>>
): void {
  for (const [entityId, perNode] of entityMap) {
    const values = [...perNode.values()];
    const reference = values[0];
    if (!reference) continue;
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== reference) {
        const nodeEntries = [...perNode.entries()];
        const lines = nodeEntries.map(
          ([nodeId, json]) => `  ${nodeId}: ${json}`
        );
        throw new Error(
          `Entity ${entityId} differs across nodes:\n${lines.join('\n')}`
        );
      }
    }
  }
}

export function assertNodesConsistent(nodes: NodeSnapshot[]): void {
  if (nodes.length < 2) return;
  assertSameEntitySets(nodes);
  const entityMap = buildEntityMap(nodes);
  assertEntityAttributesEqual(entityMap);
}
