import { expect, test } from 'bun:test';
import { readRegistry } from '@pkgs/ui-codegen-server-ts/inventory-registry';

const MODULES: Record<string, string> = {
  'component-registry': `
    import { A_ENTRIES } from './registry-entries-a';
    import { B_ENTRIES } from './registry-entries-b';
    const ENTRIES = [...B_ENTRIES, ...A_ENTRIES];`,
  'registry-entries-a': `
    import ButtonExample from './button.example';
    const INPUTS = 'Inputs';
    export const A_ENTRIES = [entry('button', 'Button', INPUTS, ButtonExample)];`,
  'registry-entries-b': `
    import TitleExample from './screen-title.example';
    export const B_ENTRIES = [entry('screen-title', 'ScreenLargeTitle', 'Layout', TitleExample)];`,
  'button.example': `
    import { Button } from '@pkgs/ui-root-client-ts/button';
    import { ExampleRoot } from './example-root';
    import Other from './other.example';`,
  'screen-title.example': `import { ScreenBase } from './screen-base';`,
};

const EXPORTS: Record<string, readonly string[]> = {
  button: ['Button'],
  'screen-large-title': ['ScreenLargeTitle'],
};

test('entries come in spread order, each with the module it is about', () => {
  const registry = readRegistry(
    (m) => MODULES[m] ?? null,
    (m) => EXPORTS[m] ?? []
  );
  expect(registry).toEqual([
    {
      order: 1,
      id: 'screen-title',
      title: 'ScreenLargeTitle',
      category: 'Layout',
      exampleModule: 'screen-title.example',
      modules: ['screen-base'],
      primaryModule: 'screen-large-title',
    },
    {
      order: 2,
      id: 'button',
      title: 'Button',
      category: 'Inputs',
      exampleModule: 'button.example',
      modules: ['button', 'example-root'],
      primaryModule: 'button',
    },
  ]);
});
