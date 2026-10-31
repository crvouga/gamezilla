import { expect, test } from 'bun:test';
import { readRegistry } from '@pkgs/ui-codegen-server-ts/inventory-registry';

test('CSF metadata identifies production modules without executing stories', () => {
  const entries = readRegistry([
    {
      name: 'button.stories.tsx',
      text: `import { Button } from '../../ui-root-client-ts/src/button'; export default { title: 'Primitives/Button', component: Button }; export const Disabled = { args: { disabled: true } };`,
    },
  ]);
  expect(entries[0]).toMatchObject({
    id: 'button',
    title: 'Button',
    category: 'Primitives',
    modules: ['button'],
    primaryModule: 'button',
  });
});
test('missing CSF titles fail with the story file', () => {
  expect(() =>
    readRegistry([{ name: 'missing.stories.tsx', text: 'export default {}' }])
  ).toThrow('missing.stories.tsx');
});
