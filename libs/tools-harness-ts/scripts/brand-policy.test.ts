import { describe, expect, test } from 'bun:test';
import { syntheticIdentity } from '@libs/product-identity-shared-ts/synthetic-identity';
import {
  brandTokens,
  brandViolations,
  IDENTITY_DIR,
  verifiedArtifacts,
} from './brand-policy';

// A synthetic brand, so this test spells nothing real.
const identity = {
  ...syntheticIdentity(),
  technical: { namespace: 'nwarcade' },
  aliases: ['north wind'],
};
const tokens = brandTokens(identity);

describe('brand tokens', () => {
  test('cover the names, domain, namespace and aliases, longest first', () => {
    expect(tokens).toContain('northwind arcade');
    expect(tokens).toContain('northwind.example');
    expect(tokens).toContain('nwarcade');
    expect(tokens).toContain('north wind');
    expect(tokens).toEqual(
      [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b))
    );
  });
});

describe('brand violations', () => {
  test('a spelling in any case, in content or a path, is reported with its line', () => {
    expect(
      brandViolations(
        [
          { path: 'apps/web/src/title.ts', text: 'ok\nconst t = "NORTHWIND";' },
          { path: 'docs/NWARCADE_GUIDE.md', text: 'clean' },
          { path: 'apps/web/logo.png', text: null },
        ],
        tokens,
        new Set()
      )
    ).toEqual([
      { path: 'apps/web/src/title.ts', line: 2, token: 'northwind' },
      { path: 'docs/NWARCADE_GUIDE.md', line: 0, token: 'nwarcade' },
    ]);
  });

  test('only the identity package and verified generated artifacts may spell it', () => {
    const files = [
      {
        path: `${IDENTITY_DIR}product-identity.json`,
        text: 'Northwind Arcade',
      },
      { path: 'apps/web/public/manifest.json', text: 'Northwind Arcade' },
    ];
    expect(brandViolations(files, tokens, new Set())).toHaveLength(1);
    expect(
      brandViolations(files, tokens, new Set(['apps/web/public/manifest.json']))
    ).toEqual([]);
  });
});

describe('generated artifacts', () => {
  const files: Record<string, string> = {
    'gen.ts': 'writes it',
    'fresh.test.ts': 'compares manifest.json with what gen.ts writes',
  };
  const read = (path: string) => files[path] ?? null;

  test('an artifact is exempt only while its freshness test reads it and its generator exists', () => {
    const artifact = {
      path: 'apps/web/public/manifest.json',
      generator: 'bun run gen.ts',
      freshnessTest: 'fresh.test.ts',
    };
    expect(verifiedArtifacts([artifact], read)).toEqual({
      exempt: new Set([artifact.path]),
      problems: [],
    });
    for (const broken of [
      { ...artifact, freshnessTest: 'missing.test.ts' },
      { ...artifact, generator: 'bun run missing.ts' },
      { ...artifact, path: 'apps/web/public/other.json' },
    ]) {
      const result = verifiedArtifacts([broken], read);
      expect(result.exempt.size).toBe(0);
      expect(result.problems).toHaveLength(1);
    }
  });
});
