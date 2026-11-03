// @io-wall-ok — Storybook build composition: reads story sources at config time
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const escape = (path: string): string =>
  path.replaceAll('\\', '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The production modules a product library's stories render: each story's
 * relative imports, minus story-only `.example` scaffolding. Extracting props
 * from every `libs/` source instead exhausts the docgen TypeScript program.
 */
function storyComponentFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.stories.tsx'))
    .flatMap((story) => {
      const text = readFileSync(join(directory, story), 'utf8');
      return [...text.matchAll(/from '(\.\/[^']+)'/g)]
        .map((match) => match[1] ?? '')
        .filter((specifier) => !specifier.endsWith('.example'))
        .map((specifier) => join(directory, dirname(story), `${specifier}.tsx`))
        .filter((file) => existsSync(file));
    });
}

/** Keep native prop extraction on production exports, not preview fixtures. */
export function configureDocgen(plugin: Plugin, directories: string[]): void {
  if (plugin.name !== 'storybook:solid-component-meta') return;
  const transform = plugin.transform;
  if (!transform || typeof transform !== 'object') return;
  const id = transform.filter?.id;
  if (typeof id !== 'object' || id instanceof RegExp || Array.isArray(id))
    throw new Error('The Solid docgen hook filter changed; review its scope');
  const excludes = id?.exclude ?? [];
  const isLibrary = (directory: string): boolean =>
    /[/\\]libs[/\\]/.test(directory);
  const roots = directories
    .filter((directory) => !isLibrary(directory))
    .map((directory) => `${escape(directory)}/.+\\.(?:tsx|jsx)`);
  const files = directories
    .filter(isLibrary)
    .flatMap(storyComponentFiles)
    .map(escape);
  transform.filter = {
    ...transform.filter,
    id: {
      ...id,
      include: new RegExp(`^(?:${[...roots, ...files].join('|')})$`),
      exclude: [
        ...(Array.isArray(excludes) ? excludes : [excludes]),
        /\.example\.tsx$/,
        /[/\\]storybook[/\\]fixtures[/\\]/,
      ],
    },
  };
}
