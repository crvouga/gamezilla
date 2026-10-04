import { describe, expect, test } from 'bun:test';
import { parseManifest } from '@pkgs/conformance-shared/manifest';

import { manifestText, section } from './fixtures/manifest';

function issues(text: string): readonly string[] {
  const parsed = parseManifest(text);
  return parsed.ok ? [] : parsed.issues;
}

describe('parseManifest', () => {
  test('reads a manifest written like specs/conformance.yaml', () => {
    const parsed = parseManifest(`
product:
  contexts: [spaces]
  tiers: [guest]
  capabilities:
    - { id: create a space, context: spaces, decided by: access }
  public contracts:
    - id: space links
      context: spaces
      promise: A link keeps working.
conformance:
  behavior: required
  decisions: required
  dynamics: required
  structure: required
  objectives: required
  accessibility: required
environments:
  - { id: offline, promise: Without a connection. }
production readiness:
  manual testing allowed: false
  require: [completeness]
  fail on: [manual, unknown, skipped, not run, missing evidence, stale evidence, missing automation]
release gates: [lint]
`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.manifest.product.capabilities).toEqual([
      { id: 'create a space', context: 'spaces', 'decided by': 'access' },
    ]);
    expect(parsed.manifest['production readiness'].require).toEqual([
      'completeness',
    ]);
  });

  test('a valid manifest has no issues', () => {
    expect(issues(manifestText())).toEqual([]);
  });

  test('manual testing must be refused', () => {
    expect(
      issues(
        manifestText((m) => {
          section(m, 'production readiness')['manual testing allowed'] = true;
        })
      )
    ).toEqual([
      'production readiness.manual testing allowed: must be false — nothing is verified by hand (got true)',
    ]);
  });

  test('fail on must name every non-pass state, and only those', () => {
    const found = issues(
      manifestText((m) => {
        section(m, 'production readiness')['fail on'] = [
          'manual',
          'unknown',
          'flaky',
        ];
      })
    );
    expect(found).toContain(
      'production readiness.fail on: must list "stale evidence" — it is not a pass'
    );
    expect(found).toContain(
      'production readiness.fail on: must list "not run" — it is not a pass'
    );
    expect(found.some((i) => i.includes('"flaky" is not one of'))).toBe(true);
  });

  test('require must be non-empty and known', () => {
    expect(
      issues(
        manifestText(
          (m) => (section(m, 'production readiness')['require'] = [])
        )
      )
    ).toEqual(['production readiness.require: is empty']);
    expect(
      issues(
        manifestText(
          (m) => (section(m, 'production readiness')['require'] = ['vibes'])
        )
      )[0]
    ).toStartWith('production readiness.require[0]: "vibes" is not one of');
  });

  test('ids are unique', () => {
    const found = issues(
      manifestText((m) => {
        section(m, 'environments');
        m['environments'] = [
          { id: 'offline', promise: 'a' },
          { id: 'offline', promise: 'b' },
        ];
        m['release gates'] = ['lint', 'lint'];
      })
    );
    expect(found).toEqual([
      'environments: "offline" is listed twice',
      'release gates: "lint" is listed twice',
    ]);
  });

  test("a capability's context must be declared", () => {
    expect(
      issues(
        manifestText((m) => {
          const product = section(m, 'product');
          product['capabilities'] = [
            { id: 'x', context: 'billing', 'decided by': 'access' },
          ];
        })
      )
    ).toEqual([
      'product.capabilities[0].context: "billing" is not one of product.contexts',
    ]);
  });

  test('every kind of spec is required, and nothing else is a kind', () => {
    const found = issues(
      manifestText((m) => {
        const conformance = section(m, 'conformance');
        conformance['structure'] = 'optional';
        delete conformance['objectives'];
        conformance['grammar'] = 'required';
      })
    );
    expect(found).toContain(
      'conformance.structure: must be "required", not "optional"'
    );
    expect(found).toContain('conformance.objectives: is missing');
    expect(
      found.some((i) =>
        i.startsWith('conformance.grammar: is not a manifest key')
      )
    ).toBe(true);
  });

  test('an unknown or missing key is an issue, reported once', () => {
    const found = issues(
      manifestText((m) => {
        delete m['release gates'];
        m['extras'] = true;
      })
    );
    expect(found).toEqual([
      'extras: is not a manifest key (product, conformance, environments, production readiness, release gates)',
      'release gates: is missing',
    ]);
  });

  test('text that is not YAML, or is empty, is refused', () => {
    expect(issues('product: [')[0]).toStartWith('the manifest is not YAML');
    expect(issues('')).toEqual(['the manifest is empty']);
  });
});
