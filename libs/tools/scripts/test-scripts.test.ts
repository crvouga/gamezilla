import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { testScriptViolations } from './test-scripts';

const E2E = 'bun run ../../libs/sim-harness/scripts/test-e2e.ts';

describe('testScriptViolations', () => {
  test('a plain `bun test` over tests/ is clean', () => {
    expect(
      testScriptViolations({
        scripts: { test: 'bun test' },
        files: ['src/a.ts', 'tests/a.test.ts'],
      })
    ).toEqual([]);
  });

  test('bans --pass-with-no-tests, --rerun-each and --retry', () => {
    const errors = testScriptViolations({
      scripts: {
        test: 'bun test --pass-with-no-tests',
        'test:contract': 'bun test --rerun-each 3 tests/a.contract.test.ts',
        'test:e2e': `${E2E} --retry 2`,
      },
      files: [
        'tests/a.test.ts',
        'tests/a.contract.test.ts',
        'tests/e2e/x.test.ts',
      ],
    }).join('\n');
    expect(errors).toContain('"test" uses --pass-with-no-tests');
    expect(errors).toContain('"test:contract" uses --rerun-each');
    expect(errors).toContain('"test:e2e" uses --retry');
  });

  test('a gate script that matches no file is reported', () => {
    expect(
      testScriptViolations({
        scripts: { test: 'bun test tests' },
        files: ['src/a.ts'],
      }).join('\n')
    ).toContain('"test" runs no test files');
  });

  test('a custom runner is reported, not trusted', () => {
    expect(
      testScriptViolations({
        scripts: { test: 'bun run scripts/my-runner.ts' },
        files: ['tests/a.test.ts'],
      }).join('\n')
    ).toContain('cannot be checked');
  });

  test('e2e split: test ignores tests/e2e, the harness runner picks it up', () => {
    expect(
      testScriptViolations({
        scripts: {
          test: "bun test --path-ignore-patterns='tests/e2e/**'",
          'test:e2e': E2E,
        },
        files: ['tests/a.test.ts', 'tests/e2e/b.test.tsx'],
      })
    ).toEqual([]);
  });

  test('a file every gate script ignores is an orphan', () => {
    expect(
      testScriptViolations({
        scripts: { test: "bun test --path-ignore-patterns='**/*.test.tsx'" },
        files: ['tests/a.test.ts', 'tests/b.test.tsx'],
      }).join('\n')
    ).toContain('tests/b.test.tsx');
  });

  // `f`-prefixed so a name never collides with a directory filter.
  const segment = fc.stringMatching(/^f[a-z0-9-]{0,6}$/);
  const testFile = fc
    .tuple(
      fc.constantFrom('tests', 'src', 'tests/e2e', 'scripts'),
      segment,
      fc.constantFrom('.test.ts', '.test.tsx', '.contract.test.ts')
    )
    .map(([dir, name, ext]) => `${dir}/${name}${ext}`);

  test('property: a file is an orphan iff no gate script reaches it', () => {
    assertProperty(
      'orphan iff unreached',
      fc.property(
        fc.uniqueArray(testFile, { minLength: 1, maxLength: 12 }),
        fc.subarray(['tests', 'src', 'scripts']),
        fc.boolean(),
        (files, dirs, withE2e) => {
          const scripts: Record<string, string> = {};
          if (dirs.length > 0) {
            scripts['test'] =
              `bun test --path-ignore-patterns='tests/e2e/**' ${dirs.join(' ')}`;
          }
          if (withE2e) scripts['test:e2e'] = E2E;
          const listed = new Set(
            testScriptViolations({ scripts, files })
              .join('\n')
              .split('\n')
              .map((line) => line.trim())
          );
          for (const file of files) {
            const reached = file.startsWith('tests/e2e/')
              ? withE2e
              : dirs.some((dir) => file.startsWith(`${dir}/`));
            expect(listed.has(file)).toBe(!reached);
          }
        }
      )
    );
  });
});
