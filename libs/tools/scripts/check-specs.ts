#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`bun run spec:check`, `//#ci:specs`).
/**
 * The spec gate: `specs/` holds only spec kinds that run (`spec-kinds.ts`),
 * every `specs/<domain>/*.qnt` Quint model, `*.dmn` decision table, `*.als`
 * structure and `*.openslo.yaml` objective has exactly one binding, every `specs/<domain>/*.feature` scenario binds to exactly one step
 * definition, no definition is unused or pending, every scenario carries its
 * `@domain`, step text says intent (no UI mechanics, implementation words or
 * narrator), every scenario ends in an outcome with its context first, and the catalogs
 * are current, and no scenario has a BDD smell (`@pkgs/gherkin/smells`: a
 * long script, several events, acting after a Then outside journeys,
 * architecture words, a feature without a why), every Quint aggregate has
 * the offline-first shape (`model-shape.ts`), and every spec speaks its
 * bounded context's ubiquitous language (`spec-glossary.ts`: no avoided
 * synonym, no other context's term unless borrowed, every Quint name and
 * Alloy sig and field a glossary term, cross-context imports only of published events), and
 * nothing in specs/ but its rulebook points at code (`spec-decoupling.ts`, D1: no file path,
 * workspace package, source file, or tag outside the traceability allow-list),
 * and no spec package walks its harness at random outside a Quint replay
 * (`behavior-tests.ts`).
 * Near-duplicate wording is a
 * warning; `--strict-duplicates` makes it fail.
 *
 * Static: it parses features and reads `tests/steps/**` as text, so it runs
 * in well under a second and needs no harness.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SPEC_PARAMETER_TYPES } from '@libs/harness/spec/parameter-types';
import { checkSpecs } from '@pkgs/gherkin/check';
import { parameterTypeRegistryFrom } from '@pkgs/gherkin/registry';
import { nearDuplicates } from '@pkgs/gherkin/similarity';
import { specSmells } from '@pkgs/gherkin/smells';
import { randomWalkViolations } from './behavior-tests';
import { modelShapeProblems } from './model-shape';
import { campaignProblems, specCampaigns } from './spec-campaigns';
import { catalogDrift } from './spec-catalog';
import { decouplingProblems } from './spec-decoupling';
import { languageProblems, maintenanceVocabulary } from './spec-glossary';
import { specLocationProblems } from './spec-location';
import {
  externalSteps,
  REPO_ROOT,
  SPECS_DIR,
  sharedSteps,
  specPackages,
  specsLayoutProblems,
} from './spec-packages';

const strictDuplicates = process.argv.includes('--strict-duplicates');

/** The thresholds `specs/README.md` (§ The gate) states for a brief scenario. */
const SMELLS = {
  maxSteps: 8,
  maxActions: 3,
  journeyDomains: new Set(['journeys']),
  suspectWords: [
    'server',
    'servers',
    'backend',
    'client',
    'clients',
    'harness',
  ],
} as const;

const parameterTypes = parameterTypeRegistryFrom(SPEC_PARAMETER_TYPES);

const packages = specPackages();
const campaigns = specCampaigns(REPO_ROOT);
const campaignDomains = new Set(campaigns.map((campaign) => campaign.domain));
const shared = sharedSteps();
const external = externalSteps(packages);
const specFiles = [
  ...new Bun.Glob('**/*').scanSync({ cwd: join(REPO_ROOT, SPECS_DIR) }),
]
  .sort()
  .map((file) => ({
    path: `${SPECS_DIR}/${file}`,
    text: readFileSync(join(REPO_ROOT, SPECS_DIR, file), 'utf8'),
  }));
const outsideSpecFiles = ['apps', 'libs', 'pkgs'].flatMap((tier) =>
  [
    ...new Bun.Glob('**/*.{feature,qnt}').scanSync({
      cwd: join(REPO_ROOT, tier),
    }),
  ]
    .filter(
      (file) => !file.includes('/node_modules/') && !file.includes('/.cache/')
    )
    .map((file) => ({
      path: `${tier}/${file}`,
      text: readFileSync(join(REPO_ROOT, tier, file), 'utf8'),
    }))
);
const specDomains = new Set(
  readdirSync(join(REPO_ROOT, SPECS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${SPECS_DIR}/${entry.name}`)
);

const errors: string[] = [
  ...specLocationProblems(
    [...specFiles, ...outsideSpecFiles],
    specDomains,
    campaignDomains
  ),
  ...campaignProblems(REPO_ROOT, campaigns),
  ...specsLayoutProblems(packages),
  ...shared.problems,
  ...packages.flatMap((pkg) => pkg.problems),
  ...external.problems,
  ...checkSpecs({
    packages,
    external: external.steps,
    shared: shared.steps,
    parameterTypes,
    allowedImplementationWords: maintenanceVocabulary(),
  }),
  ...catalogDrift(packages, shared.steps),
  ...languageProblems(campaignDomains),
  ...modelShapeProblems(campaignDomains),
  ...randomWalkViolations(
    packages.flatMap((pkg) =>
      ['src', 'tests'].flatMap((root) =>
        [
          ...new Bun.Glob(`${root}/**/*.test.{ts,tsx}`).scanSync({
            cwd: join(REPO_ROOT, pkg.dir),
          }),
        ].map((file) => ({
          path: `${pkg.dir}/${file}`,
          text: readFileSync(join(REPO_ROOT, pkg.dir, file), 'utf8'),
        }))
      )
    )
  ),
  ...decouplingProblems(specFiles),
];

const allDefinitions = [
  ...shared.steps,
  ...external.steps,
  ...packages.flatMap((pkg) => pkg.definitions),
];
const duplicates = nearDuplicates(
  allDefinitions,
  (step) => step.text,
  (step) => step.kind
).map(
  (pair) =>
    `near-duplicate wording: "${pair.a.text}" (${pair.a.file}:${String(pair.a.line)}) vs "${pair.b.text}" (${pair.b.file}:${String(pair.b.line)})`
);

const hard = errors;
const uniqueSoft = [...new Set(duplicates)];
const smells = specSmells(
  packages.flatMap((pkg) => pkg.features),
  SMELLS
);

for (const warning of uniqueSoft) console.warn(`warning: ${warning}`);
if (
  hard.length > 0 ||
  smells.length > 0 ||
  (strictDuplicates && uniqueSoft.length > 0)
) {
  console.error('spec check failed:');
  for (const error of hard) console.error(`  ${error}`);
  if (strictDuplicates)
    for (const error of uniqueSoft) console.error(`  ${error}`);
  for (const smell of smells) console.error(`  smell: ${smell}`);
  process.exit(1);
}

const scenarios = packages.reduce(
  (n, pkg) => n + pkg.features.reduce((m, f) => m + f.scenarios.length, 0),
  0
);
const count = (of: (pkg: (typeof packages)[number]) => readonly unknown[]) =>
  String(packages.reduce((n, pkg) => n + of(pkg).length, 0));
console.log(
  `ok: ${String(packages.length)} packages, ${String(scenarios)} scenarios, ${count((p) => p.models)} Quint models, ${count((p) => p.decisions)} decision tables, ${count((p) => p.structures)} structures, ${count((p) => p.objectives)} objective files, ${String(allDefinitions.length)} step definitions, ${String(uniqueSoft.length)} wording warnings`
);
