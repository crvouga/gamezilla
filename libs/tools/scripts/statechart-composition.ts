import {
  invokesOf,
  type MachineConfig,
  type SpecBundle,
  type StateConfig,
  walkStates,
} from '@crvouga/atlas';

export type AnalysisIssue = { rule: string; message: string };

function unique(
  seen: Set<string>,
  value: string,
  label: string,
  issues: AnalysisIssue[]
) {
  if (seen.has(value)) {
    issues.push({
      rule: 'unique',
      message: `${label} "${value}" occurs twice`,
    });
  }
  seen.add(value);
}

function references(
  name: string,
  node: StateConfig,
  files: ReadonlyMap<string, string>,
  issues: AnalysisIssue[]
) {
  const sources = node.meta?.source;
  if (!Array.isArray(sources) || sources.length === 0) {
    issues.push({
      rule: 'source',
      message: `${name}: source references are missing`,
    });
    return;
  }
  for (const source of sources) {
    if (typeof source !== 'string') {
      issues.push({
        rule: 'source',
        message: `${name}: source must be a file address`,
      });
      continue;
    }
    const address = source.split('#')[0] ?? '';
    const match = /^(.*?)(?::([0-9]+))?$/.exec(address);
    const path = match?.[1] ?? address;
    const text = files.get(path);
    if (text === undefined) {
      issues.push({
        rule: 'source',
        message: `${name}: ${source} does not exist`,
      });
    } else if (match?.[2]) {
      const line = Number(match[2]);
      if (line < 1 || line > text.split('\n').length) {
        issues.push({
          rule: 'source',
          message: `${name}: ${source} has no such line`,
        });
      }
    }
  }
}

function nodeProblems(
  name: string,
  node: StateConfig,
  links: string[],
  issues: AnalysisIssue[]
) {
  pureProblems(name, node, issues);
  const invoked = invokesOf(node);
  if (invoked.length > 1 || node.meta?.childMachine !== undefined) {
    issues.push({
      rule: 'composition',
      message: `${name}: use exactly one static invoke`,
    });
  }
  if (invoked.length && node.states) {
    issues.push({
      rule: 'composition',
      message: `${name}: invoke would replace its own states`,
    });
  }
  for (const invoke of invoked) links.push(invoke.src);
  if (node.id && node.id !== name) {
    issues.push({
      rule: 'identity',
      message: `${name}: id must equal its globally unique state name`,
    });
  }
  if (
    typeof node.meta?.description !== 'string' ||
    !node.meta.description.trim()
  ) {
    issues.push({
      rule: 'description',
      message: `${name}: a readable description is required`,
    });
  }
}

const STATE_KEYS = new Set([
  'id',
  'initial',
  'type',
  'meta',
  'states',
  'on',
  'invoke',
  'description',
]);
const INVOKE_KEYS = new Set(['src', 'id', 'onDone']);

function isStaticTarget(value: unknown) {
  if (typeof value === 'string') return value.length > 0;
  return (
    typeof value === 'object' &&
    value !== null &&
    'target' in value &&
    typeof value.target === 'string' &&
    value.target.length > 0 &&
    Object.keys(value).every((key) => key === 'target')
  );
}

function pureProblems(
  name: string,
  node: StateConfig,
  issues: AnalysisIssue[]
) {
  for (const key of Object.keys(node)) {
    if (!STATE_KEYS.has(key))
      issues.push({
        rule: 'pure',
        message: `${name}: unsupported state key "${key}"`,
      });
  }
  for (const [event, transition] of Object.entries(node.on ?? {})) {
    if (!isStaticTarget(transition))
      issues.push({
        rule: 'pure',
        message: `${name}: "${event}" must have one static target`,
      });
  }
  for (const invoke of invokesOf(node)) {
    if (
      typeof invoke.src !== 'string' ||
      Object.keys(invoke).some((key) => !INVOKE_KEYS.has(key))
    ) {
      issues.push({
        rule: 'pure',
        message: `${name}: invoke must name a static chart`,
      });
    }
    if (invoke.onDone !== undefined && !isStaticTarget(invoke.onDone)) {
      issues.push({
        rule: 'pure',
        message: `${name}: invoke completion must have one static target`,
      });
    }
  }
}

function chartProblems(machine: MachineConfig, issues: AnalysisIssue[]) {
  pureProblems(machine.id, machine, issues);
  if (invokesOf(machine).length || machine.meta?.childMachine !== undefined) {
    issues.push({
      rule: 'composition',
      message: `${machine.id}: invoke belongs inside a state`,
    });
  }
  if (Object.keys(machine.on ?? {}).length) {
    issues.push({
      rule: 'composition',
      message: `${machine.id}: chart-level transitions cannot be explored`,
    });
  }
}

function invocationProblems(
  bundle: SpecBundle,
  links: ReadonlyMap<string, string[]>,
  issues: AnalysisIssue[]
) {
  const counts = new Map(bundle.charts.map(({ machine }) => [machine.id, 0]));
  for (const targets of links.values()) {
    for (const target of targets) {
      if (!counts.has(target)) {
        issues.push({
          rule: 'composition',
          message: `Invoked chart "${target}" is absent`,
        });
      } else counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  const roots = [...counts]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  if (roots.length !== 1 || roots[0] !== bundle.root) {
    issues.push({
      rule: 'root',
      message: `Expected root "${bundle.root}" alone; found ${roots.join(', ') || 'none'}`,
    });
  }
  for (const [id, count] of counts) {
    if (id !== bundle.root && count !== 1) {
      issues.push({
        rule: 'composition',
        message: `Chart "${id}" must be invoked once; found ${count}`,
      });
    }
  }
  const reached = new Set<string>();
  const visit = (id: string, trail: string[]) => {
    if (trail.includes(id)) {
      issues.push({
        rule: 'composition',
        message: `Invoke cycle: ${[...trail, id].join(' → ')}`,
      });
      return;
    }
    if (reached.has(id)) return;
    reached.add(id);
    for (const next of links.get(id) ?? []) visit(next, [...trail, id]);
  };
  visit(bundle.root, []);
  for (const id of counts.keys()) {
    if (!reached.has(id))
      issues.push({
        rule: 'composition',
        message: `Chart "${id}" is outside the product root`,
      });
  }
}

/** Atlas maps states by name: ambiguous compositions must fail before traversal. */
export function compositionProblems(
  bundle: SpecBundle,
  sourceFiles?: ReadonlyMap<string, string>
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();
  const charts = new Set<string>();
  const links = new Map<string, string[]>();
  for (const { machine } of bundle.charts) {
    unique(charts, machine.id, 'Chart id', issues);
    unique(ids, machine.id, 'Global id', issues);
    chartProblems(machine, issues);
    const targets: string[] = [];
    links.set(machine.id, targets);
    if (sourceFiles) references(machine.id, machine, sourceFiles, issues);
    for (const { name, node } of walkStates(machine)) {
      unique(names, name, 'State name', issues);
      unique(ids, node.id ?? name, 'Global id', issues);
      nodeProblems(name, node, targets, issues);
      if (sourceFiles) references(name, node, sourceFiles, issues);
    }
  }
  invocationProblems(bundle, links, issues);
  const journeys = new Set<string>();
  for (const journey of bundle.journeys)
    unique(journeys, journey.name, 'Journey name', issues);
  return issues;
}
