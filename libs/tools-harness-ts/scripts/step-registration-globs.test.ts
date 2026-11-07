import { expect, test } from 'bun:test';
import { stepRegistrationGlobs } from './step-registration-globs';

// regression: glob-journey-step-discovery
test('the shared journey entry exposes its literal sibling registration glob', () => {
  expect(
    stepRegistrationGlobs(`
const journeyModules = new Bun.Glob('*-journey.steps.ts').scanSync(
  import.meta.dir
);
for (const file of [...journeyModules].sort()) await import(\`./\${file}\`);
`)
  ).toEqual(['*-journey.steps.ts']);
});

test('comments, unrelated scans and nonliteral patterns do not register modules', () => {
  expect(
    stepRegistrationGlobs(`
// new Bun.Glob('comment.steps.ts').scanSync(import.meta.dir)
new Bun.Glob(pattern).scanSync(import.meta.dir);
new Bun.Glob('other.steps.ts').scanSync('/other-directory');
`)
  ).toEqual([]);
});
