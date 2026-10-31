// @io-wall-ok — deterministic coverage report composition root
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import ts from 'typescript';
import { visualScenarios } from '../storybook/scenarios';
import { storyContract } from './storybook-contracts';
import { manifestErrors } from './storybook-manifests';
import {
  componentModule,
  components,
  files,
  imports,
  resolveComponentImport,
  source,
} from './storybook-source';

const root = slashPath(resolve(import.meta.dirname, '../../..'));
const harness = 'pkgs/ui-root-harness-ts/';
const packageFiles = files(resolve(root, 'pkgs'));
const all = [
  ...packageFiles,
  ...files(resolve(root, 'libs')),
  ...files(resolve(root, 'apps')),
].filter((f) => /\.[cm]?tsx?$/.test(f));
const parsed = all
  .filter((f) => componentModule(f.slice(root.length + 1)) !== null)
  .map((f) => ({ path: f.slice(root.length + 1), ast: source(f) }));
const references = all
  .filter((f) =>
    readFileSync(f, 'utf8').match(
      /-client-ts\/|storybook|\.example|\/fixtures\//
    )
  )
  .flatMap((f) =>
    imports(source(f)).map((i) => ({
      ...i,
      originalModule: i.module,
      module: resolveComponentImport(f.slice(root.length + 1), i.module),
      path: f.slice(root.length + 1),
    }))
  );
