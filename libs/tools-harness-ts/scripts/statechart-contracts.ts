import { parseDmn } from '@pkgs/dmn-shared-ts/model';
import { childElements, parseXml, textOf } from '@pkgs/dmn-shared-ts/xml';
import { parseFeature } from '@pkgs/gherkin-shared-ts/parse';

export type ContractStep = {
  keyword: string;
  text: string;
  table?: string[][];
  docString?: string;
};

export type ProductContract = {
  id: string;
  name: string;
  source: string;
  description?: string;
  steps: ContractStep[];
};

export function sourcePath(reference: string): string {
  return (
    reference.replace(/:\d+(?::\d+)?(?:#.*)?$/, '').split('#')[0] ?? reference
  );
}

function featureContracts(path: string, text: string): ProductContract[] {
  const feature = parseFeature(text, path);
  const examples = feature.scenarios.map((scenario) => ({
    id: `${path}:${scenario.line}`,
    name: `${feature.name} — ${scenario.name}`,
    source: `${path}:${scenario.line}`,
    description: feature.description.trim(),
    steps: scenario.steps.map((step) => ({
      keyword: step.keyword,
      text: step.text,
      ...(step.dataTable
        ? { table: step.dataTable.map((row) => [...row]) }
        : {}),
      ...(step.docString !== undefined ? { docString: step.docString } : {}),
    })),
  }));
  return [
    {
      ...documentContract(path, text),
      name: `${feature.name} — all rules and examples`,
      description: feature.description.trim(),
    },
    ...examples,
  ];
}

function decisionContracts(path: string, text: string): ProductContract[] {
  const parsed = parseDmn(text);
  if (!parsed.ok) throw new Error(`${path}: ${parsed.issues.join('; ')}`);
  const root = parseXml(text);
  const rows = childElements(root, 'decision').flatMap((decision) => {
    const model = parsed.definitions.decisions.find(
      (item) => item.id === decision.attributes.get('id')
    );
    const table = childElements(decision, 'decisionTable')[0];
    if (!model || !table) throw new Error(`${path}: missing decision table`);
    return childElements(table, 'rule').map((rule, index) => ({
      id: `${path}#${model.id}/${rule.attributes.get('id') ?? index}`,
      name: model.rules[index]?.description ?? model.name,
      source: path,
      description: model.description ?? model.name,
      steps: [
        ...childElements(rule, 'inputEntry').map((cell, column) => ({
          keyword: 'Given',
          text: `${model.inputs[column]?.label}: ${textOf(childElements(cell, 'text')[0] ?? cell).trim()}`,
        })),
        { keyword: 'When', text: model.name },
        ...childElements(rule, 'outputEntry').map((cell, column) => ({
          keyword: 'Then',
          text: `${model.outputs[column]?.name}: ${textOf(childElements(cell, 'text')[0] ?? cell).trim()}`,
        })),
      ],
    }));
  });
  return [documentContract(path, text), ...rows];
}

function documentContract(path: string, text: string): ProductContract {
  const first = text.split('\n').find((line) => line.trim().length > 0);
  return {
    id: path,
    name: path.replace(/^specs\//, ''),
    source: path,
    description: first?.replace(/^\s*(\/\/|#)\s*/, '') ?? path,
    steps: [
      { keyword: 'Contract', text: 'Authoritative source', docString: text },
    ],
  };
}

/** Compile the existing contracts, including every Background and Outline row. */
export function productContracts(
  sources: ReadonlyMap<string, string>
): ProductContract[] {
  return [...sources.entries()]
    .filter(([path]) => isProductContract(path))
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([path, text]) => {
      if (path.endsWith('.feature')) return featureContracts(path, text);
      if (path.endsWith('.dmn')) return decisionContracts(path, text);
      return [documentContract(path, text)];
    });
}

export function isProductContract(path: string): boolean {
  return (
    /\.(feature|qnt|dmn|als|openslo\.yaml)$/.test(path) ||
    path === 'specs/conformance.yaml'
  );
}
