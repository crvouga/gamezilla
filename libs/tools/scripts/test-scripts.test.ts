import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { testScriptViolations } from './test-scripts';

const spec = 'bun run ../../libs/harness/scripts/test-spec.ts';

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
        'test:spec': `${spec} --retry 2`,
      },
      files: [
        'tests/a.test.ts',
        'tests/a.contract.test.ts',
        'tests/harness/x.test.ts',
      ],
    }).join('\n');
    expect(errors).toContain('"test" uses --pass-with-no-tests');
    expect(errors).toContain('"test:contract" uses --rerun-each');
    expect(errors).toContain('"test:spec" uses --retry');
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

  test('spec split: test ignores tests/harness, the harness runner picks it up', () => {
    expect(
      testScriptViolations({
        scripts: {
          test: "bun test --path-ignore-patterns='tests/harness/**'",
          'test:spec': spec,
        },
        files: ['tests/a.test.ts', 'tests/harness/b.test.tsx'],
      })
    ).toEqual([]);
  });

  test('the harness runner with no spec file still runs the package specs', () => {
    const scripts = { 'test:spec': spec };
    expect(
      testScriptViolations({ scripts, files: [], specDomains: ['friends'] })
    ).toEqual([]);
    expect(testScriptViolations({ scripts, files: [] }).join('\n')).toContain(
      '"test:spec" runs no test files'
    );
  });

  test('a file every gate script ignores is an orphan', () => {
    expect(
      testScriptViolations({
        scripts: { test: "bun test --path-ignore-patterns='**/*.test.tsx'" },
        files: ['tests/a.test.ts', 'tests/b.test.tsx'],
      }).join('\n')
    ).toContain('tests/b.test.tsx');
  });

  test('an env prefix still reaches the contract part file', () => {
    expect(
      testScriptViolations({
        scripts: {
          'test:contract:0':
            'CONTRACT_PART=0/2 bun test tests/quint/model-checks.test.ts',
        },
        files: ['tests/quint/model-checks.test.ts'],
      })
    ).toEqual([]);
  });

  test('the render contract script reaches its own test file', () => {
    expect(
      testScriptViolations({
        scripts: {
          test: "bun test --path-ignore-patterns='**/*.contract.test.ts' tests",
          'test:contract': 'bun test tests/model.contract.test.ts',
          'test:contract:render': 'bun test tests/render.contract.test.ts',
        },
        files: [
          'tests/a.test.ts',
          'tests/model.contract.test.ts',
          'tests/render.contract.test.ts',
        ],
      })
    ).toEqual([]);
  });

  // `f`-prefixed so a name never collides with a directory filter.
  const segment = fc.stringMatching(/^f[a-z0-9-]{0,6}$/);
  const testFile = fc
    .tuple(
      fc.constantFrom('tests', 'src', 'tests/harness', 'scripts'),
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
        (files, dirs, withTest) => {
          const scripts: Record<string, string> = {};
          if (dirs.length > 0) {
            scripts['test'] =
              `bun test --path-ignore-patterns='tests/harness/**' ${dirs.join(' ')}`;
          }
          if (withTest) scripts['test:spec'] = spec;
          const listed = new Set(
            testScriptViolations({ scripts, files })
              .join('\n')
              .split('\n')
              .map((line) => line.trim())
          );
          for (const file of files) {
            const reached = file.startsWith('tests/harness/')
              ? withTest
              : dirs.some((dir) => file.startsWith(`${dir}/`));
            expect(listed.has(file)).toBe(!reached);
          }
        }
      )
    );
  });
});
