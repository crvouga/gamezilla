/** A small, valid conformance manifest as a plain object (JSON is YAML). */

import { CONFORMANCE_KINDS, FAIL_STATES, REQUIREMENTS } from '@pkgs/conformance-shared/manifest';

export type ManifestObject = Record<string, unknown>;

export function validManifest(): ManifestObject {
  return {
    product: {
      contexts: ['spaces', 'chess'],
      tiers: ['guest', 'member'],
      capabilities: [
        { id: 'create a space', context: 'spaces', 'decided by': 'access' },
        { id: 'solve a puzzle', context: 'chess', 'decided by': 'daily-limit' },
      ],
      'public contracts': [
        {
          id: 'space links',
          context: 'spaces',
          promise: 'A link keeps working.',
        },
      ],
    },
    conformance: Object.fromEntries(
      CONFORMANCE_KINDS.map((k) => [k, 'required'])
    ),
    environments: [{ id: 'offline', promise: 'Without a connection.' }],
    'production readiness': {
      'manual testing allowed': false,
      require: [...REQUIREMENTS],
      'fail on': [...FAIL_STATES],
    },
    'release gates': ['lint'],
  };
}

/** `validManifest()` with `edit` applied to a deep copy. */
export function manifestText(
  edit: (m: ManifestObject) => void = () => {}
): string {
  const manifest = structuredClone(validManifest());
  edit(manifest);
  return JSON.stringify(manifest);
}

export function section(
  m: ManifestObject,
  key: string
): Record<string, unknown> {
  return m[key] as Record<string, unknown>;
}
