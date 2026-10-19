/**
 * PBT/MBT/DST coverage for the sx → Tailwind codemod.
 *
 * PBT: generated valid TSX preserves syntax and reaches a fixpoint.
 * MBT: a small state machine models the CLI pipeline and its gates.
 * DST: golden outputs lock the public migration contract byte-for-byte.
 */

import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import * as fc from 'fast-check';
import ts from 'typescript';
import { parseArgs } from '../cli-io';
import { checkCompleteness } from '../completeness-gate';
import { runCodemod } from '../run-codemod';
import { transformFile } from '../transform';

type SourceCase = {
  readonly component: 'Box' | 'Text' | 'Stack' | 'Clickable' | 'ScrollView';
  readonly sx: string;
  readonly suffix: string;
};

function parses(text: string): boolean {
  const source = ts.createSourceFile(
    'generated.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const diagnostics = source as unknown as {
    parseDiagnostics?: readonly unknown[] | undefined;
  };
  return (diagnostics.parseDiagnostics?.length ?? 0) === 0;
}

const componentArb = fc.constantFrom<SourceCase['component']>(
  'Box',
  'Text',
  'Stack',
  'Clickable',
  'ScrollView'
);

const staticSxArb = fc.constantFrom(
  `{{ p: 0 }}`,
  `{{ p: 0.5, m: -1 }}`,
  `{{ px: 2, py: 3, gap: 4 }}`,
  `{{ color: 'transparent', backgroundColor: 'surface' }}`,
  `{{ display: 'none', position: 'absolute' }}`,
  `{{ borderRadius: 'full', fontWeight: 'bold' }}`,
  `{{ transform: [{ translateX: 2 }, { scale: 1.5 }] }}`
);

const dynamicSxArb = fc.constantFrom(
  `{value}`,
  `{props.sx}`,
  `{condition ? { p: 1 } : null}`,
  `{[{ p: 1 }, extra]}`,
  `{({ ...extra, p: 1 })}`
);

const sourceArb = fc
  .record({
    component: componentArb,
    sx: fc.oneof(staticSxArb, dynamicSxArb),
    suffix: fc.constantFrom(
      '',
      ' id="stable"',
      ' aria-label="label"',
      ' class="existing"',
      ' dataSet={{ testid: "generated" }}'
    ),
  })
  .map(({ component, sx, suffix }) => {
    const attr = component === 'ScrollView' ? `frameSx=${sx}` : `sx=${sx}`;
    const props = component === 'Text' ? ' label="label"' : '';
    return {
      component,
      sx,
      suffix,
      source:
        `import { ${component} } from '@pkgs/ui';\n` +
        `export const A = (props: { value: never; extra: never; condition: boolean; sx: never }) => ` +
        `<${component}${props} ${attr}${suffix}>child</${component}>;`,
    };
  });

/**
 * These walk hundreds of generated sources through the TypeScript parser, so
 * they take seconds even on an idle machine and considerably longer on a
 * saturated one. The run count is the budget; the wall clock is not allowed to
 * be, or the verdict would depend on how busy the machine was — they timed out
 * under a full `bun verify` while passing in 9s on their own. Explicit
 * timeouts keep the coverage and take the scheduler out of the decision.
 */
const PROPERTY_TIMEOUT_MS = 120_000;

