/**
 * Keeps product specifications in `specs/` while allowing test-only Quint
 * machinery to stay beside the code that exercises it.
 */

export type SpecLocationFile = {
  readonly path: string;
  readonly text: string;
};

const META_MARKER = /^\/\/ @spec-meta(?:\s|$)/m;
const INTERPRETATION_MARKER = /^\/\/ @spec-interpretation(?:\s|$)/m;
const SOURCES = /^\/\/ Sources: (specs\/[a-z0-9-]+(?:, specs\/[a-z0-9-]+)*)$/m;

function canonicalProblems(file: SpecLocationFile): readonly string[] {
  if (/\.(?:[cm]?[jt]sx?)$/.test(file.path)) {
    return [
      `${file.path}: specs/ contains no implementation code — bindings, runners and interpretation live outside specs/`,
    ];
  }
  if (
    file.path.endsWith('.qnt') &&
    (META_MARKER.test(file.text) || INTERPRETATION_MARKER.test(file.text))
  ) {
    return [
      `${file.path}: test machinery and spec interpretations live outside specs/`,
    ];
  }
  return [];
}

function sourceDomains(text: string): readonly string[] {
  const match = SOURCES.exec(text);
  return match?.[1]?.split(', ') ?? [];
}

/** Canonical specs contain no code; test-only exceptions live outside them. */
export function specLocationProblems(
  files: readonly SpecLocationFile[],
  specDomains: ReadonlySet<string>
): readonly string[] {
  const problems: string[] = [];
  for (const file of files) {
    if (file.path.startsWith('specs/')) {
      problems.push(...canonicalProblems(file));
      continue;
    }
    if (file.path.endsWith('.feature')) {
      problems.push(
        `${file.path}: Gherkin product specifications live in specs/<domain>/`
      );
      continue;
    }
    if (!file.path.endsWith('.qnt')) continue;
    if (!file.path.includes('/tests/')) {
      problems.push(
        `${file.path}: Quint outside specs/ is allowed only as test machinery under tests/`
      );
      continue;
    }
    const meta = META_MARKER.test(file.text);
    const interpretation = INTERPRETATION_MARKER.test(file.text);
    const beginsWithMarker =
      file.text.startsWith('// @spec-meta') ||
      file.text.startsWith('// @spec-interpretation');
    if (meta === interpretation || !beginsWithMarker) {
      problems.push(
        `${file.path}: begin with exactly one of "// @spec-meta" or "// @spec-interpretation"`
      );
      continue;
    }
    if (!interpretation) continue;
    const sources = sourceDomains(file.text);
    if (sources.length === 0) {
      problems.push(
        `${file.path}: a spec interpretation must declare "// Sources: specs/<domain>[, specs/<domain>...]"`
      );
      continue;
    }
    for (const source of sources) {
      if (!specDomains.has(source)) {
        problems.push(
          `${file.path}: interpretation source ${source}/ does not exist`
        );
      }
    }
  }
  return problems;
}
