import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { testScriptViolations } from './test-scripts';

const preload = '--preload @pkgs/bun-test-solid-client-ts/preload';

test('Solid spec preparation and runtime commands select the canonical config too', () => {
  // regression: solid-spec-launchers-implicit-tsconfig
  for (const command of ['bun run', 'bun --conditions=browser']) {
    const script = `${command} --preload=@pkgs/bun-test-solid-client-ts/register ../../libs/harness-ts/scripts/prepare-spec.ts`;
    expect(
      testScriptViolations({
        scripts: { 'prepare:spec': script },
        files: [],
      }).join('\n')
    ).toContain('--tsconfig-override');
    expect(
      testScriptViolations({
        scripts: {
          'prepare:spec': script.replace(
            'bun ',
            'bun --tsconfig-override=../../tsconfig.json '
          ),
        },
        files: [],
      })
    ).toEqual([]);
  }
});

test('Solid test commands select the root compiler config without hiding unfiltered tests', () => {
  // regression: solid-tests-implicit-tsconfig
  const files = ['tests/profile-avatar-figure.test.tsx'];
  expect(
    testScriptViolations({
      scripts: { test: `bun test --conditions=browser ${preload}` },
      files,
    }).join('\n')
  ).toContain('--tsconfig-override ../../tsconfig.json');
  expect(
    testScriptViolations({
      scripts: {
        test: `bun test --tsconfig-override ../../tsconfig.json --conditions=browser ${preload}`,
      },
      files,
    })
  ).toEqual([]);
});

test('the config flag preserves every selected test for filtered and unfiltered Solid suites', () => {
  assertProperty(
    'Solid compiler config keeps coverage',
    fc.property(
      fc.array(fc.stringMatching(/^[a-z]{1,8}$/), {
        minLength: 1,
        maxLength: 8,
      }),
      fc.boolean(),
      (names, filtered) => {
        const files = [...new Set(names)].map(
          (name) => `tests/${name}.test.tsx`
        );
        expect(
          testScriptViolations({
            scripts: {
              test: `bun test --tsconfig-override ../../tsconfig.json ${preload}${filtered ? ' tests' : ''}`,
            },
            files,
          })
        ).toEqual([]);
      }
    )
  );
});
