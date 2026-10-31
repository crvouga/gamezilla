import { expect, test } from 'bun:test';
import { readMarkup } from '@pkgs/ui-codegen-server-ts/inventory-markup';
import ts from 'typescript';

const source = (text: string) =>
  ts.createSourceFile(
    'x.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

const SWITCH = `
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { move } from '@pkgs/ui-root-shared-ts/roving-focus';
export function Switch(props) {
  const size = () => props.size ?? 'md';
  const onKey = (e) => { if (e.key === 'Home' || e.key === ' ') move(); };
  return (
    <button
      role="switch"
      aria-checked={props.value}
      classList={{ 'opacity-disabled': props.disabled === true }}
      class="clickable w-12"
      data-on={props.value ? 'true' : 'false'}
      data-testid="switch"
      onKeyDown={onKey}
      {...dataAttrs({ component: 'Switch', size: size(), ...props.dataSet })}
    >
      <Surface dataSet={{ component: 'SwitchTrack', testid: 'track', on: 'yes' }} />
      {[1, 2].join(' ')}
    </button>
  );
}`;

test('the markup of a module names its roles, states, keys and defaults', () => {
  const markup = readMarkup(source(SWITCH));
  expect(markup.dataComponents).toEqual(['Switch', 'SwitchTrack']);
  expect(markup.roles).toEqual(['switch']);
  expect(markup.aria).toEqual([
    { element: 'button', name: 'aria-checked', value: 'props.value' },
  ]);
  expect(markup.classListStates).toEqual([
    {
      element: 'button',
      name: 'opacity-disabled',
      value: 'props.disabled === true',
    },
  ]);
  expect(markup.classes).toEqual(['clickable', 'opacity-disabled', 'w-12']);
  expect(markup.dataAttributes).toEqual([
    {
      element: 'button',
      name: 'data-on',
      value: "props.value ? 'true' : 'false'",
    },
    { element: 'button', name: 'data-size', value: 'size()' },
    { element: 'Surface', name: 'data-on', value: "'yes'" },
  ]);
  expect(markup.testIds).toEqual(['"switch"', "'track'"]);
  expect(markup.domEvents.map((a) => a.name)).toEqual(['onKeyDown']);
  expect(markup.keys).toEqual([' ', 'Home']);
  expect([...markup.defaults]).toEqual([['size', "'md'"]]);
  expect(markup.sharedModules).toEqual(['component-id', 'roving-focus']);
});

// regression: inventory-parentless-program-nodes
test('compiler ASTs without parent pointers remain readable', () => {
  const file = ts.createSourceFile(
    'button.tsx',
    "dataAttrs({ component: 'Button' });",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  );
  expect(readMarkup(file).dataComponents).toEqual(['Button']);
});
