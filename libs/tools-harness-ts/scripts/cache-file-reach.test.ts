import { expect, test } from 'bun:test';
import { buildImportGraph, fileReach } from './cache-file-reach';

function graph(files: Record<string, string>) {
  return buildImportGraph(new Set(Object.keys(files)), (file) => files[file]!);
}

test('colocated stories and consumers resolve the same production slice', () => {
  const result = graph({
    'pkgs/ui-client-ts/src/button/index.tsx': "import { Text } from '../text';",
    'pkgs/ui-client-ts/src/text.tsx': '',
    'pkgs/ui-client-ts/src/button/button.stories.tsx':
      "import { Button } from './index'; import { Text } from '../text';",
    'libs/one-client-ts/src/screen.tsx':
      "import { Button } from '@pkgs/ui-client-ts/button';",
    'libs/two-client-ts/src/screen.tsx':
      "export { Button } from '@pkgs/ui-client-ts/button';",
  });
  expect(
    [
      ...result.importersOf.get('pkgs/ui-client-ts/src/button/index.tsx')!,
    ].sort()
  ).toEqual([
    'libs/one-client-ts/src/screen.tsx',
    'libs/two-client-ts/src/screen.tsx',
    'pkgs/ui-client-ts/src/button/button.stories.tsx',
  ]);
  expect(fileReach(result, 'pkgs/ui-client-ts/src/text.tsx').packages).toBe(3);
});

// regression: cache-import-resolution-repeated-specifiers
test('many consumers of one module share one resolution search', () => {
  const sources: Record<string, string> = {
    'pkgs/ui-client-ts/src/button/index.tsx': '',
  };
  for (let i = 0; i < 50; i++)
    sources[`libs/consumer-${i}-client-ts/src/screen.tsx`] =
      "import { Button } from '@pkgs/ui-client-ts/button';";
  const files = new Set(Object.keys(sources));
  const contains = files.has.bind(files);
  let probes = 0;
  files.has = (file) => {
    probes++;
    return contains(file);
  };
  const result = buildImportGraph(files, (file) => sources[file]!);
  expect(
    result.importersOf.get('pkgs/ui-client-ts/src/button/index.tsx')?.size
  ).toBe(50);
  expect(probes).toBeLessThanOrEqual(10);
});

test('resolution preserves extension precedence and resets for every source snapshot', () => {
  const consumer = 'libs/one-client-ts/src/screen.tsx';
  const files = {
    [consumer]: "import { Button } from '@pkgs/ui-client-ts/button';",
    'pkgs/ui-client-ts/src/button.ts': '',
    'pkgs/ui-client-ts/src/button/index.tsx': '',
  };
  expect([...graph(files).importersOf.keys()]).toEqual([
    'pkgs/ui-client-ts/src/button.ts',
  ]);
  expect([
    ...graph({ [consumer]: files[consumer] }).importersOf.keys(),
  ]).toEqual([]);
  expect([
    ...graph({
      [consumer]: files[consumer],
      'pkgs/ui-client-ts/src/button/index.tsx': '',
    }).importersOf.keys(),
  ]).toEqual(['pkgs/ui-client-ts/src/button/index.tsx']);
});
