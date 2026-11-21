/**
 * Renders an inventory as markdown: counts first, then the registry, the
 * tokens, every component module and every literal, each as a table.
 */
import { code, table } from './inventory-markdown';
import { renderModule } from './inventory-render-module';
import type {
  Inventory,
  LiteralFact,
  LiteralKind,
  ModuleFact,
} from './inventory-types';

/** Modules reachable from a registry entry. */
function registeredModules(inventory: Inventory): Set<string> {
  return new Set(inventory.registry.flatMap((e) => e.modules));
}

function countsSection(inventory: Inventory): string[] {
  const components = inventory.modules.flatMap((m) => m.components);
  const dataNames = new Set(
    inventory.modules.flatMap((m) => m.markup.dataComponents)
  );
  const props = components.reduce((n, c) => n + c.props.length, 0);
  const registered = registeredModules(inventory);
  const unregistered = inventory.modules.filter(
    (m) => !registered.has(m.module)
  );
  const categories = new Set(inventory.registry.map((e) => e.category));
  return [
    '## Counts',
    '',
    ...table(
      ['what', 'count'],
      [
        ['registry entries', String(inventory.registry.length)],
        ['explorer categories', String(categories.size)],
        [
          'entries with no primary module',
          String(
            inventory.registry.filter((e) => e.primaryModule === null).length
          ),
        ],
        ['component modules', String(inventory.modules.length)],
        ['component modules no entry imports', String(unregistered.length)],
        ['exported components', String(components.length)],
        ['distinct `data-component` names', String(dataNames.size)],
        ['props (own, not inherited from DOM types)', String(props)],
        ['tokens in the token document', String(inventory.tokens.length)],
        [
          'custom properties in the compiled stylesheet',
          String(inventory.cssVars.length),
        ],
        ['literals in source', String(inventory.literals.length)],
        ['stylesheet rules', String(inventory.styles.length)],
      ]
    ),
  ];
}

function registrySection(inventory: Inventory): string[] {
  return [
    '## Registry',
    '',
    'Storybook entries in stable source-path order. CSF stories are the canonical catalog.',
    '',
    ...table(
      [
        '#',
        'id',
        'title',
        'category',
        'primary module',
        'modules the example imports',
      ],
      inventory.registry.map((e) => [
        String(e.order),
        code(e.id),
        e.title,
        e.category,
        e.primaryModule === null ? '**gap: none**' : code(e.primaryModule),
        e.modules.map(code).join(', '),
      ])
    ),
  ];
}

function tokensSection(inventory: Inventory): string[] {
  const blocks = [...new Set(inventory.cssVars.map((v) => v.block))];
  return [
    '## Tokens',
    '',
    'Every leaf of `pkgs/ui-root-shared-ts/src/design-tokens.json`, values exactly as written.',
    '',
    ...table(
      ['path', 'type', 'value', 'alias of', 'description'],
      inventory.tokens.map((t) => [
        code(t.path),
        t.type,
        code(t.value),
        t.alias === null ? '' : code(t.alias),
        t.description,
      ])
    ),
    '',
    '### Compiled custom properties',
    '',
    'Every custom property `pkgs/ui-root-client-ts/src/tokens.css` declares, per block.',
    '',
    ...blocks.flatMap((block) => [
      `#### ${code(block)}`,
      '',
      ...table(
        ['property', 'value'],
        inventory.cssVars
          .filter((v) => v.block === block)
          .map((v) => [code(v.name), code(v.value)])
      ),
      '',
    ]),
  ];
}

function modulesSection(inventory: Inventory): string[] {
  const entriesByModule = new Map<string, string[]>();
  for (const entry of inventory.registry) {
    for (const module of entry.modules) {
      const list = entriesByModule.get(module) ?? [];
      list.push(`#${entry.order} ${entry.title} (${entry.category})`);
      entriesByModule.set(module, list);
    }
  }
  return [
    '## Component modules',
    '',
    ...inventory.modules.flatMap((m: ModuleFact) =>
      renderModule(m, entriesByModule.get(m.module) ?? [])
    ),
  ];
}

const KIND_ORDER: readonly LiteralKind[] = [
  'color',
  'length',
  'duration',
  'z-index',
  'font',
  'easing',
  'opacity',
  'grid-utility',
  'numeric-constant',
];

function literalsSection(inventory: Inventory): string[] {
  const byKind = (kind: LiteralKind): LiteralFact[] =>
    inventory.literals.filter((l) => l.kind === kind);
  const distinct = (kind: LiteralKind): number =>
    new Set(byKind(kind).map((l) => l.literal)).size;
  return [
    '## Literals in source',
    '',
    'Visual values written in source rather than read from a token (comments excluded). Each is a candidate for a promoted core token.',
    '',
    ...table(
      ['kind', 'occurrences', 'distinct'],
      KIND_ORDER.map((k) => [k, String(byKind(k).length), String(distinct(k))])
    ),
    '',
    ...KIND_ORDER.flatMap((kind) => [
      `### ${kind}`,
      '',
      ...table(
        ['file', 'line', 'literal', 'context'],
        byKind(kind).map((l) => [
          code(l.file),
          String(l.line),
          code(l.literal),
          code(l.context),
        ])
      ),
      '',
    ]),
  ];
}

function stylesSection(inventory: Inventory): string[] {
  const files = [...new Set(inventory.styles.map((r) => r.file))];
  return [
    '## Stylesheet rules',
    '',
    'Every rule that declares something, with the at-rules it sits in: where each class, `data-*` state and token is painted.',
    '',
    ...files.flatMap((file) => [
      `### ${code(file)}`,
      '',
      ...table(
        ['at-rules', 'selector', 'declarations'],
        inventory.styles
          .filter((r) => r.file === file)
          .map((r) => [
            r.context === '' ? '' : code(r.context),
            code(r.selector),
            code(r.declarations.join('; ')),
          ])
      ),
      '',
    ]),
  ];
}

/** The inventory as one markdown document. */
export function renderInventory(inventory: Inventory): string {
  return `${[
    '# Design system inventory',
    '',
    `<!-- GENERATED by pkgs/ui-codegen-server-ts/scripts/inventory.ts from commit ${inventory.commit} — do not edit. -->`,
    '',
    `What the code says at commit \`${inventory.commit}\`, read mechanically before any of it is written as a spec. Storybook CSF metadata is the canonical component catalog.`,
    '',
    ...countsSection(inventory),
    '',
    ...registrySection(inventory),
    '',
    ...tokensSection(inventory),
    '',
    ...modulesSection(inventory),
    '',
    ...literalsSection(inventory),
    '',
    ...stylesSection(inventory),
  ].join('\n')}\n`;
}
