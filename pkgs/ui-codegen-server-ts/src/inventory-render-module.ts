/**
 * Renders one component module of the inventory: its registry entries, its
 * components and props, and what its markup says about states, ARIA,
 * events and keys.
 */
import { code, table } from './inventory-markdown';
import type {
  AttributeFact,
  ComponentFact,
  ModuleFact,
} from './inventory-types';

function list(label: string, values: readonly string[]): string[] {
  return values.length === 0
    ? []
    : [`- ${label}: ${values.map(code).join(', ')}`];
}

function attributeTable(
  title: string,
  facts: readonly AttributeFact[]
): string[] {
  if (facts.length === 0) return [];
  return [
    '',
    `**${title}**`,
    '',
    ...table(
      ['element', 'name', 'value'],
      facts.map((f) => [code(f.element), code(f.name), code(f.value)])
    ),
  ];
}

function componentBlock(component: ComponentFact): string[] {
  const inherited =
    component.foreignPropCount === 0
      ? ''
      : ` (+${component.foreignPropCount} inherited from DOM / library types)`;
  return [
    '',
    `#### ${code(component.name)} — ${component.props.length} props${inherited}`,
    '',
    ...table(
      ['prop', 'type', 'values', 'optional', 'default', 'doc'],
      component.props.map((p) => [
        code(p.name),
        code(p.type),
        p.values === null || p.values.join(' | ') === p.type
          ? ''
          : code(p.values.join(' | ')),
        p.optional ? 'yes' : '',
        p.defaultText === null ? '' : code(p.defaultText),
        p.doc,
      ])
    ),
  ];
}

/** The markdown for one module. */
export function renderModule(
  module: ModuleFact,
  entries: readonly string[]
): string[] {
  const m = module.markup;
  const ownKeys = m.keys;
  const viaShared = module.sharedKeys.filter((k) => !ownKeys.includes(k));
  return [
    `### ${code(module.module)}`,
    '',
    `- file: ${code(module.file)}`,
    `- registry: ${entries.length === 0 ? '**not imported by any registry example**' : entries.join('; ')}`,
    ...list('`data-component`', m.dataComponents),
    ...list('roles', m.roles),
    ...list(
      'keys compared here',
      ownKeys.map((k) => (k === ' ' ? 'Space' : k))
    ),
    ...list(
      'keys compared by imported logic',
      viaShared.map((k) => (k === ' ' ? 'Space' : k))
    ),
    ...(m.globalKeyListeners > 0
      ? [`- document / window key listeners: ${m.globalKeyListeners}`]
      : []),
    ...list('test ids', m.testIds),
    ...list('logic modules', m.sharedModules),
    ...list('classes', m.classes),
    ...module.components.flatMap(componentBlock),
    ...attributeTable('States (`classList` branches)', m.classListStates),
    ...attributeTable('ARIA', m.aria),
    ...attributeTable('DOM events', m.domEvents),
    ...attributeTable('`data-*` attributes', m.dataAttributes),
    ...attributeTable('`tabIndex`', m.tabIndex),
    '',
  ];
}
