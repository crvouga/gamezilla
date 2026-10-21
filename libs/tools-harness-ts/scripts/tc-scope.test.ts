import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { parseTsConfig, tcProject, tcScopeViolations } from './tc-scope';

const TC = 'tsc --noEmit --incremental -p ./tsconfig.tc.json';

describe('tcScopeViolations', () => {
  test('files inside the include are clean', () => {
    expect(
      tcScopeViolations({
        tcScript: TC,
        tsconfigText: '{ "include": ["./src/**/*.ts", "./tests"] }',
        files: ['src/a.ts', 'tests/harness/b.test.tsx', 'README.md'],
      })
    ).toEqual([]);
  });

  test('a test outside the include is reported', () => {
    expect(
      tcScopeViolations({
        tcScript: TC,
        tsconfigText: '{ "include": ["./src/**/*.ts"] }',
        files: ['src/a.ts', 'tests/a.test.ts'],
      }).join('\n')
    ).toContain('tests/a.test.ts');
  });

  test('an excluded file is reported', () => {
    expect(
      tcScopeViolations({
        tcScript: TC,
        tsconfigText: '{ "include": ["src"], "exclude": ["src/gen"] }',
        files: ['src/a.ts', 'src/gen/b.ts'],
      }).join('\n')
    ).toContain('src/gen/b.ts');
  });

  test('TypeScript with no tc script is reported', () => {
    expect(
      tcScopeViolations({
        tcScript: undefined,
        tsconfigText: null,
        files: ['scripts/a.ts'],
      }).join('\n')
    ).toContain('no `tc` script');
  });

  test('a package without TypeScript needs no tc', () => {
    expect(
      tcScopeViolations({
        tcScript: undefined,
        tsconfigText: null,
        files: ['README.md', 'src/types.d.ts'],
      })
    ).toEqual([]);
  });

  test('tcProject reads the -p argument', () => {
    expect(tcProject(TC)).toBe('tsconfig.tc.json');
    expect(tcProject('tsc --noEmit -p tsconfig.json')).toBe('tsconfig.json');
    expect(tcProject('bun verify')).toBeNull();
  });

  test('property: JSONC comments and trailing commas never change the parse', () => {
    const pattern = fc.stringMatching(/^[a-z*./]{1,12}$/);
    assertProperty(
      'jsonc',
      fc.property(
        fc.array(pattern, { maxLength: 4 }),
        fc.array(pattern, { maxLength: 4 }),
        (include, exclude) => {
          const plain = JSON.stringify({ include, exclude });
          const jsonc = [
            '// leading comment',
            '{',
            `  /* block */ "include": ${JSON.stringify(include)}, // tail`,
            `  "exclude": ${JSON.stringify(exclude)},`,
            '}',
          ].join('\n');
          expect(parseTsConfig(jsonc)).toEqual(parseTsConfig(plain));
        }
      )
    );
  });
});
