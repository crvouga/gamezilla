/**
 * The world between the conformance manifest and the permission catalog is
 * closed (strategy §§ 11, 23.8): every key the permission system decides is
 * a declared capability and every declared capability is a key it decides;
 * every capability is answered by the decision table the manifest says, and
 * that table names it; every mutation the server replays is either public or
 * performs a declared capability. Product surface added without the manifest
 * (or the manifest without the product) fails here.
 */
import { describe, expect, test } from 'bun:test';
import { QUOTA_ACTIONS } from '@libs/permissions/public/permission-catalog';
import {
  CAPABILITY_KEYS,
  catalogKeys,
} from '@libs/permissions/root/conformance/capabilities';
import { DMN_INPUT } from '@libs/permissions/root/conformance/people';
import { MUTATION_ACTIONS } from '@libs/permissions/root/mutation-actions';
import type { DmnDecision } from '@pkgs/dmn/model';

import {
  allDecisions,
  type ManifestCapability,
  manifestCapabilities,
} from './support/specs';

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

/** The capabilities a table lists (its "what they want to do" values). */
function listedCapabilities(decision: DmnDecision): readonly string[] | null {
  const input = decision.inputs.find((i) => i.name === DMN_INPUT.capability);
  if (input === undefined) return null;
  if (input.domain.kind !== 'values') return [];
  return input.domain.values.map(String);
}

function decidedBy(
  capabilities: readonly ManifestCapability[],
  decisionId: string
): string[] {
  return sorted(
    capabilities.filter((c) => c['decided by'] === decisionId).map((c) => c.id)
  );
}

describe('closed world: manifest ↔ permission catalog', () => {
  test('the capability map lists exactly the manifest capabilities', async () => {
    // regression: permission-rated-start-capability-name
    const declared = (await manifestCapabilities()).map((c) => c.id);
    expect(sorted(Object.keys(CAPABILITY_KEYS))).toEqual(sorted(declared));
    expect(new Set(declared).size).toBe(declared.length);
  });

  test('every catalog key is exactly one capability, and every capability one key', () => {
    const mapped = Object.values(CAPABILITY_KEYS);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(sorted(mapped)).toEqual(sorted(catalogKeys()));
  });

  test('every capability is answered by its decision, which names it', async () => {
    const capabilities = await manifestCapabilities();
    const decisions = await allDecisions();
    for (const capability of capabilities) {
      const decision = decisions.find((d) => d.id === capability['decided by']);
      expect({
        capability: capability.id,
        found: decision !== undefined,
      }).toEqual({ capability: capability.id, found: true });
      if (decision === undefined) continue;
      const listed = listedCapabilities(decision);
      // A table without a capability input decides one capability: its own.
      const named = listed ?? decidedBy(capabilities, decision.id);
      expect({
        capability: capability.id,
        named: named.includes(capability.id),
      }).toEqual({ capability: capability.id, named: true });
    }
  });

  test("every table's capabilities are declared, and decided by that table", async () => {
    const capabilities = await manifestCapabilities();
    for (const decision of await allDecisions()) {
      const listed = listedCapabilities(decision);
      const owned = decidedBy(capabilities, decision.id);
      expect({ decision: decision.id, owned: owned.length > 0 }).toEqual({
        decision: decision.id,
        owned: true,
      });
      if (listed === null) {
        expect({ decision: decision.id, owned }).toEqual({
          decision: decision.id,
          owned: owned.slice(0, 1),
        });
      } else {
        expect({ decision: decision.id, listed: sorted(listed) }).toEqual({
          decision: decision.id,
          listed: owned,
        });
      }
    }
  });

  test('every replayed mutation is public or performs a declared capability', () => {
    const keys = new Set<string>(Object.values(CAPABILITY_KEYS));
    for (const [name, declared] of Object.entries(MUTATION_ACTIONS)) {
      const performs =
        declared === 'public'
          ? []
          : declared === 'quota'
            ? [...QUOTA_ACTIONS]
            : [declared];
      for (const key of performs) {
        expect({ name, key, declared: keys.has(key) }).toEqual({
          name,
          key,
          declared: true,
        });
      }
    }
  });
});
