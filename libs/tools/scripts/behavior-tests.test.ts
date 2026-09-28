import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { behaviorTestViolations } from './behavior-tests';

function violations(files: readonly string[]): string {
  return behaviorTestViolations({ files }).join('\n');
}

describe('behaviorTestViolations', () => {
  test('harness support under tests/harness and one example app are clean', () => {
    expect(
      behaviorTestViolations({
        files: [
          'src/index.ts',
          'src/harness/example-app/example-app.ts',
          'src/harness/example-app/schema.ts',
          'tests/a.test.ts',
          'tests/harness/open-x-harness.ts',
          'tests/steps/x.steps.ts',
        ],
      })
    ).toEqual([]);
  });

  test('a test file under tests/harness is reported, however deep', () => {
    const errors = violations([
      'tests/harness/flow.test.ts',
      'tests/harness/nested/ui.test.tsx',
      'src/feature/tests/harness/inner.test.ts',
    ]);
    expect(errors).toContain('tests/harness/flow.test.ts');
    expect(errors).toContain('tests/harness/nested/ui.test.tsx');
    expect(errors).toContain('src/feature/tests/harness/inner.test.ts');
  });

  test('a test file merely named harness is not under tests/harness', () => {
    expect(
      behaviorTestViolations({
        files: ['tests/harness.test.ts', 'tests/harness-support.test.ts'],
      })
    ).toEqual([]);
  });

  test('a fixture app other than example-app is reported once per directory', () => {
    const errors = behaviorTestViolations({
      files: [
        'src/example-app/index.ts',
        'src/example-counter/counter.ts',
        'src/example-counter/view/counter.tsx',
        'src/example-match-clock/clock.ts',
      ],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('src/example-counter');
    expect(errors[0]).toContain('src/example-match-clock');
    expect(errors[0]).not.toContain('src/example-counter/view');
    expect(errors[0]).not.toContain('src/example-app');
  });

  test('two example-app directories are two fixture apps', () => {
    expect(
      violations(['src/harness/example-app/a.ts', 'tests/example-app/b.ts'])
    ).toContain('more than one example-app');
  });

  test('a file named example-*, not a directory, is no fixture app', () => {
    expect(
      behaviorTestViolations({
        files: ['src/components/explorer/example-root.tsx'],
      })
    ).toEqual([]);
  });

  test('node_modules is not the package', () => {
    expect(
      behaviorTestViolations({
        files: [
          'node_modules/x/tests/harness/a.test.ts',
          'node_modules/x/example-y/a.ts',
        ],
      })
    ).toEqual([]);
  });

  const segment = fc.stringMatching(/^[a-z][a-z0-9-]{0,6}$/);
  const dir = fc.array(
    fc.oneof(
      segment,
      fc.constantFrom(
        'tests',
        'harness',
        'support',
        'example-app',
        'example-kv'
      )
    ),
    { maxLength: 4 }
  );
  const file = fc
    .tuple(dir, segment, fc.constantFrom('.ts', '.test.ts', '.test.tsx'))
    .map(([parts, name, ext]) => [...parts, `${name}${ext}`].join('/'));

  test('property: clean iff no harness test, no forked app and at most one example-app', () => {
    assertProperty(
      'behavior test shape',
      fc.property(fc.uniqueArray(file, { maxLength: 10 }), (files) => {
        const dirs = new Set(
          files.flatMap((f) => {
            const parts = f.split('/');
            return parts
              .slice(0, -1)
              .map((_, i) => parts.slice(0, i + 1).join('/'));
          })
        );
        const base = (d: string) => d.split('/').at(-1) ?? '';
        const harnessTest = files.some((f) => {
          const parts = f.split('/').slice(0, -1);
          return (
            /\.test\.tsx?$/.test(f) &&
            parts.some((p, i) => p === 'tests' && parts[i + 1] === 'harness')
          );
        });
        const forked = [...dirs].some(
          (d) => base(d).startsWith('example-') && base(d) !== 'example-app'
        );
        const apps = [...dirs].filter((d) => base(d) === 'example-app').length;
        const clean = !harnessTest && !forked && apps <= 1;
        expect(behaviorTestViolations({ files }).length === 0).toBe(clean);
      })
    );
  });
});
