/**
 * The `receipt.json` Alloy 6 writes after `alloy exec -t json`, as typed
 * results. A command appears in the receipt only if Alloy ran it; it carries
 * a `solution` with instances when the solver found one (SAT) and none when
 * no instance exists within the command's scope (UNSAT). For a `check` an
 * instance is a counterexample.
 */

/** `-1` when the command declares no `expect`. */
export type Expectation = -1 | 0 | 1;

export type CommandResult = {
  readonly name: string;
  readonly type: 'check' | 'run';
  /** The command as written (`check HostIsMember for 4`). */
  readonly source: string;
  readonly expects: Expectation;
  /** Whether the solver found an instance (a counterexample, for a check). */
  readonly sat: boolean;
  /** The first instance's atoms and field values, when {@link sat}. */
  readonly instance: InstanceValues | null;
};

/** Atom → field → tuples (without the atom itself), as the receipt has them. */
export type InstanceValues = Readonly<
  Record<string, Readonly<Record<string, readonly (readonly string[])[]>>>
>;

export type FieldInfo = {
  readonly name: string;
  /** The sig that declares it. */
  readonly owner: string;
  readonly arity: number;
  /**
   * The field's type as a union of products, each column a sig name:
   * `{Space->Person}` → `[['Space', 'Person']]`.
   */
  readonly types: readonly (readonly string[])[];
  readonly var: boolean;
};

export type ReceiptSig = {
  readonly name: string;
  readonly builtin: boolean;
  /** `set`, `one`, `lone`, `some`; `none` for an abstract sig. */
  readonly cardinality: string;
  readonly isEnum: boolean;
  /** `{Folder, User}` → `['Folder', 'User']` (a subset sig's parents). */
  readonly type: readonly string[];
  readonly fields: readonly FieldInfo[];
};

export type Receipt = {
  readonly commands: readonly CommandResult[];
  readonly sigs: readonly ReceiptSig[];
};

type Json = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectAt(value: Json, key: string): Json {
  const found = value[key];
  return isObject(found) ? found : {};
}

function stringAt(value: Json, key: string): string {
  const found = value[key];
  if (typeof found !== 'string') {
    throw new Error(`alloy receipt: expected "${key}" to be a string`);
  }
  return found;
}

/** `{Space->Person, Space->Place}` → `[['Space','Person'],['Space','Place']]`. */
export function parseAlloyType(type: string): readonly (readonly string[])[] {
  const inner = type.trim().replace(/^\{/, '').replace(/\}$/, '').trim();
  if (inner.length === 0) return [];
  return inner
    .split(',')
    .map((product) => product.split('->').map((column) => column.trim()));
}

function parseExpects(value: unknown): Expectation {
  return value === 0 || value === 1 ? value : -1;
}

function parseInstance(solution: unknown): InstanceValues | null {
  if (!Array.isArray(solution)) return null;
  for (const entry of solution) {
    if (!isObject(entry)) continue;
    const instances = entry['instances'];
    if (!Array.isArray(instances)) continue;
    const [first] = instances;
    if (isObject(first)) return objectAt(first, 'values') as InstanceValues;
  }
  return null;
}

function parseCommand(name: string, raw: unknown): CommandResult {
  if (!isObject(raw)) {
    throw new Error(`alloy receipt: command ${name} is not an object`);
  }
  const type = stringAt(raw, 'type');
  if (type !== 'check' && type !== 'run') {
    throw new Error(`alloy receipt: command ${name} has type "${type}"`);
  }
  const instance = parseInstance(raw['solution']);
  return {
    name,
    type,
    source: stringAt(raw, 'source'),
    expects: parseExpects(raw['expects']),
    sat: instance !== null,
    instance,
  };
}

function parseField(owner: string, raw: unknown): FieldInfo {
  const field = isObject(raw) ? raw : {};
  const arity = field['arity'];
  return {
    name: stringAt(field, 'name'),
    owner,
    arity: typeof arity === 'number' ? arity : 0,
    types: parseAlloyType(stringAt(field, 'type')),
    var: field['var'] === true,
  };
}

function parseSig(raw: unknown): ReceiptSig {
  const sig = isObject(raw) ? raw : {};
  const name = stringAt(sig, 'name');
  const cardinality = sig['cardinality'];
  return {
    name,
    builtin: sig['builtin'] === true,
    cardinality: typeof cardinality === 'string' ? cardinality : 'set',
    isEnum: sig['isEnum'] === true,
    type: parseAlloyType(stringAt(sig, 'type')).map((p) => p.join('->')),
    fields: Object.values(objectAt(sig, 'fields')).map((field) =>
      parseField(name, field)
    ),
  };
}

export function parseReceipt(json: unknown): Receipt {
  if (!isObject(json)) throw new Error('alloy receipt: not a JSON object');
  return {
    commands: Object.entries(objectAt(json, 'commands')).map(([name, raw]) =>
      parseCommand(name, raw)
    ),
    sigs: Object.values(objectAt(json, 'sigs')).map(parseSig),
  };
}

export type Verdict = { readonly pass: boolean; readonly detail: string };

/**
 * A `check` holds when Alloy finds no counterexample within its scope; a
 * `run` holds when Alloy finds an instance. A declared `expect` wins: `expect
 * 1` on a check asks for a counterexample, `expect 0` on a run for none.
 */
export function commandVerdict(command: CommandResult): Verdict {
  const wantsInstance =
    command.type === 'check' ? command.expects === 1 : command.expects !== 0;
  const pass = command.sat === wantsInstance;
  return { pass, detail: verdictDetail(command, pass) };
}

function verdictDetail(command: CommandResult, pass: boolean): string {
  const found =
    command.type === 'check'
      ? command.sat
        ? 'counterexample found'
        : 'no counterexample within scope'
      : command.sat
        ? 'instance found'
        : 'no instance within scope';
  const expected =
    command.expects === -1 ? '' : ` (expect ${String(command.expects)})`;
  const hint =
    pass || command.type === 'check' || command.sat
      ? ''
      : ' — the facts may contradict each other, or the scope is too small';
  return `${command.source}: ${found}${expected}${hint}`;
}

const INSTANCE_LINES = 40;

/** A counterexample or instance as one line per atom, integers left out. */
export function renderInstance(values: InstanceValues): string {
  const lines: string[] = [];
  for (const [atom, fields] of Object.entries(values)) {
    if (/^-?\d+$/.test(atom)) continue;
    const parts = Object.entries(fields).map(
      ([field, tuples]) =>
        `${field} = ${tuples.length === 0 ? 'none' : tuples.map((t) => t.join('->')).join(' + ')}`
    );
    lines.push(parts.length === 0 ? atom : `${atom}: ${parts.join(', ')}`);
  }
  const shown = lines.slice(0, INSTANCE_LINES);
  if (lines.length > INSTANCE_LINES) {
    shown.push(`… ${String(lines.length - INSTANCE_LINES)} more atoms`);
  }
  return shown.join('\n');
}
