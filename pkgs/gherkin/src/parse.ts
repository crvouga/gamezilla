/**
 * Feature file → scenarios, on the official Gherkin parser. A scenario here is
 * a compiled pickle (Background folded in, Outline rows expanded) with the
 * keyword and line of every step kept for reports.
 */

import {
  AstBuilder,
  compile,
  GherkinClassicTokenMatcher,
  Parser,
} from '@cucumber/gherkin';
import {
  type FeatureChild,
  IdGenerator,
  type Pickle,
  type Step,
} from '@cucumber/messages';

export type StepType = 'Context' | 'Action' | 'Outcome' | 'Unknown';

export type SpecStep = {
  /** Keyword as written, trimmed: `Given`, `And`, `*`, … */
  readonly keyword: string;
  /** Resolved kind (`And` / `But` take the previous step's). */
  readonly type: StepType;
  readonly text: string;
  readonly line: number;
  readonly docString: string | undefined;
  readonly dataTable: readonly (readonly string[])[] | undefined;
};

export type SpecScenario = {
  /** Source declaration, shared by every expanded row of one outline. */
  readonly declarationLine: number;
  readonly declarationName: string;
  readonly name: string;
  readonly line: number;
  /** Feature tags folded in, as Gherkin does (`@domain:x`, `@regression:bug-1`). */
  readonly tags: readonly string[];
  readonly steps: readonly SpecStep[];
};

export type SpecFeature = {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly scenarios: readonly SpecScenario[];
};

type StepAst = { readonly keyword: string; readonly line: number };

function collectSteps(
  children: readonly FeatureChild[],
  into: Map<string, StepAst>
): void {
  for (const child of children) {
    const steps: readonly Step[] =
      child.background?.steps ?? child.scenario?.steps ?? [];
    for (const step of steps) {
      into.set(step.id, {
        keyword: step.keyword.trim(),
        line: step.location.line,
      });
    }
    if (child.rule !== undefined) {
      collectSteps(child.rule.children, into);
    }
  }
}

function scenarioLines(
  children: readonly FeatureChild[],
  into: Map<string, number>,
  names: Map<string, string>
): void {
  for (const child of children) {
    if (child.scenario !== undefined) {
      into.set(child.scenario.id, child.scenario.location.line);
      names.set(child.scenario.id, child.scenario.name);
      for (const examples of child.scenario.examples) {
        for (const row of examples.tableBody) {
          into.set(row.id, row.location.line);
          names.set(row.id, row.cells.map((cell) => cell.value).join(', '));
        }
      }
    }
    if (child.rule !== undefined) {
      scenarioLines(child.rule.children, into, names);
    }
  }
}

function toScenario(
  pickle: Pickle,
  stepAst: ReadonlyMap<string, StepAst>,
  lines: ReadonlyMap<string, number>,
  names: ReadonlyMap<string, string>
): SpecScenario {
  const firstNode = pickle.astNodeIds[0] ?? '';
  const lastNode = pickle.astNodeIds[pickle.astNodeIds.length - 1] ?? '';
  const declarationName = names.get(firstNode) ?? pickle.name;
  const name =
    firstNode !== lastNode && declarationName === pickle.name
      ? `${pickle.name} [${names.get(lastNode) ?? lastNode}]`
      : pickle.name;
  return {
    name,
    declarationName,
    declarationLine: lines.get(pickle.astNodeIds[0] ?? '') ?? 0,
    line: lines.get(lastNode) ?? 0,
    tags: pickle.tags.map((tag) => tag.name),
    steps: pickle.steps.map((step) => {
      const ast = stepAst.get(step.astNodeIds[0] ?? '');
      return {
        keyword: ast?.keyword ?? '*',
        type: (step.type ?? 'Unknown') as StepType,
        text: step.text,
        line: ast?.line ?? 0,
        docString: step.argument?.docString?.content,
        dataTable: step.argument?.dataTable?.rows.map((row) =>
          row.cells.map((cell) => cell.value)
        ),
      };
    }),
  };
}

/** Parse one feature file. Throws a Gherkin parse error with line numbers. */
export function parseFeature(source: string, uri: string): SpecFeature {
  const newId = IdGenerator.incrementing();
  const parser = new Parser(
    new AstBuilder(newId),
    new GherkinClassicTokenMatcher()
  );
  const document = parser.parse(source);
  document.uri = uri;
  const feature = document.feature;
  if (feature === undefined) {
    return { uri, name: '', description: '', tags: [], scenarios: [] };
  }
  const stepAst = new Map<string, StepAst>();
  collectSteps(feature.children, stepAst);
  const lines = new Map<string, number>();
  const names = new Map<string, string>();
  scenarioLines(feature.children, lines, names);
  const pickles = compile(document, uri, newId);
  return {
    uri,
    name: feature.name,
    description: feature.description.trim(),
    tags: feature.tags.map((tag) => tag.name),
    scenarios: pickles.map((pickle) =>
      toScenario(pickle, stepAst, lines, names)
    ),
  };
}
