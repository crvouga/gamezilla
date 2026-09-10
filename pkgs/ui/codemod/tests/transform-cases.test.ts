/**
 * Transform proof suite, layer 1: hand-written cases pinning every rule.
 *
 * Each case asserts the exact converted output (element, classes, style,
 * data attributes, import pruning) or the exact Tier C reason + TODO marker.
 */

import { describe, expect, test } from 'vitest';
import { transformFile } from '../transform';

const IMPORT = `import { Box } from '@pkgs/ui';\n`;

function run(body: string): ReturnType<typeof transformFile> {
  return transformFile('test.tsx', `${IMPORT}${body}`);
}

describe('Box Tier A', () => {
  test('static sx becomes classes, sx removed, import pruned', () => {
    const result = run(
      `export const A = () => <Box sx={{ p: 4, background: 'surface' }}>x</Box>;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted).toEqual([
      { line: 2, component: 'Box', tier: 'A' },
    ]);
    expect(result.text).toBe(
      `export const A = () => <div class="box p-4 bg-surface">x</div>;`
    );
  });

  test('as renames the element', () => {
    const result = run(
      `export const A = () => <Box as="section" sx={{ m: 2 }} />;`
    );
    expect(result.text).toContain('<section class="box m-2"');
    expect(result.text).not.toContain('as=');
  });

  test('dataSet materializes to data attributes', () => {
    const result = run(
      `export const A = () => <Box sx={{ flex: 1 }} dataSet={{ component: 'Card', src: 'x' }} />;`
    );
    expect(result.text).toContain('data-component="Card"');
    expect(result.text).toContain('data-src="x"');
    expect(result.text).not.toContain('dataSet');
  });

  test('does not inject host data-component on migrated nodes', () => {
    const result = run(
      `export const A = () => <Box sx={{ p: 1 }} dataSet={{ testid: 'x' }} />;`
    );
    expect(result.text).toContain('data-testid="x"');
    expect(result.text).not.toContain('data-component');
  });

  test('existing literal class merges after generated classes', () => {
    const result = run(
      `export const A = () => <Box sx={{ p: 1 }} class="extra" />;`
    );
    expect(result.text).toContain('class="box p-1 extra"');
  });

  test('passthrough props and handlers survive verbatim', () => {
    const result = run(
      `export const A = (p: { onClick: () => void }) => <Box sx={{ p: 1 }} id="a" aria-label="b" onClick={p.onClick} ref={undefined as never}>hi</Box>;`
    );
    expect(result.text).toContain('id="a"');
    expect(result.text).toContain('aria-label="b"');
    expect(result.text).toContain('onClick={p.onClick}');
    expect(result.text).toContain('>hi</div>');
  });

  test('Box without sx still converts (keeps the base class)', () => {
    const result = run(`export const A = () => <Box id="a" />;`);
    expect(result.converted.length).toBe(1);
    expect(result.text).toContain('<div class="box" id="a" />');
    expect(result.text).not.toContain('data-component');
  });

  test('solo backgroundColor becomes bg-* (not dropped)', () => {
    const result = run(
      `export const A = () => <Box sx={{ backgroundColor: 'surface' }} />;`
    );
    expect(result.text).toContain('class="box bg-surface"');
  });
});

describe('Box Tier B', () => {
  test('dynamic values move to style with exact units', () => {
    const result = run(
      `export const A = (p: { gap: number; w: number }) => <Box sx={{ p: 2, gap: p.gap, width: p.w, background: 'surface' }} />;`
    );
    expect(result.converted[0]?.tier).toBe('B');
    expect(result.text).toContain('class="box p-2 bg-surface"');
    expect(result.text).toContain('"gap": `${(p.gap) * 4}px`');
    expect(result.text).toContain('typeof (p.w)');
  });

  test('dynamic keyword splices verbatim', () => {
    const result = run(
      `export const A = (p: { d: 'flex' | 'block' }) => <Box sx={{ display: p.d }} />;`
    );
    expect(result.converted[0]?.tier).toBe('B');
    expect(result.text).toContain('"display": p.d');
  });

  test('dynamic class expression uses classList', () => {
    const result = run(
      `export const A = (p: { c: string }) => <Box sx={{ p: 1 }} class={p.c} />;`
    );
    expect(result.text).toContain('class="box p-1"');
    expect(result.text).toContain('classList={{ [p.c]: !!(p.c) }}');
    expect(result.text).not.toContain('cn(');
  });
  test('dynamic px pair fans out to two exact declarations', () => {
    const result = run(
      `export const A = (p: { x: number }) => <Box sx={{ px: p.x }} />;`
    );
    expect(result.converted[0]?.tier).toBe('B');
    expect(result.text).toContain('"padding-left": `${(p.x) * 4}px`');
    expect(result.text).toContain('"padding-right": `${(p.x) * 4}px`');
  });
});

describe('Box conversion edge cases', () => {
  test('identifier sx is safely normalized to a style object spread', () => {
    const result = run(
      `export const A = (p: { sx: never }) => <Box sx={p.sx} />;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted).toEqual([
      { line: 2, component: 'Box', tier: 'B' },
    ]);
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('class="box"');
    expect(result.text).toContain('style={{ ...((p.sx) ?? {}) }}');
    expect(result.text).not.toContain('style={p.sx}');
    expect(result.text).not.toContain('cn');
    expect(result.text).not.toContain('sxStyle');
    expect(result.text).not.toContain('TODO(sx-codemod)');
    expect(result.text).not.toContain('<Box');
  });

  test('spread attributes convert and keep the rest spread', () => {
    const result = run(
      `export const A = (p: { rest: never }) => <Box sx={{ p: 1 }} {...p.rest} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.converted[0]?.tier).toBe('A');
    expect(result.text).toContain('class="box p-1"');
    expect(result.text).toContain('{...p.rest}');
    expect(result.text).not.toContain('TODO(sx-codemod)');
  });

  test('sx arrays with conditional static objects use classList', () => {
    const result = run(
      `export const A = (p: { c: boolean }) => <Box sx={[{ p: 1 }, p.c ? { m: 1 } : null]} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.converted).toEqual([
      { line: 2, component: 'Box', tier: 'B' },
    ]);
    expect(result.text).toContain('class="box p-1"');
    expect(result.text).toContain('classList={{');
    expect(result.text).toContain('"m-1"');
    expect(result.text).not.toContain('cn');
    expect(result.text).not.toContain('sxStyle');
  });

  test('runtime-dropped props omit instead of approximating', () => {
    const result = run(
      `export const A = () => <Box sx={{ fontVariant: ['x'] as never }} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('<div class="box"');
  });

  test('dynamic dataSet uses dataAttrs without host component', () => {
    const result = run(
      `export const A = (p: { d: never }) => <Box sx={{ p: 1 }} dataSet={p.d} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('{...dataAttrs(p.d)}');
    expect(result.text).not.toContain('componentDataAttrs');
    expect(result.text).not.toContain('dataSet=');
  });
  test('non-intrinsic as falls back to div', () => {
    const result = run(
      `export const A = () => <Box as="DIV" sx={{ p: 1 }} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('<div class="box p-1"');
    expect(result.text).not.toContain('as=');
  });
  test('dataSet keys that are not data-attribute names use dataAttrs', () => {
    const result = run(
      `export const A = () => <Box sx={{ p: 1 }} dataSet={{ 'a b': 'x' }} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('dataAttrs');
    expect(result.text).not.toContain('componentDataAttrs');
  });
});

describe('Clickable', () => {
  const clickable = `import { Clickable } from '@pkgs/ui';\n`;
  test('becomes a real button with tint feedback by default', () => {
    const result = transformFile(
      't.tsx',
      `${clickable}export const A = () => <Clickable sx={{ p: 2 }}>x</Clickable>;`
    );
    expect(result.text).toContain(
      '<button class="clickable clickableTint p-2"'
    );
    expect(result.text).toContain('type="button"');
    expect(result.text).toContain('class="clickable clickableTint p-2"');
    expect(result.text).not.toContain('<Clickable');
    expect(result.text).not.toContain('Clickable }');
  });
  test('opacity and none feedback map exactly', () => {
    const base = `${clickable}export const A = () => <Clickable feedback="OP" />;`;
    expect(
      transformFile('t.tsx', base.replace('OP', 'opacity')).text
    ).toContain('class="clickable clickableOpacity"');
    expect(transformFile('t.tsx', base.replace('OP', 'none')).text).toContain(
      'class="clickable"'
    );
  });
  test('explicit type passes through', () => {
    const result = transformFile(
      't.tsx',
      `${clickable}export const A = () => <Clickable type="submit" />;`
    );
    expect(result.text).toContain('type="submit"');
  });
  test('dynamic feedback maps via classList', () => {
    const result = transformFile(
      't.tsx',
      `${clickable}export const A = (p: { f: 'tint' }) => <Clickable feedback={p.f} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('class="clickable"');
    expect(result.text).toContain('classList={{');
    expect(result.text).toContain('"clickableOpacity"');
    expect(result.text).toContain('"clickableTint"');
    expect(result.text).not.toContain('cn(');
  });
  test('unknown feedback defaults to tint', () => {
    const result = transformFile(
      't.tsx',
      `${clickable}export const A = () => <Clickable feedback="bogus" />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('class="clickable clickableTint"');
  });
});

describe('Text', () => {
  const text = `import { Text } from '@pkgs/ui';\n`;
  test('defaults to p with the text base class', () => {
    const result = transformFile(
      't.tsx',
      `${text}export const A = () => <Text sx={{ color: 'tint' }} label="hi" />;`
    );
    expect(result.text).toContain('<p class="text text-tint"');
    expect(result.text).toContain('>{"hi"}</p>');
  });
  test('as is respected over the variant host', () => {
    const result = transformFile(
      't.tsx',
      `${text}export const A = () => <Text as="span" label="hi" />;`
    );
    expect(result.text).toContain('<span class="text"');
  });
  test('label merges with existing children via ??', () => {
    const result = transformFile(
      't.tsx',
      `${text}export const A = (p: { t: string }) => <Text label={p.t}>fallback</Text>;`
    );
    expect(result.text).toContain('{(p.t) ?? (<>fallback</>)}');
  });
  test('static numberOfLines becomes line-clamp', () => {
    const result = transformFile(
      't.tsx',
      `${text}export const A = () => <Text numberOfLines={2} label="x" />;`
    );
    expect(result.text).toContain('line-clamp-2');
  });
  test('static variant maps to a semantic host + global class', () => {
    const result = transformFile(
      't.tsx',
      `${text}export const A = () => <Text variant="heading" label="x" />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('<h3 class="text textHeading"');
    expect(result.text).toContain('>{"x"}</h3>');
    expect(result.text).not.toContain('variant=');
  });
  test('title / label / mono pick their semantic elements', () => {
    expect(
      transformFile(
        't.tsx',
        `${text}export const A = () => <Text variant="title" label="t" />;`
      ).text
    ).toContain('<h1 class="text textTitle"');
    expect(
      transformFile(
        't.tsx',
        `${text}export const A = () => <Text variant="label" label="l" />;`
      ).text
    ).toContain('<label class="text textLabel"');
    expect(
      transformFile(
        't.tsx',
        `${text}export const A = () => <Text variant="mono" label="m" />;`
      ).text
    ).toContain('<code class="text textMono"');
  });
  test('dynamic variant uses classList for each text* class', () => {
    const result = transformFile(
      't.tsx',
      `${text}export const A = (p: { v: 'heading' }) => <Text variant={p.v} label="x" />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('<p class="text"');
    expect(result.text).toContain('classList={{');
    expect(result.text).toContain('"textHeading"');
    expect(result.text).not.toContain('cn(');
    expect(result.text).not.toContain('TEXT_VARIANT_CLASS');
    expect(result.text).not.toContain('TODO(sx-codemod)');
  });
});

describe('Stack / Center / Spacer', () => {
  test('Stack desugars layout props', () => {
    const result = transformFile(
      't.tsx',
      `import { Stack } from '@pkgs/ui';\nexport const A = () => <Stack direction="horizontal" spacing={2} align="center"><i /></Stack>;`
    );
    expect(result.text).toContain(
      '<div class="box flex-row gap-2 items-center"'
    );
    expect(result.text).not.toContain('data-component');
  });
  test('Stack with dynamic layout converts via style', () => {
    const result = transformFile(
      't.tsx',
      `import { Stack } from '@pkgs/ui';\nexport const A = (p: { d: 'horizontal' }) => <Stack direction={p.d} />;`
    );
    expect(result.manual).toEqual([]);
    expect(result.text).toContain('flexDirection');
    expect(result.text).toContain('horizontal');
  });
  test('Center pins both axes', () => {
    const result = transformFile(
      't.tsx',
      `import { Center } from '@pkgs/ui';\nexport const A = () => <Center>x</Center>;`
    );
    expect(result.text).toContain('class="box items-center justify-center"');
  });
  test('Spacer is a flex-1 div', () => {
    const result = transformFile(
      't.tsx',
      `import { Spacer } from '@pkgs/ui';\nexport const A = () => <Spacer />;`
    );
    expect(result.text).toContain('<div class="box flex-1"');
    expect(result.text).toContain('aria-hidden="true"');
  });
});

describe('Card / Divider peel', () => {
  test('Card peels to div with card base class', () => {
    const result = transformFile(
      't.tsx',
      `import { Card } from '@pkgs/ui';\nexport const A = () => <Card sx={{ p: 2 }}>x</Card>;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted).toEqual([
      { line: 2, component: 'Card', tier: 'A' },
    ]);
    expect(result.text).toContain('<div class="card p-2"');
    expect(result.text).not.toContain('<Card');
    expect(result.text).not.toContain('Card }');
  });

  test('Divider peels to div with divider base class', () => {
    const result = transformFile(
      't.tsx',
      `import { Divider } from '@pkgs/ui';\nexport const A = () => <Divider sx={{ my: 2 }} />;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted).toEqual([
      { line: 2, component: 'Divider', tier: 'A' },
    ]);
    expect(result.text).toContain('<div class="divider my-2"');
    expect(result.text).toContain('role="separator"');
    expect(result.text).not.toContain('<Divider');
  });
});

describe('behavior hosts and safety', () => {
  test('ScrollView frameSx becomes frameClass', () => {
    const result = transformFile(
      't.tsx',
      `import { ScrollView } from '@pkgs/ui';\nexport const A = () => <ScrollView frameSx={{ flex: 1 }}>x</ScrollView>;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted).toEqual([
      { line: 2, component: 'ScrollView', tier: 'A' },
    ]);
    expect(result.text).toContain('<ScrollView frameClass="flex-1">');
    expect(result.text).toContain('</ScrollView>');
    expect(result.text).not.toContain('frameSx');
    expect(result.text).toContain(`import { ScrollView } from '@pkgs/ui';`);
    expect(result.text).not.toContain('TODO(sx-codemod)');
  });

  test('ScrollView sx + frameSx both convert; import kept', () => {
    const result = transformFile(
      't.tsx',
      `import { ScrollView } from '@pkgs/ui';\nexport const A = () => <ScrollView sx={{ p: 2 }} frameSx={{ flex: 1 }}>x</ScrollView>;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted[0]?.component).toBe('ScrollView');
    expect(result.text).toContain('class="p-2"');
    expect(result.text).toContain('frameClass="flex-1"');
    expect(result.text).toContain('<ScrollView');
    expect(result.text).toContain(`import { ScrollView } from '@pkgs/ui';`);
    expect(result.text).not.toContain('sx=');
    expect(result.text).not.toContain('frameSx');
  });

  test('Motion enterSx becomes enterClass', () => {
    const result = transformFile(
      't.tsx',
      `import { Motion } from '@pkgs/ui';\nexport const A = () => <Motion enterSx={{ opacity: 0 }} sx={{ p: 1 }}>x</Motion>;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted[0]?.component).toBe('Motion');
    expect(result.text).toContain('<Motion');
    expect(result.text).toContain('class="p-1"');
    expect(result.text).toContain('enterClass="opacity-0"');
    expect(result.text).not.toContain('enterSx');
    expect(result.text).toContain(`import { Motion } from '@pkgs/ui';`);
  });

  test('ScrollView without sx is silently untouched', () => {
    const result = transformFile(
      't.tsx',
      `import { ScrollView } from '@pkgs/ui';\nexport const A = () => <ScrollView>x</ScrollView>;`
    );
    expect(result.manual).toEqual([]);
    expect(result.changed).toBe(false);
  });
  test('unparseable input returns a parse error and original text', () => {
    const result = transformFile(
      't.tsx',
      `import { Box } from '@pkgs/ui';\nexport const A = <Box sx={{ p: ;`
    );
    expect(result.parseError).toBe('input does not parse');
    expect(result.changed).toBe(false);
  });
  test('import keeps unrelated specifiers', () => {
    const result = transformFile(
      't.tsx',
      `import { Box, Button } from '@pkgs/ui';\nexport const A = () => <><Box sx={{ p: 1 }} /><Button /></>;`
    );
    expect(result.text).toContain(`import { Button } from '@pkgs/ui';`);
    expect(result.text).not.toContain('Box,');
  });
  test('nested primitives convert independently', () => {
    const result = transformFile(
      't.tsx',
      `${IMPORT}export const A = () => <Box sx={{ p: 1 }}><Box sx={{ m: 2 }}>deep</Box></Box>;`
    );
    expect(result.converted.length).toBe(2);
    expect(result.text).toContain('<div class="box p-1"');
    expect(result.text).toContain('<div class="box m-2"');
  });
  test('aliased imports resolve to the export', () => {
    const result = transformFile(
      't.tsx',
      `import { Box as B } from '@pkgs/ui';\nexport const A = () => <B sx={{ p: 1 }} />;`
    );
    expect(result.converted).toEqual([
      { line: 2, component: 'Box', tier: 'A' },
    ]);
    expect(result.text).toContain('<div class="box p-1"');
  });
  test('as renames open and close tags', () => {
    const result = run(
      `export const A = () => <Box as="ul"><Box as="li" sx={{ p: 1 }}>x</Box></Box>;`
    );
    expect(result.text).toContain('<ul class="box"');
    expect(result.text).toContain('<li class="box p-1"');
    expect(result.text).toContain('</li>');
    expect(result.text).toContain('</ul>');
  });
  test('shadowed locals are never touched', () => {
    const result = transformFile(
      't.tsx',
      `${IMPORT}function Box(p: { x: number }) { return p.x; }
export const A = Box({ x: 1 });`
    );
    expect(result.changed).toBe(false);
  });
  test('unrelated nested const Box does not block outer JSX', () => {
    const result = transformFile(
      't.tsx',
      `${IMPORT}export const A = () => <Box sx={{ p: 1 }} />;
function inner() { const Box = 1; return Box; }`
    );
    expect(result.converted.length).toBe(1);
    expect(result.text).toContain('<div class="box p-1"');
  });
  test('parameter named Box shadows the import at that site', () => {
    const result = transformFile(
      't.tsx',
      `${IMPORT}export const A = (Box: number) => <Box sx={{ p: 1 }} />;`
    );
    expect(result.converted).toEqual([]);
    expect(result.changed).toBe(false);
  });
  test('Text label with nested Box converts leaf-first without throw', () => {
    const result = transformFile(
      't.tsx',
      `import { Box, Text } from '@pkgs/ui';
export const A = (p: { t: string }) => <Text label={p.t}><Box sx={{ p: 1 }}>x</Box></Text>;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.converted.length).toBe(2);
    expect(result.text).toContain('<p class="text"');
    expect(result.text).toContain('<div class="box p-1"');
    expect(result.text).toContain('{(p.t) ??');
    const again = transformFile('t.tsx', result.text);
    expect(again.text).toBe(result.text);
    expect(again.converted).toEqual([]);
  });
  test('relative ../box import converts and prunes', () => {
    const result = transformFile(
      't.tsx',
      `import { Box } from '../box';
export const A = () => <Box sx={{ p: 2 }} />;`
    );
    expect(result.converted).toEqual([
      { line: 2, component: 'Box', tier: 'A' },
    ]);
    expect(result.text).toContain('<div class="box p-2"');
    expect(result.text).not.toContain('../box');
  });
  test('unknown dynamic sx prop becomes Solid style entry (never dropped)', () => {
    const result = run(
      `export const A = (p: { x: number }) => <Box sx={{ notARealProp: p.x }} />;`
    );
    expect(result.converted[0]?.tier).toBe('B');
    expect(result.text).toContain('"not-a-real-prop"');
    expect(result.text).toContain('style={{');
    expect(result.text).not.toContain('cn');
    expect(result.text).not.toContain('sxStyle');
  });
  test('transform failures become parseError (never throw)', () => {
    const result = transformFile(
      't.tsx',
      `${IMPORT}export const A = () => <Box sx={{ p: 1 }} />;`
    );
    expect(result.parseError).toBe(undefined);
    expect(() => transformFile('t.tsx', result.text)).not.toThrow();
  });
  test('peels joinClass class expr into classList (no helper in output)', () => {
    const result = transformFile(
      't.tsx',
      `import { Box, joinClass } from '@pkgs/ui';
export const A = (p: { open: boolean }) => <Box class={joinClass('a', p.open && 'b')} sx={{ p: 1 }} />;`
    );
    expect(result.parseError).toBe(undefined);
    expect(result.text).toContain('classList={{');
    expect(result.text).toContain("['a']");
    expect(result.text).not.toContain('joinClass');
    expect(result.text).not.toContain('cn(');
  });
});
