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

function canonicalProblems(
  file: SpecLocationFile,
  campaign: boolean
): readonly string[] {
  if (/\.(?:[cm]?[jt]sx?)$/.test(file.path)) {
    return [
      `${file.path}: specs/ contains no implementation code — bindings and runners live outside specs/`,
    ];
  }
  if (
    !campaign &&
    file.path.endsWith('.qnt') &&
    (META_MARKER.test(file.text) || INTERPRETATION_MARKER.test(file.text))
  ) {
    return [
      `${file.path}: marked Quint modules require a registered spec campaign domain`,
    ];
  }
  return [];
}

function sourceDomains(text: string): readonly string[] {
  const match = SOURCES.exec(text);
  return match?.[1]?.split(', ') ?? [];
}

function markedModelProblems(
  file: SpecLocationFile,
  specDomains: ReadonlySet<string>
): readonly string[] {
  const problems: string[] = [];
  const meta = META_MARKER.test(file.text);
  const interpretation = INTERPRETATION_MARKER.test(file.text);
  const beginsWithMarker =
    file.text.startsWith('// @spec-meta') ||
    file.text.startsWith('// @spec-interpretation');
  if (meta === interpretation || !beginsWithMarker) {
    problems.push(
      `${file.path}: begin with exactly one of "// @spec-meta" or "// @spec-interpretation"`
    );
    return problems;
  }
  if (!interpretation) return problems;
  if (!file.path.startsWith('specs/')) {
    problems.push(
      `${file.path}: product Quint interpretations live in specs/<domain>/`
    );
  }
  const sources = sourceDomains(file.text);
  if (sources.length === 0) {
    problems.push(
      `${file.path}: a spec interpretation must declare "// Sources: specs/<domain>[, specs/<domain>...]"`
    );
    return problems;
  }
  for (const source of sources) {
    if (!specDomains.has(source)) {
      problems.push(
        `${file.path}: interpretation source ${source}/ does not exist`
      );
    }
  }
  return problems;
}

/** Product models stay in specs/; framework fixtures remain beside their tests. */
export function specLocationProblems(
  files: readonly SpecLocationFile[],
  specDomains: ReadonlySet<string>,
  campaignDomains: ReadonlySet<string> = new Set()
): readonly string[] {
  return files.flatMap((file) => {
    const canonical = file.path.startsWith('specs/');
    if (canonical) {
      const campaign = campaignDomains.has(file.path.split('/')[1] ?? '');
      const problems = canonicalProblems(file, campaign);
      return campaign && file.path.endsWith('.qnt')
        ? [...problems, ...markedModelProblems(file, specDomains)]
        : problems;
    }
    if (file.path.endsWith('.feature')) {
      return [
        `${file.path}: Gherkin product specifications live in specs/<domain>/`,
      ];
    }
    if (!file.path.endsWith('.qnt')) return [];
    if (!file.path.includes('/tests/')) {
      return [
        `${file.path}: Quint outside specs/ is allowed only as test machinery under tests/`,
      ];
    }
    return markedModelProblems(file, specDomains);
  });
}
