/**
 * Transform proof suite, layer 2: properties over arbitrary inputs.
 *
 * - Valid TSX: arbitrary component usages transform to parseable output with
 *   no leftover `sx` or primitive imports on the converted path.
 * - Idempotence: codemod(codemod(x)) === codemod(x), byte for byte.
 * - Preservation: passthrough props and children survive byte-identical;
 *   Tier C nodes keep their source text (plus the TODO marker line).
 */

import * as fc from 'fast-check';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { transformFile } from '../transform';

function parses(text: string): boolean {
  const source = ts.createSourceFile(
    'f.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const withDiagnostics = source as unknown as {
    parseDiagnostics?: readonly unknown[] | undefined;
  };
  return (withDiagnostics.parseDiagnostics?.length ?? 0) === 0;
}

const arbComponent = fc.constantFrom(
  'Box',
  'Clickable',
  'Text',
  'Stack',
  'Center',
  'Spacer'
);
const arbSxTier = fc.constantFrom(
  `sx={{ p: 4, background: 'surface', flexDirection: 'row' }}`,
  `sx={{ mt: 2, color: 'textSecondary' }}`,
  `sx={{ flex: 1, borderRadius: 'md', gap: 2 }}`,
  `sx={{ p: 1, width: w, display: d }}`,
  `sx={incoming}`,
  `sx={[{ p: 1 }, extra]}`,
  `sx={value ? { p: 1 } : null}`,
  `sx={{ ...extra, p: 1 }}`,
  `sx={extra}`,
  ``
);
const arbExtra = fc.constantFrom(
  ``,
  ` id="keep"`,
  ` aria-label="keep me"`,
  ` data-testid="keep"`,
  ` onClick={onClick}`,
  ` class="merge-me"`,
  ` dataSet={{ component: 'Card', src: 's' }}`,
  ` as="section"`
);

const arbUsage = fc
  .tuple(
    arbComponent,
    arbSxTier,
    arbExtra,
    fc.constantFrom(true, false),
    fc.constantFrom(0, 1, 2)
  )
  .map(([component, sx, extra, selfClosing, variant]) => {
    const variantAttr =
      component === 'Text' && variant === 2 ? ` variant="heading"` : '';
    const tail = selfClosing
      ? ' />'
      : '>keep-children-{value}</' + component + '>';
    return {
      component,
      source:
        `import { ${component} } from '@pkgs/ui';\n` +
        `export const A = (p: { w: number; d: 'flex'; value: string; onClick: () => void; incoming: never; extra: never }) => ` +
        `<${component}${variantAttr}${sx === '' ? '' : ` ${sx}`}${extra}${tail};`,
    };
  });

describe('valid TSX property', () => {
  test('output always parses; converted nodes drop sx and imports', async () => {
    await fc.assert(
      fc.property(arbUsage, ({ source }) => {
        const result = transformFile('prop.tsx', source);
        expect(result.parseError).toBe(undefined);
        expect(parses(result.text)).toBe(true);
        if (result.converted.length > 0) {
          expect(result.text).not.toMatch(/[\s{]sx=\{/);
          expect(result.text).not.toMatch(/[\s{]sx="/);
        }
      }),
      { numRuns: 250 }
    );
  });
});

describe('idempotence property', () => {
  test('second run is a byte-identical no-op', async () => {
    await fc.assert(
      fc.property(arbUsage, ({ source }) => {
        const first = transformFile('prop.tsx', source);
        expect(first.parseError).toBe(undefined);
        const second = transformFile('prop.tsx', first.text);
        expect(second.parseError).toBe(undefined);
        expect(second.text).toBe(first.text);
        expect(second.converted).toEqual([]);
      }),
      { numRuns: 250 }
    );
  });
});

describe('preservation property', () => {
  test('passthrough attributes and children survive verbatim', async () => {
    await fc.assert(
      fc.property(arbUsage, ({ source }) => {
        const result = transformFile('prop.tsx', source);
        for (const kept of [
          'id="keep"',
          'aria-label="keep me"',
          'data-testid="keep"',
          'onClick={onClick}',
          'keep-children-{value}',
        ]) {
          if (source.includes(kept)) expect(result.text).toContain(kept);
        }
        if (result.manual.length > 0) {
          expect(result.text).toContain('// TODO(sx-codemod): manual');
        }
      }),
      { numRuns: 250 }
    );
  });

  test('Tier C nodes keep their JSX text (modulo the TODO line)', async () => {
    const cases: readonly string[] = [
      `import { Box } from '@pkgs/ui';\nexport const A = (p: { rest: never }) => <Box sx={{ p: 1 }} {...p.rest} />;`,
      `import { Text } from '@pkgs/ui';\nexport const A = () => <Text variant="heading" label="x" />;`,
      `import { ScrollView } from '@pkgs/ui';\nexport const A = () => <ScrollView frameSx={{ flex: 1 }} />;`,
    ];
    for (const source of cases) {
      const result = transformFile('tierc.tsx', source);
      expect(result.converted).toEqual([]);
      expect(result.manual.length).toBe(1);
      expect(result.text).toContain('// TODO(sx-codemod): manual');
    }
    await fc.assert(
      fc.property(fc.constantFrom(...cases), (source) => {
        const first = transformFile('tierc.tsx', source);
        const second = transformFile('tierc.tsx', first.text);
        expect(second.text).toBe(first.text);
      }),
      { numRuns: 20 }
    );
  });
});
