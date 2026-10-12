import type { HtmlTagDescriptor, Plugin } from 'vite';

/** The slice of a Rollup output chunk the preload tags are derived from. */
export type PreloadChunk = {
  readonly type: 'chunk';
  readonly fileName: string;
  readonly facadeModuleId: string | null;
  readonly isEntry: boolean;
  readonly isDynamicEntry: boolean;
  readonly imports: readonly string[];
  readonly viteMetadata?:
    | { readonly importedCss: ReadonlySet<string> }
    | undefined;
};

type BundleOutput = PreloadChunk | { readonly type: 'asset' };

function isChunk(output: BundleOutput | undefined): output is PreloadChunk {
  return output !== undefined && output.type === 'chunk';
}

/** `root` and every chunk it statically imports, bar the page's own script. */
function staticClosure(
  bundle: Readonly<Record<string, BundleOutput>>,
  root: PreloadChunk
): PreloadChunk[] {
  const seen = new Set<string>();
  const closure: PreloadChunk[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const chunk = stack.pop() as PreloadChunk;
    if (seen.has(chunk.fileName)) continue;
    seen.add(chunk.fileName);
    if (!chunk.isEntry) closure.push(chunk);
    for (const name of chunk.imports) {
      const next = bundle[name];
      if (isChunk(next)) stack.push(next);
    }
  }
  return closure;
}

/**
 * `<link>` tags that make `index.html` fetch a dynamically imported entry —
 * its scripts and styles — alongside the script that imports it. Without
 * them the browser learns of the entry only after the importing script has
 * downloaded and run, so the two load one after the other.
 */
export function dynamicEntryPreloadTags(args: {
  readonly bundle: Readonly<Record<string, BundleOutput>>;
  /** Source path suffix of the dynamic entry, e.g. `/src/main.tsx`. */
  readonly entry: string;
  readonly base: string;
}): HtmlTagDescriptor[] {
  const root = Object.values(args.bundle).find(
    (output): output is PreloadChunk =>
      isChunk(output) &&
      output.isDynamicEntry &&
      output.facadeModuleId?.endsWith(args.entry) === true
  );
  if (root === undefined) return [];
  const chunks = staticClosure(args.bundle, root);
  const styles = new Set(
    chunks.flatMap((chunk) => [...(chunk.viteMetadata?.importedCss ?? [])])
  );
  return [
    ...chunks.map((chunk) => ({
      tag: 'link',
      attrs: {
        rel: 'modulepreload',
        crossorigin: true,
        href: `${args.base}${chunk.fileName}`,
      },
      injectTo: 'head' as const,
    })),
    ...[...styles].map((file) => ({
      tag: 'link',
      attrs: {
        rel: 'preload',
        as: 'style',
        crossorigin: true,
        href: `${args.base}${file}`,
      },
      injectTo: 'head' as const,
    })),
  ];
}

/**
 * Build plugin: `index.html` preloads the dynamic entry whose source path
 * ends with `entry`, in parallel with the script that imports it.
 */
export function preloadDynamicEntry(entry: string): Plugin {
  let base = '/';
  return {
    name: 'preload-dynamic-entry',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.bundle === undefined) return [];
        // Vite already preloads what the page's own script imports.
        return dynamicEntryPreloadTags({
          bundle: ctx.bundle,
          entry,
          base,
        }).filter(
          (tag) => !html.includes(`href="${String(tag.attrs?.['href'])}"`)
        );
      },
    },
  };
}
