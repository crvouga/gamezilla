/**
 * The ubiquitous language of each bounded context. Every `specs/<domain>/` is
 * one bounded context and declares its language in `ubiquitous-language.yml`; the
 * shared kernel every context may speak is `specs/ubiquitous-language.yml`. A spec says
 * things only in its own context's language:
 *
 * - a feature never uses a term a glossary says to avoid, nor a term another
 *   context publishes (`published: true`) unless its glossary borrows it
 *   (`from: <domain>`) — only published terms can be borrowed;
 * - a Quint spec's product-facing names (types, variants, variables,
 *   actions, definitions) are the `model` names of its glossary's terms, or
 *   the published language of an upstream context it imports — only another
 *   context's `events.qnt` may be imported;
 * - a glossary names only model names its context's Quint specs declare.
 *
 * Pure: the caller reads the files (`libs/tools/scripts/spec-glossary.ts`).
 */

export type GlossaryTerm = {
  readonly term: string;
  readonly definition: string | null;
  /** An outside authority that defines the term (FIDE Laws of Chess, …). */
  readonly source: string | null;
  /** The upstream context whose definition this context borrows. */
  readonly from: string | null;
  /** Other spellings that are this term (inflections); plurals are implied. */
  readonly forms: readonly string[];
  /** Synonyms people reach for that the specs must not use. */
  readonly avoid: readonly string[];
  /**
   * The Quint names this term is in this context's models — for a borrowed
   * term too: the lender's model names never cross the boundary.
   */
  readonly model: readonly string[];
  /**
   * Part of the context's published language: other contexts may borrow it,
   * and may not use it unborrowed. A context's other terms are its own
   * business and constrain nobody else.
   */
  readonly published: boolean;
};

export type Glossary = {
  readonly uri: string;
  /** The `specs/<domain>/` it belongs to; null for the shared kernel. */
  readonly domain: string | null;
  readonly context: string;
  readonly purpose: string;
  readonly terms: readonly GlossaryTerm[];
};

export type ProseLine = { readonly line: number; readonly text: string };

export type FeatureProse = {
  readonly uri: string;
  readonly domain: string;
  readonly lines: readonly ProseLine[];
};

/** Structurally `QuintNames` from `@pkgs/quint/names`, plus where it lives. */
export type QuintSpecNames = {
  readonly uri: string;
  readonly domain: string;
  readonly module: string | null;
  readonly imports: readonly {
    readonly from: string;
    readonly line: number;
  }[];
  readonly declarations: readonly {
    readonly name: string;
    readonly kind: string;
    readonly line: number;
  }[];
};

export type LanguageInput = {
  readonly kernel: Glossary;
  /** One per `specs/<domain>/`, keyed by domain. */
  readonly glossaries: ReadonlyMap<string, Glossary>;
  readonly features: readonly FeatureProse[];
  readonly quint: readonly QuintSpecNames[];
};

/**
 * `from: kernel` names a shared-kernel term in a context's own models: the
 * term stays the kernel's, the `model` names are the context's.
 */
export const KERNEL = 'kernel';

/** The published language a context offers other contexts. */
export const EVENTS_MODULE = 'events';

