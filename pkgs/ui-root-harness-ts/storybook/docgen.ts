import type { Plugin } from 'vite';

/** Keep native prop extraction on production exports, not preview fixtures. */
export function configureDocgen(plugin: Plugin, directories: string[]): void {
  if (plugin.name !== 'storybook:solid-component-meta') return;
  const transform = plugin.transform;
  if (!transform || typeof transform !== 'object') return;
  const id = transform.filter?.id;
  if (typeof id !== 'object' || id instanceof RegExp || Array.isArray(id))
    throw new Error('The Solid docgen hook filter changed; review its scope');
  const excludes = id?.exclude ?? [];
  const roots = directories
    .map((directory) =>
      directory.replaceAll('\\', '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('|');
  transform.filter = {
    ...transform.filter,
    id: {
      ...id,
      include: new RegExp(`^(?:${roots})/.+\\.(?:tsx|jsx)$`),
      exclude: [
        ...(Array.isArray(excludes) ? excludes : [excludes]),
        /\.example\.tsx$/,
        /[/\\]storybook[/\\]fixtures[/\\]/,
      ],
    },
  };
}
