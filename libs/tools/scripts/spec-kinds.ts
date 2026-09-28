/**
 * What may live in `specs/` and how the spec kinds besides Gherkin and Quint
 * bind to code. Pure over paths and file text, so `spec-packages.ts` does the
 * reading and this stays testable.
 *
 * `specs/` holds only `<context>/` directories, the shared kernel
 * (`ubiquitous-language.yml`), the conformance manifest (`conformance.yaml`)
 * and the combined rulebook (`README.md`). A context directory is flat:
 * its `ubiquitous-language.yml`, features, Quint models, DMN decision tables,
 * Alloy structures and OpenSLO objectives. A spec kind with no runner yet
 * (grammars, schemas) is refused — an unrun spec would be a false green.
 *
 * A decision table, structure or objective has exactly one binding in the
 * package that runs it, `tests/<dmn|alloy|openslo>/**` — an object with
 * `spec: '<stem>'` (read statically) — and that directory has an `index.ts`
 * entry importing the bindings.
 */

/** The files `specs/` itself may hold besides context directories. */
export const SPECS_ROOT_FILES: readonly string[] = [
  'ubiquitous-language.yml',
  'conformance.yaml',
  'README.md',
];

export type BindingKind = {
  readonly field: 'decisions' | 'structures' | 'objectives';
  readonly suffix: string;
  /** The binding directory: `tests/<dir>/`. */
  readonly dir: string;
  /** How a spec of this kind is named in problems. */
  readonly noun: string;
};

export const BINDING_KINDS: readonly BindingKind[] = [
  { field: 'decisions', suffix: '.dmn', dir: 'dmn', noun: 'decision table' },
  { field: 'structures', suffix: '.als', dir: 'alloy', noun: 'structure' },
  {
    field: 'objectives',
    suffix: '.openslo.yaml',
    dir: 'openslo',
    noun: 'objective file',
  },
];

/** Spec kinds the strategy names but nothing runs yet. */
const UNRUN_SUFFIXES: readonly string[] = ['.ebnf', '.schema.json'];

const CONTEXT_SUFFIXES: readonly string[] = [
  '.feature',
  '.qnt',
  ...BINDING_KINDS.map((kind) => kind.suffix),
];

const CONTEXT_FILES =
  'ubiquitous-language.yml, *.feature, *.qnt, *.dmn, *.als and *.openslo.yaml';

/** What is wrong with `specs/<name>` (a direct child of specs/), or null. */
export function specsRootEntryProblem(
  name: string,
  isDirectory: boolean
): string | null {
  if (isDirectory || SPECS_ROOT_FILES.includes(name)) return null;
  return `specs/${name}: specs/ holds only <context>/ directories, ${SPECS_ROOT_FILES.join(', ')}`;
}

/** What is wrong with `specs/<context>/<name>`, or null. */
export function contextEntryProblem(
  context: string,
  name: string,
  isDirectory: boolean
): string | null {
  const path = `specs/${context}/${name}`;
  if (isDirectory) {
    return `${path}/: specs/${context}/ is flat — no nested directories`;
  }
  const unrun = UNRUN_SUFFIXES.find((suffix) => name.endsWith(suffix));
  if (unrun !== undefined) {
    return `${path}: no runner checks *${unrun} specs yet — an unrun spec would be a false green; add its runner before the spec`;
  }
  if (
    name === 'ubiquitous-language.yml' ||
    CONTEXT_SUFFIXES.some((suffix) => name.endsWith(suffix))
  ) {
    return null;
  }
  return `${path}: a context holds only ${CONTEXT_FILES}`;
}

/** `specs/billing/access.dmn` → `access`. */
export function specStem(path: string, kind: BindingKind): string {
  return path.replace(/^.*\//, '').slice(0, -kind.suffix.length);
}

const SPEC_BINDING = /\bspec:\s*['"]([a-z0-9-]+)['"]/g;

export type BindingInput = {
  /** Repo-relative package directory. */
  readonly dir: string;
  readonly kind: BindingKind;
  /** Repo-relative spec paths of this kind the package runs. */
  readonly specs: readonly string[];
  /** Every `.ts` file under the package's `tests/<kind.dir>/`. */
  readonly files: readonly { readonly path: string; readonly text: string }[];
  readonly hasEntry: boolean;
};

function bindingsByStem(
  files: BindingInput['files']
): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  for (const file of files) {
    for (const match of file.text.matchAll(SPEC_BINDING)) {
      const stem = match[1] ?? '';
      out.set(stem, [...(out.get(stem) ?? []), file.path]);
    }
  }
  return out;
}

/**
 * Exactly one binding per spec, no binding for a spec the package does not
 * run, one stem per spec, and a `tests/<dir>/index.ts` entry when the package
 * runs any spec of the kind.
 */
export function bindingProblems(input: BindingInput): readonly string[] {
  const { dir, kind, specs } = input;
  const bindingDir = `${dir}/tests/${kind.dir}`;
  const out: string[] = [];
  if (specs.length > 0 && !input.hasEntry) {
    out.push(
      `${dir}: runs ${kind.noun}s (*${kind.suffix}) but has no tests/${kind.dir}/index.ts importing their bindings`
    );
  }
  const bindings = bindingsByStem(input.files);
  const stems = new Map<string, string[]>();
  for (const path of specs) {
    const stem = specStem(path, kind);
    stems.set(stem, [...(stems.get(stem) ?? []), path]);
    const files = bindings.get(stem) ?? [];
    if (files.length === 0) {
      out.push(
        `${path}: no binding — add a tests/${kind.dir}/${stem}.binding.ts with spec: '${stem}' under ${bindingDir}/`
      );
    } else if (files.length > 1) {
      out.push(`${path}: bound more than once (${files.join(', ')})`);
    }
  }
  for (const [stem, paths] of stems) {
    if (paths.length > 1) {
      out.push(
        `${paths.join(', ')}: ${kind.noun}s of one package share the name "${stem}" — a binding names one`
      );
    }
  }
  for (const [stem, files] of bindings) {
    if (!stems.has(stem)) {
      out.push(
        `${files.join(', ')}: binds ${kind.noun} "${stem}", which is not a specs/<domain>/${stem}${kind.suffix} this package runs`
      );
    }
  }
  return out;
}
