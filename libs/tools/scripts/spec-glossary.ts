/**
 * Reads every bounded context's ubiquitous language (`specs/ubiquitous-language.yml`,
 * the shared kernel, and `specs/<domain>/ubiquitous-language.yml`) with the prose of
 * its features and the names of its Quint specs and Alloy structures (sigs
 * and fields, `spec-alloy-names.ts`, checked like Quint names), and holds the
 * specs to it (`@pkgs/gherkin/glossary`). Part of `check-specs.ts`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkLanguage,
  type FeatureProse,
  featureProse,
  type Glossary,
  parseGlossary,
  type QuintSpecNames,
} from '@pkgs/gherkin/glossary';
import { quintNames } from '@pkgs/quint/names';
import { alloyNames } from './spec-alloy-names';
import { REPO_ROOT, SPECS_DIR } from './spec-packages';

export const GLOSSARY_FILE = 'ubiquitous-language.yml';
export const KERNEL_GLOSSARY = `${SPECS_DIR}/${GLOSSARY_FILE}`;

function readGlossary(
  uri: string,
  domain: string | null,
  problems: string[]
): Glossary {
  const path = join(REPO_ROOT, uri);
  if (!existsSync(path)) {
    problems.push(
      `${uri}: missing — every bounded context declares its ubiquitous language (docs/SPEC_STANDARDS.md)`
    );
    return { uri, domain, context: '', purpose: '', terms: [] };
  }
  let data: unknown;
  try {
    data = Bun.YAML.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    problems.push(
      `${uri}: not YAML: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    return { uri, domain, context: '', purpose: '', terms: [] };
  }
  const parsed = parseGlossary(data, uri, domain);
  problems.push(...parsed.problems);
  return parsed.glossary;
}

function domains(): readonly string[] {
  const root = join(REPO_ROOT, SPECS_DIR);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function filesOf(domain: string, suffix: string): readonly string[] {
  return readdirSync(join(REPO_ROOT, SPECS_DIR, domain))
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => `${SPECS_DIR}/${domain}/${name}`);
}

/** Every way the specs step outside their bounded context's language. */
export function languageProblems(): readonly string[] {
  const problems: string[] = [];
  const kernel = readGlossary(KERNEL_GLOSSARY, null, problems);
  const glossaries = new Map<string, Glossary>();
  const features: FeatureProse[] = [];
  const quint: QuintSpecNames[] = [];
  for (const domain of domains()) {
    glossaries.set(
      domain,
      readGlossary(`${SPECS_DIR}/${domain}/${GLOSSARY_FILE}`, domain, problems)
    );
    for (const uri of filesOf(domain, '.feature')) {
      features.push({
        uri,
        domain,
        lines: featureProse(readFileSync(join(REPO_ROOT, uri), 'utf8')),
      });
    }
    for (const uri of filesOf(domain, '.qnt')) {
      quint.push({
        uri,
        domain,
        ...quintNames(readFileSync(join(REPO_ROOT, uri), 'utf8')),
      });
    }
    for (const uri of filesOf(domain, '.als')) {
      quint.push({
        uri,
        domain,
        module: null,
        imports: [],
        declarations: alloyNames(readFileSync(join(REPO_ROOT, uri), 'utf8')),
      });
    }
  }
  return [
    ...problems,
    ...checkLanguage({ kernel, glossaries, features, quint }),
  ];
}
