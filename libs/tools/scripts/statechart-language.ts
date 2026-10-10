import { type Glossary, parseGlossary } from '@pkgs/gherkin-shared/glossary';
import type { ProductContract } from './statechart-contracts';

function readLanguages(
  sources: ReadonlyMap<string, string>
): Map<string, Glossary> {
  const glossaries = new Map<string, Glossary>();
  for (const [path, text] of sources) {
    if (
      !path.startsWith('specs/') ||
      !path.endsWith('/ubiquitous-language.yml')
    )
      continue;
    const domain =
      path === 'specs/ubiquitous-language.yml'
        ? null
        : (path.split('/')[1] ?? null);
    const parsed = parseGlossary(Bun.YAML.parse(text), path, domain);
    if (parsed.problems.length) throw new Error(parsed.problems.join('\n'));
    glossaries.set(domain ?? 'kernel', parsed.glossary);
  }
  return glossaries;
}

export function languageContracts(
  sources: ReadonlyMap<string, string>
): ProductContract[] {
  const glossaries = readLanguages(sources);
  return [...glossaries.values()].flatMap((glossary) =>
    glossary.terms.map((term) => {
      const owner = term.from ? glossaries.get(term.from) : glossary;
      const original = term.from
        ? owner?.terms.find((item) => item.term === term.term && !item.from)
        : term;
      if (!original)
        throw new Error(
          `${glossary.uri}: missing definition of ${term.term} from ${term.from}`
        );
      return {
        id: `${glossary.uri}#${term.term}`,
        name: `${glossary.context} — ${term.term}`,
        source: glossary.uri,
        description: glossary.purpose,
        steps: [
          {
            keyword: 'Meaning',
            text: original.definition ?? `Defined by ${original.source}`,
          },
          ...(term.from
            ? [{ keyword: 'From', text: owner?.context ?? term.from }]
            : []),
          ...(original.source
            ? [{ keyword: 'Authority', text: original.source }]
            : []),
        ],
      };
    })
  );
}

/** Keep unresolved product decisions visible inside the portable explorer. */
export function guideNotes(
  sources: ReadonlyMap<string, string>
): ProductContract[] {
  return ['specs/README.md', 'docs/statecharts/SPEC_CONFLICTS.md'].flatMap(
    (path) => {
      const text = sources.get(path);
      if (text === undefined) return [];
      return [
        {
          id: path,
          source: path,
          name:
            path === 'specs/README.md'
              ? 'Product contract inventory and specification standard'
              : 'Unresolved product decisions and contract gaps',
          steps: [
            {
              keyword: 'Read',
              text: 'Current authoritative scope and open decisions',
              docString: text,
            },
          ],
        },
      ];
    }
  );
}