const TERM_KEYS = new Set([
  'term',
  'definition',
  'source',
  'from',
  'forms',
  'avoid',
  'model',
  'published',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(
  value: unknown,
  where: string,
  problems: string[]
): readonly string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  if (!list.every((item) => typeof item === 'string' && item.trim() !== '')) {
    problems.push(`${where}: expected a string or a list of strings`);
    return [];
  }
  return list.map((item) => (item as string).trim());
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function parseTerm(
  raw: unknown,
  where: string,
  problems: string[]
): GlossaryTerm | null {
  if (!isRecord(raw)) {
    problems.push(`${where}: a term is a mapping with a "term" key`);
    return null;
  }
  const term = text(raw['term']);
  if (term === null) {
    problems.push(`${where}: missing "term"`);
    return null;
  }
  const at = `${where} (${term})`;
  for (const key of Object.keys(raw)) {
    if (!TERM_KEYS.has(key)) problems.push(`${at}: unknown key "${key}"`);
  }
  const parsed: GlossaryTerm = {
    term,
    definition: text(raw['definition']),
    source: text(raw['source']),
    from: text(raw['from']),
    forms: strings(raw['forms'], `${at}: forms`, problems),
    avoid: strings(raw['avoid'], `${at}: avoid`, problems),
    model: strings(raw['model'], `${at}: model`, problems),
    published: raw['published'] === true,
  };
  if (raw['published'] !== undefined && typeof raw['published'] !== 'boolean') {
    problems.push(`${at}: "published" is true or false`);
  }
  if (parsed.published && parsed.from !== null) {
    problems.push(`${at}: only the owning context publishes a term`);
  }
  if (parsed.from !== null) {
    if (parsed.definition !== null || parsed.source !== null) {
      problems.push(
        `${at}: a borrowed term (from: ${parsed.from}) takes its definition from there; drop "definition" / "source"`
      );
    }
    if (parsed.avoid.length > 0) {
      problems.push(
        `${at}: a borrowed term keeps its owner's "avoid"; declare it in ${parsed.from}'s glossary`
      );
    }
  } else if (parsed.definition === null && parsed.source === null) {
    problems.push(
      `${at}: needs a "definition", an outside "source", or "from: <domain>"`
    );
  }
  return parsed;
}

/** Validate a parsed `ubiquitous-language.yml`. */
export function parseGlossary(
  data: unknown,
  uri: string,
  domain: string | null
): { readonly glossary: Glossary; readonly problems: readonly string[] } {
  const problems: string[] = [];
  const empty: Glossary = { uri, domain, context: '', purpose: '', terms: [] };
  if (!isRecord(data)) {
    problems.push(`${uri}: expected a mapping with context, purpose and terms`);
    return { glossary: empty, problems };
  }
  const context = text(data['context']);
  const purpose = text(data['purpose']);
  if (context === null) problems.push(`${uri}: missing "context" (its name)`);
  if (purpose === null) {
    problems.push(`${uri}: missing "purpose" (why this context exists)`);
  }
  for (const key of Object.keys(data)) {
    if (!['context', 'purpose', 'terms'].includes(key)) {
      problems.push(`${uri}: unknown key "${key}"`);
    }
  }
  const rawTerms = Array.isArray(data['terms']) ? data['terms'] : [];
  if (!Array.isArray(data['terms'])) problems.push(`${uri}: "terms" is a list`);
  const terms: GlossaryTerm[] = [];
  const seen = new Map<string, number>();
  rawTerms.forEach((raw, index) => {
    const term = parseTerm(raw, `${uri}: terms[${String(index)}]`, problems);
    if (term === null) return;
    if (domain === null && term.from !== null) {
      problems.push(
        `${uri}: ${term.term}: the shared kernel defines its terms`
      );
    }
    const key = term.term.toLowerCase();
    const before = seen.get(key);
    if (before !== undefined) {
      problems.push(
        `${uri}: "${term.term}" is defined twice (terms[${String(before)}] and terms[${String(index)}])`
      );
    }
    seen.set(key, index);
    terms.push(term);
  });
  return {
    glossary: {
      uri,
      domain,
      context: context ?? '',
      purpose: purpose ?? '',
      terms,
    },
    problems,
  };
}

function escape(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

/**
 * `phrase` as a whole word or words, plural allowed. A capitalized phrase is
 * a name ("Plus", "Settings", "About") and matches only as written; any
 * other matches in any case ("Friend requests" at a sentence's start).
 */
function phrasePattern(phrase: string): RegExp {
  const flags = /^\p{Lu}/u.test(phrase) ? 'gu' : 'giu';
  return new RegExp(`(?<![\\w-])${escape(phrase)}(?:s|es)?(?![\\w-])`, flags);
}

type Vocabulary = {
  /** Terms a context may use: own, borrowed, kernel — with the owner's data. */
  readonly terms: readonly GlossaryTerm[];
  readonly borrowedFrom: ReadonlyMap<string, string>;
};

function ownerTerm(
  term: GlossaryTerm,
  glossaries: ReadonlyMap<string, Glossary>,
  kernel?: Glossary
): GlossaryTerm | null {
  if (term.from === null) return term;
  const owner = term.from === KERNEL ? kernel : glossaries.get(term.from);
  return (
    owner?.terms.find(
      (t) => t.term.toLowerCase() === term.term.toLowerCase() && t.from === null
    ) ?? null
  );
}

function vocabularyOf(domain: string, input: LanguageInput): Vocabulary {
  const own = input.glossaries.get(domain);
  const terms: GlossaryTerm[] = [...input.kernel.terms];
  const borrowedFrom = new Map<string, string>();
  for (const term of own?.terms ?? []) {
    const resolved = ownerTerm(term, input.glossaries);
    if (resolved === null) continue;
    terms.push(resolved);
    if (term.from !== null)
      borrowedFrom.set(term.term.toLowerCase(), term.from);
  }
  return { terms, borrowedFrom };
}

function phrasesOf(term: GlossaryTerm): readonly string[] {
  return [term.term, ...term.forms];
}

/** Why `term`, borrowed by `domain`, cannot be borrowed; null when it can. */
function lendingProblem(
  term: GlossaryTerm,
  domain: string,
  input: LanguageInput
): string | null {
  const from = term.from ?? '';
  if (from === domain) return 'borrows from itself';
  if (!input.glossaries.has(from)) {
    return `borrows from "${from}", which is not a specs/<domain>/`;
  }
  const owner = ownerTerm(term, input.glossaries);
  if (owner === null) {
    return `borrows from ${from}, whose glossary does not define it`;
  }
  if (!owner.published) {
    return `borrows from ${from}, which does not publish it (published: true there)`;
  }
  return null;
}

/** Why a context's `term` clashes with the shared kernel; null when it doesn't. */
function kernelProblem(
  term: GlossaryTerm,
  kernelTerms: ReadonlySet<string>,
  kernelUri: string
): string | null {
  const shared = kernelTerms.has(term.term.toLowerCase());
  if (term.from === KERNEL) {
    return shared ? null : `is not a shared-kernel term (${kernelUri})`;
  }
  return shared
    ? `is a shared-kernel term (${kernelUri}); drop it, or write "from: kernel" to name it in this context's models`
    : null;
}

function checkBorrowing(input: LanguageInput, errors: string[]): void {
  const kernelTerms = new Set(
    input.kernel.terms.map((t) => t.term.toLowerCase())
  );
  for (const [domain, glossary] of input.glossaries) {
    for (const term of glossary.terms) {
      const problem =
        kernelProblem(term, kernelTerms, input.kernel.uri) ??
        (term.from === null || term.from === KERNEL
          ? null
          : lendingProblem(term, domain, input));
      if (problem !== null) {
        errors.push(`${glossary.uri}: "${term.term}" ${problem}`);
      }
    }
  }
}

function checkAvoidConflicts(input: LanguageInput, errors: string[]): void {
  for (const glossary of [input.kernel, ...input.glossaries.values()]) {
    const vocabulary =
      glossary.domain === null
        ? input.kernel.terms
        : vocabularyOf(glossary.domain, input).terms;
    const words = new Set(
      vocabulary.flatMap((t) => phrasesOf(t).map((p) => p.toLowerCase()))
    );
    for (const term of glossary.terms) {
      for (const avoided of term.avoid) {
        if (words.has(avoided.toLowerCase())) {
          errors.push(
            `${glossary.uri}: "${term.term}" avoids "${avoided}", which is itself a term here`
          );
        }
      }
    }
  }
}

type Hit = { readonly phrase: string; readonly term: GlossaryTerm };

/** Blank every use of `terms` in `line`, longest phrase first. */
function maskTerms(line: string, terms: readonly GlossaryTerm[]): string {
  const phrases = terms.flatMap(phrasesOf).sort((a, b) => b.length - a.length);
  let out = line;
  for (const phrase of phrases) {
    out = out.replace(phrasePattern(phrase), (m) => ' '.repeat(m.length));
  }
  return out;
}

function foreignTerms(
  domain: string,
  input: LanguageInput
): ReadonlyMap<string, readonly GlossaryTerm[]> {
  const out = new Map<string, GlossaryTerm[]>();
  for (const [other, glossary] of input.glossaries) {
    if (other === domain) continue;
    out.set(
      other,
      glossary.terms.filter((t) => t.published)
    );
  }
  return out;
}

function checkFeature(
  feature: FeatureProse,
  input: LanguageInput,
  errors: string[]
): void {
  const vocabulary = vocabularyOf(feature.domain, input);
  const foreign = foreignTerms(feature.domain, input);
  const avoided: Hit[] = vocabulary.terms.flatMap((term) =>
    term.avoid.map((phrase) => ({ phrase, term }))
  );
  for (const prose of feature.lines) {
    const masked = maskTerms(prose.text, vocabulary.terms);
    const where = `${feature.uri}:${String(prose.line)}`;
    for (const hit of avoided) {
      const found = phrasePattern(hit.phrase).exec(masked);
      if (found !== null) {
        errors.push(
          `${where}: "${found[0].trim()}" — say "${hit.term.term}" (the glossary avoids "${hit.phrase}")`
        );
      }
    }
    for (const [owner, terms] of foreign) {
      for (const term of terms) {
        const found = phrasesOf(term)
          .map((phrase) => phrasePattern(phrase).exec(masked))
          .find((match) => match !== null);
        if (found === undefined || found === null) continue;
        errors.push(
          `${where}: "${found[0].trim()}" is ${owner}'s term; borrow it in specs/${feature.domain}/ubiquitous-language.yml (term: ${term.term}, from: ${owner}) or define this context's own`
        );
      }
    }
  }
}

/** Names Quint gives the model itself, and example data. */
function exemptName(name: string, kind: string): boolean {
  if (name === 'init' || name === 'step') return true;
  if (name.startsWith('_')) return true;
  if (kind === 'val' && /^inv[A-Z]/.test(name)) return true;
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

const EVENTS_IMPORT = /^(?:\.\/events|\.\.\/([a-z0-9-]+)\/events)$/;

function checkQuintSpec(
  spec: QuintSpecNames,
  input: LanguageInput,
  errors: string[]
): void {
  // A context names borrowed concepts in its own models; the lender's model
  // names are its own business and never cross the boundary.
  const allowed = new Set([
    ...input.kernel.terms.flatMap((t) => t.model),
    ...(input.glossaries.get(spec.domain)?.terms ?? []).flatMap((t) => t.model),
  ]);
  const isEvents = spec.uri.endsWith(`/${EVENTS_MODULE}.qnt`);
  for (const imported of spec.imports) {
    const where = `${spec.uri}:${String(imported.line)}`;
    const match = EVENTS_IMPORT.exec(imported.from);
    if (match === null) {
      errors.push(
        `${where}: imports "${imported.from}"; a context imports only published language — "./events" or "../<domain>/events"`
      );
      continue;
    }
    const upstream = match[1] ?? spec.domain;
    const events = input.quint.find(
      (q) => q.uri === `specs/${upstream}/${EVENTS_MODULE}.qnt`
    );
    if (events === undefined) {
      errors.push(
        `${where}: imports "${imported.from}", but specs/${upstream}/${EVENTS_MODULE}.qnt does not exist`
      );
      continue;
    }
    for (const declared of events.declarations) allowed.add(declared.name);
  }
  if (isEvents && spec.module !== EVENTS_MODULE) {
    errors.push(
      `${spec.uri}: the published language is "module ${EVENTS_MODULE}"`
    );
  }
  for (const declared of spec.declarations) {
    const where = `${spec.uri}:${String(declared.line)}`;
    if (isEvents && (declared.kind === 'var' || declared.kind === 'action')) {
      errors.push(
        `${where}: ${declared.kind} ${declared.name} — the published language declares types and values only`
      );
    }
    if (exemptName(declared.name, declared.kind)) continue;
    if (!allowed.has(declared.name)) {
      errors.push(
        `${where}: ${declared.kind} "${declared.name}" is not in the ubiquitous language — list it as a term's "model" in specs/${spec.domain}/ubiquitous-language.yml, or prefix a model helper with "_"`
      );
    }
  }
}

/** Names each context's Quint specs declare; `null` gathers every context. */
function declaredNames(
  input: LanguageInput
): ReadonlyMap<string | null, ReadonlySet<string>> {
  const out = new Map<string | null, Set<string>>([[null, new Set()]]);
  for (const spec of input.quint) {
    const names = out.get(spec.domain) ?? new Set<string>();
    for (const declared of spec.declarations) {
      names.add(declared.name);
      out.get(null)?.add(declared.name);
    }
    out.set(spec.domain, names);
  }
  return out;
}

function checkDanglingModels(input: LanguageInput, errors: string[]): void {
  const declared = declaredNames(input);
  for (const glossary of [input.kernel, ...input.glossaries.values()]) {
    const names = declared.get(glossary.domain) ?? new Set<string>();
    const scope =
      glossary.domain === null ? '' : `in specs/${glossary.domain}/ `;
    for (const term of glossary.terms) {
      for (const name of term.model.filter((n) => !names.has(n))) {
        errors.push(
          `${glossary.uri}: "${term.term}" names model "${name}", which no Quint spec ${scope}declares`
        );
      }
    }
  }
}

/** Every way the specs step outside their context's language. */
export function checkLanguage(input: LanguageInput): readonly string[] {
  const errors: string[] = [];
  checkBorrowing(input, errors);
  checkAvoidConflicts(input, errors);
  for (const feature of input.features) checkFeature(feature, input, errors);
  for (const spec of input.quint) checkQuintSpec(spec, input, errors);
  checkDanglingModels(input, errors);
  return errors;
}

const KEYWORD =
  /^\s*(?:Feature|Rule|Background|Scenario Outline|Scenario Template|Scenario|Example|Examples|Given|When|Then|And|But|\*)\s*:?\s*/;

/**
 * The prose of a feature file — its name, description, rules, scenario names
 * and steps — without tags, comments, tables (example data) or doc strings.
 */
export function featureProse(source: string): readonly ProseLine[] {
  const out: ProseLine[] = [];
  let inDocString = false;
  source.split('\n').forEach((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('"""') || trimmed.startsWith('```')) {
      inDocString = !inDocString;
      return;
    }
    if (inDocString || trimmed === '') return;
    if (/^[@#|]/.test(trimmed)) return;
    // Quoted text and outline placeholders are example data, not language.
    const text = trimmed
      .replace(KEYWORD, '')
      .replace(/"[^"]*"|“[^”]*”|<[^>]*>/g, (m) => ' '.repeat(m.length))
      .trim();
    if (text !== '') out.push({ line: index + 1, text });
  });
  return out;
}