describe('property-based transform invariants', () => {
  test(
    'generated valid inputs parse, never throw, and are idempotent',
    async () => {
      await assertProperty(
        'generated valid inputs parse, never throw, and are idempotent',
        fc.property(sourceArb, ({ source }) => {
          const first = transformFile('generated.tsx', source);
          expect(first.parseError).toBeUndefined();
          expect(parses(first.text)).toBe(true);
          const second = transformFile('generated.tsx', first.text);
          expect(second.parseError).toBeUndefined();
          expect(second.text).toBe(first.text);
          expect(second.converted).toEqual([]);
        }),
        { numRuns: 500 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  test(
    'runCodemod preserves one output per input and stable counts',
    async () => {
      await assertProperty(
        'runCodemod preserves one output per input and stable counts',
        fc.property(
          fc.array(sourceArb, { minLength: 1, maxLength: 20 }),
          (cases) => {
            const inputs = Object.fromEntries(
              cases.map((item, index) => [`file-${index}.tsx`, item.source])
            );
            const result = runCodemod(inputs, { dryRun: true });
            expect(result.outputs).toHaveLength(Object.keys(inputs).length);
            expect(result.files).toHaveLength(Object.keys(inputs).length);
            expect(result.unstable).toEqual([]);
            expect(
              result.summary.totalConvertedA + result.summary.totalConvertedB
            ).toBe(
              result.files.reduce(
                (sum, file) => sum + file.convertedA + file.convertedB,
                0
              )
            );
          }
        ),
        { numRuns: 100 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );
});

type PipelineState = {
  readonly source: string;
  readonly transformed: string;
  readonly write: boolean;
  readonly stable: boolean;
  readonly gatePassed: boolean;
};

function modelPipeline(source: string, write: boolean): PipelineState {
  const result = transformFile('model.tsx', source);
  const again = transformFile('model.tsx', result.text);
  return {
    source,
    transformed: result.text,
    write,
    stable: again.text === result.text && again.converted.length === 0,
    gatePassed:
      checkCompleteness([{ path: 'model.tsx', nextText: result.text }])
        .length === 0,
  };
}

describe('model-based migration pipeline', () => {
  test(
    'write is permitted exactly when parse, stability, and completeness gates pass',
    async () => {
      await assertProperty(
        'write is permitted exactly when parse, stability, and completeness gates pass',
        fc.property(sourceArb, fc.boolean(), ({ source }, write) => {
          const state = modelPipeline(source, write);
          const result = runCodemod(
            { 'model.tsx': source },
            { dryRun: !write }
          );
          const canCommit =
            result.summary.parseFailures === 0 &&
            result.unstable.length === 0 &&
            result.gateHits.length === 0;
          expect(state.stable).toBe(result.unstable.length === 0);
          expect(state.gatePassed).toBe(result.gateHits.length === 0);
          expect(canCommit).toBe(
            result.summary.parseFailures === 0 &&
              state.stable &&
              state.gatePassed
          );
        }),
        { numRuns: 200 }
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  test('CLI model rejects ambiguous or unknown transitions', () => {
    expect(() => parseArgs(['--write', '--dry-run'])).toThrow();
    expect(() => parseArgs(['--unknown'])).toThrow();
    expect(parseArgs(['--dry-run'])).toMatchObject({
      write: false,
      dryRun: true,
    });
    expect(parseArgs(['--write'])).toMatchObject({
      write: true,
      dryRun: false,
    });
  });
});

describe('differential/snapshot contracts', () => {
  test.each([
    [
      'static box',
      `import { Box } from '@pkgs/ui';\nexport const A = () => <Box sx={{ p: 1, backgroundColor: 'surface' }} />;`,
      `export const A = () => <div class="box p-1 bg-surface" />;`,
    ],
    [
      'opaque sx',
      `import { Box } from '@pkgs/ui';\nexport const A = (props: { sx: never }) => <Box sx={props.sx} />;`,
      `export const A = (props: { sx: never }) => <div class="box" style={{ ...((props.sx) ?? {}) }} />;`,
    ],
    [
      'nested primitives',
      `import { Box, Text } from '@pkgs/ui';\nexport const A = () => <Text label="x"><Box sx={{ m: 1 }} /></Text>;`,
      `export const A = () => <p class="text">{(\"x\") ?? (<><div class="box m-1" /></>)}</p>;`,
    ],
  ])('%s remains semantically stable', (_name, source, expected) => {
    const result = transformFile('snapshot.tsx', source);
    expect(result.parseError).toBeUndefined();
    expect(result.text.replace(/\s+/g, ' ').trim()).toBe(
      expected.replace(/\s+/g, ' ').trim()
    );
  });
});
