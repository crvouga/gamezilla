import { describe, expect, it } from 'bun:test';
import { type CliDep, installCliDeps, sortCliDeps } from './cli-dep';

function dep(
  id: string,
  dependsOn: readonly string[] = [],
  onInstall?: () => void
): CliDep {
  return {
    id,
    dependsOn,
    async installOrUpgrade() {
      onInstall?.();
    },
  };
}

describe('sortCliDeps', () => {
  it('orders dependents after dependencies', () => {
    const ordered = sortCliDeps([
      dep('wrangler', ['bun', 'node']),
      dep('bun'),
      dep('node'),
      dep('workspace', ['bun']),
    ]);
    expect(ordered.map((d) => d.id)).toEqual([
      'bun',
      'node',
      'workspace',
      'wrangler',
    ]);
  });

  it('rejects duplicate ids', () => {
    expect(() => sortCliDeps([dep('bun'), dep('bun')])).toThrow(
      /duplicate CliDep id: bun/
    );
  });

  it('rejects unknown dependsOn', () => {
    expect(() => sortCliDeps([dep('wrangler', ['missing'])])).toThrow(
      /unknown id "missing"/
    );
  });

  it('rejects cycles', () => {
    expect(() => sortCliDeps([dep('a', ['b']), dep('b', ['a'])])).toThrow(
      /CliDep cycle involving: a, b/
    );
  });
});

describe('installCliDeps', () => {
  it('invokes installOrUpgrade in topo order', async () => {
    const log: string[] = [];
    await installCliDeps([
      dep('child', ['parent'], () => {
        log.push('child');
      }),
      dep('parent', [], () => {
        log.push('parent');
      }),
    ]);
    expect(log).toEqual(['parent', 'child']);
  });
});