const stories = all.filter((f) =>
  /pkgs\/[^/]+-client-ts\/src\/.+\.stories\.tsx$/.test(f)
);
type IndexedStory = {
  id: string;
  type: string;
  title: string;
  importPath: string;
  name: string;
};
const index = JSON.parse(
  readFileSync(resolve(root, harness, '.cache/storybook/index.json'), 'utf8')
) as { entries: Record<string, IndexedStory> };
const indexedStories = Object.values(index.entries).filter(
  (entry) => entry.type === 'story'
);
const errors = manifestErrors(resolve(root, harness, '.cache/storybook'));
const edges = parsed.flatMap(({ path, ast }) =>
  imports(ast).map((i) => ({
    from: componentModule(path)!,
    to: resolveComponentImport(path, i.module),
  }))
);
function indirectCoverage(
  module: string,
  visited = new Set<string>()
): string[] {
  if (visited.has(module)) return [];
  visited.add(module);
  const result = references
    .filter(
      (r) =>
        r.module === module &&
        (r.path.endsWith('.example.tsx') || r.path.endsWith('.stories.tsx'))
    )
    .flatMap((r) =>
      stories.filter(
        (s) =>
          s === resolve(root, r.path) ||
          s.endsWith(
            r.path.split('/').at(-1)?.replace('.example.tsx', '.stories.tsx') ??
              '?'
          )
      )
    );
  for (const edge of edges.filter((e) => e.to === module))
    result.push(...indirectCoverage(edge.from, visited));
  return result;
}
type Reference = (typeof references)[number];
function storyCoverage(module: string, refs: Reference[]) {
  const fixtures = refs.filter((ref) => ref.path.endsWith('.example.tsx'));
  const fixtureNames = new Set(
    fixtures.map((ref) =>
      ref.path.split('/').at(-1)?.replace('.example.tsx', '.stories.tsx')
    )
  );
  const direct = new Set(
    refs
      .filter((ref) => ref.path.endsWith('.stories.tsx'))
      .map((ref) => ref.path)
  );
  const directCoverage = stories.filter(
    (path) =>
      fixtureNames.has(path.split('/').at(-1)) ||
      direct.has(path.slice(root.length + 1))
  );
  return {
    fixtures,
    coverage: [...new Set([...directCoverage, ...indirectCoverage(module)])],
  };
}
function indexedCoverage(coverage: string[]) {
  const paths = new Set(
    coverage.map((path) =>
      slashPath(path)
        .replace(`${root}/${harness}`, '')
        .replace(`${root}/pkgs/`, '../')
    )
  );
  return indexedStories.filter((entry) =>
    paths.has(
      entry.importPath.startsWith('./')
        ? entry.importPath.slice(2)
        : entry.importPath
    )
  );
}
function componentEntry(path: string, ast: ts.SourceFile, name: string) {
  const module = componentModule(path)!;
  const refs = references.filter(
    (ref) => ref.module === module && ref.name === name
  );
  const { fixtures, coverage } = storyCoverage(module, refs);
  const tests = refs
    .filter((ref) => ref.path.includes('/tests/'))
    .map((ref) => ref.path);
  const consumers = refs
    .filter(
      (ref) =>
        !ref.path.endsWith('.stories.tsx') &&
        !ref.path.endsWith('.example.tsx') &&
        !ref.path.includes('/storybook/') &&
        !ref.path.includes('/tests/')
    )
    .map((ref) => ref.path);
  const declaration = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
  );
  const docs = documentation(ast, declaration);
  if (!coverage.length && !name.endsWith('Provider'))
    errors.push(
      `${path}: ${name} is exported but has no story. Import the production component in a CSF story or fixture.`
    );
  const indexed = indexedCoverage(coverage);
  if (coverage.length && !indexed.length)
    errors.push(
      `${path}: ${name} has source stories but no usable Storybook index entry. Rebuild Storybook and fix the CSF exports.`
    );
  if (!docs && !name.endsWith('Provider'))
    errors.push(
      `${path}: document ${name}'s purpose and contract with source JSDoc.`
    );
  return {
    name,
    category: indexed[0]?.title.split('/')[0] ?? 'Context',
    storyIds: indexed.map((story) => story.id),
    module,
    implementation: path,
    fixtures: fixtures.map((fixture) => fixture.path),
    stories: coverage.map((story) => story.slice(root.length + 1)),
    tests: coverage.length
      ? [...new Set([...tests, `${harness}tests/storybook/stories.checks.ts`])]
      : tests,
    consumers,
    documented: docs,
  };
}
/** Compound exports share their module's documented contract. */
function documentation(
  ast: ts.SourceFile,
  declaration: ts.Node | undefined
): boolean {
  const comments = declaration ? ts.getJSDocCommentsAndTags(declaration) : [];
  if (
    comments.some(
      (comment) => comment.getText(ast).replace(/\s/g, '').length > 12
    )
  )
    return true;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    ast.text
  );
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const comment = scanner.getTokenText();
    if (
      comment.startsWith('/**') &&
      !comment.includes('@jsxImportSource') &&
      comment.length > 20
    )
      return true;
  }
  return false;
}
const entries = parsed.flatMap(({ path, ast }) =>
  components(ast).map((name) => componentEntry(path, ast, name))
);
for (const story of stories) {
  const contract = storyContract(story);
  const relative = story.slice(root.length + 1);
  const implementation =
    contract.component &&
    resolveComponentImport(relative, contract.component.module);
  const production = entries.find(
    (entry) =>
      entry.module === implementation && entry.name === contract.component?.name
  );
  if (!production)
    errors.push(
      `${relative}: CSF component must reference an exported production component, never a demonstration implementation.`
    );
  else if (posix.dirname(relative) !== posix.dirname(production.implementation))
    errors.push(
      `${relative}: colocate this story with ${production.implementation}, its component styles and baselines.`
    );
  if (!contract.exports.length || !indexedCoverage([story]).length)
    errors.push(
      `${relative}: missing usable CSF story exports. Fix the exports and rebuild Storybook.`
    );
}
for (const ref of references) {
  if (
    ref.path.endsWith('.stories.tsx') ||
    ref.path.endsWith('.example.tsx') ||
    ref.path.includes('/tests/') ||
    ref.path.includes('/storybook/') ||
    ref.path.includes('/scripts/')
  )
    continue;
  if (ref.originalModule.includes('/ui-root-client-ts/src/'))
    errors.push(
      `${ref.path}: use the supported public @pkgs/ui-root-client-ts module exports`
    );
  if (
    /^@pkgs\/(ui-root|ui-devtools|chess-board-root|assistant|collab-ui)-client-ts\/[^/]+\//.test(
      ref.originalModule
    )
  )
    errors.push(
      `${ref.path}: ${ref.originalModule} bypasses the public component entrypoint. Import the component's single module name instead.`
    );
  if (
    /storybook|\/fixtures\/|\.(example|stories)(?:\.[cm]?tsx?)?$/.test(
      ref.module
    )
  )
    errors.push(
      `${ref.path}: ${ref.module} leaks preview infrastructure into production`
    );
}
const expectedBaselines = new Set(
  indexedStories.flatMap((story) =>
    visualScenarios(story).map((scenario) => scenario.baseline)
  )
);
const actualBaselines = new Set(
  packageFiles
    .filter(
      (file) => file.includes('/baselines/chromium/') && file.endsWith('.png')
    )
    .map((file) => file.slice(root.length + 1))
);
for (const baseline of expectedBaselines)
  if (!actualBaselines.has(baseline))
    errors.push(
      `${baseline}: missing visual baseline. Run the explicit Storybook baseline update, then compare without updating.`
    );
for (const baseline of actualBaselines)
  if (!expectedBaselines.has(baseline))
    errors.push(
      `${baseline}: orphan baseline. Remove it or restore its canonical story.`
    );
const report = {
  components: entries,
  storyFiles: stories.length,
  visualScenarios: expectedBaselines.size,
  errors,
};
const out = resolve(root, harness, '.cache');
mkdirSync(out, { recursive: true });
writeFileSync(
  resolve(out, 'storybook-coverage.json'),
  `${JSON.stringify(report, null, 2)}\n`
);
writeFileSync(
  resolve(out, 'storybook-coverage.md'),
  `# Storybook coverage\n\n${entries.length} component exports; ${stories.length} story files.\n\n| Category | Component | Implementation | Stories | Tests | Source JSDoc |\n| --- | --- | --- | --- | --- | --- |\n${entries.map((entry) => `| ${entry.category} | ${entry.name} | ${entry.implementation} | ${entry.storyIds.length} | ${entry.tests.length} | ${entry.documented ? 'yes' : 'no'} |`).join('\n')}\n\n${errors.join('\n')}\n`
);
console.log(
  `${entries.length} UI exports, ${stories.length} story files, ${errors.length} violations`
);
for (const error of errors) console.error(error);
if (errors.length) process.exitCode = 1;
