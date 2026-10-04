import { describe, expect, test } from 'bun:test';
import {
  BINDING_KINDS,
  type BindingKind,
  bindingProblems,
  contextEntryProblem,
  specsRootEntryProblem,
} from './spec-kinds';

const DMN = BINDING_KINDS.find((k) => k.field === 'decisions') as BindingKind;

describe('specs/ layout', () => {
  test('the root holds contexts, the kernel, the manifest and the rulebook', () => {
    for (const name of [
      'ubiquitous-language.yml',
      'conformance.yaml',
      'README.md',
    ]) {
      expect(specsRootEntryProblem(name, false)).toBeNull();
    }
    expect(specsRootEntryProblem('billing', true)).toBeNull();
    expect(specsRootEntryProblem('notes.txt', false)).toContain(
      'specs/notes.txt: specs/ holds only <context>/ directories'
    );
  });

  test('a context holds only spec kinds that run, flat', () => {
    for (const name of [
      'ubiquitous-language.yml',
      'a.feature',
      'a.qnt',
      'access.dmn',
      'spaces.als',
      'note-delivery.openslo.yaml',
    ]) {
      expect(contextEntryProblem('billing', name, false)).toBeNull();
    }
    expect(contextEntryProblem('billing', 'nested', true)).toBe(
      'specs/billing/nested/: specs/billing/ is flat — no nested directories'
    );
    expect(contextEntryProblem('billing', 'README.md', false)).toContain(
      'a context holds only'
    );
    expect(contextEntryProblem('billing', 'other.yaml', false)).toContain(
      'a context holds only'
    );
  });

  test('grammars and schemas are refused until a runner checks them', () => {
    for (const name of ['query.ebnf', 'invoice.schema.json']) {
      expect(contextEntryProblem('billing', name, false)).toContain(
        'no runner checks'
      );
    }
  });
});

describe('bindingProblems', () => {
  const binding = (path: string, stem: string) => ({
    path,
    text: `bindDecision({ spec: '${stem}', decide: () => 'yes' });`,
  });

  test('one binding per spec with an entry is clean', () => {
    expect(
      bindingProblems({
        dir: 'libs/billing',
        kind: DMN,
        specs: ['specs/billing/access.dmn'],
        files: [
          {
            path: 'libs/billing/tests/dmn/index.ts',
            text: "import './access.binding';",
          },
          binding('libs/billing/tests/dmn/access.binding.ts', 'access'),
        ],
        hasEntry: true,
      })
    ).toEqual([]);
  });

  test('a missing entry, a missing, doubled or stray binding are named', () => {
    const problems = bindingProblems({
      dir: 'libs/billing',
      kind: DMN,
      specs: ['specs/billing/access.dmn', 'specs/billing/refunds.dmn'],
      files: [
        binding('libs/billing/tests/dmn/a.binding.ts', 'refunds'),
        binding('libs/billing/tests/dmn/b.binding.ts', 'refunds'),
        binding('libs/billing/tests/dmn/c.binding.ts', 'gone'),
      ],
      hasEntry: false,
    });
    expect(problems).toEqual([
      'libs/billing: runs decision tables (*.dmn) but has no tests/dmn/index.ts loading their bindings',
      "specs/billing/access.dmn: no binding — add libs/billing/tests/dmn/access.binding.ts with spec: 'access' (tests/dmn/index.ts loads every *.binding.ts)",
      'specs/billing/refunds.dmn: bound more than once (libs/billing/tests/dmn/a.binding.ts, libs/billing/tests/dmn/b.binding.ts)',
      'libs/billing/tests/dmn/c.binding.ts: binds decision table "gone", which is not a specs/<domain>/gone.dmn this package runs',
    ]);
  });

  test('two specs of one package sharing a name are refused', () => {
    expect(
      bindingProblems({
        dir: 'libs/a',
        kind: DMN,
        specs: ['specs/a/access.dmn', 'specs/b/access.dmn'],
        files: [binding('libs/a/tests/dmn/access.binding.ts', 'access')],
        hasEntry: true,
      })
    ).toContainEqual(
      'specs/a/access.dmn, specs/b/access.dmn: decision tables of one package share the name "access" — a binding names one'
    );
  });
});
