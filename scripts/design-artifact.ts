/**
 * Renders the Gamezilla design-system artifact's `project/` files from this
 * repository: `design-system/` (tokens, brand rules, Spaces rules) and the
 * component library in `pkgs/ui-root-client-ts`. Pure over the texts it is
 * given; `design-sync.ts` reads them and writes the folder.
 *
 * The artifact reads tokens as lists (`{"tokens":[{name, value, usage}]}`),
 * so every token is taken from the generated `tokens.css`, by its CSS
 * variable name without the `--ui-` prefix: the name a designer sees in the
 * artifact is the variable the code uses.
 */

export type DesignSources = {
  /** `design-system/tokens.json`: the DTCG source, read for usage notes. */
  readonly tokenSource: string;
  /** `pkgs/ui-root-client-ts/src/tokens.css`, generated. */
  readonly tokensCss: string;
  /** `pkgs/ui-root-client-ts/src/tokens.json`, generated, values resolved. */
  readonly resolvedTokens: string;
  readonly readme: string;
  readonly spaces: string;
  /** Story files of the component library and their slice's `index.tsx`. */
  readonly components: readonly ComponentSource[];
  /** `owner/name`, linked from the published README. */
  readonly repo: string;
  /** Short commit sha the files were built from. */
  readonly commit: string;
  /** ISO date of the build. */
  readonly date: string;
};

export type ComponentSource = {
  /** Repo-relative path of the `*.stories.tsx` file. */
  readonly storyPath: string;
  readonly story: string;
  /** Text of the component module the story imports, if found. */
  readonly module: string | undefined;
  readonly modulePath: string | undefined;
};

export type ArtifactFile = { readonly path: string; readonly text: string };

type Token = { name: string; value: unknown; usage?: string };

const THEMES = ['dark', 'light'] as const;

function block(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`tokens.css has no ${selector} block`);
  const end = css.indexOf('\n}', start);
  const vars = new Map<string, string>();
  for (const match of css
    .slice(start, end)
    .matchAll(/^\s*--ui-([a-z0-9-]+):\s*([^;]+);/gm)) {
    vars.set(match[1] as string, (match[2] as string).trim());
  }
  return vars;
}

function resolve(value: string, ...scopes: Map<string, string>[]): string {
  return value.replace(/var\(--ui-([a-z0-9-]+)\)/g, (whole, name: string) => {
    for (const scope of scopes) {
      const found = scope.get(name);
      if (found !== undefined) return resolve(found, ...scopes);
    }
    return whole;
  });
}

const kebab = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `color-surface-muted` → the DTCG `$description` of `color.dark.surfaceMuted`. */
function colorUsage(source: Record<string, unknown>): Map<string, string> {
  const usage = new Map<string, string>();
  const color = source['color'] as Record<string, Record<string, unknown>>;
  for (const theme of THEMES) {
    for (const [name, token] of Object.entries(color[theme] ?? {})) {
      const description = (token as { $description?: string }).$description;
      if (name.startsWith('$') || !description) continue;
      const key = `color-${kebab(name)}`;
      if (!usage.has(key)) usage.set(key, description);
    }
  }
  return usage;
}

const FAMILY_BY_PREFIX: readonly (readonly [string, string])[] = [
  ['space-', 'spacing'],
  ['radius-', 'radius'],
  ['icon-size-', 'size'],
  ['control-size-', 'size'],
  ['max-width-', 'size'],
  ['opacity-', 'opacity'],
  ['breakpoint-', 'breakpoint'],
  ['layer-', 'zIndex'],
];

/** Spacing, radius, sizes and the other plain values of `:root`, by family. */
function lengthFamilies(root: Map<string, string>): Map<string, Token[]> {
  const families = new Map<string, Token[]>();
  for (const [name, raw] of root) {
    const family = FAMILY_BY_PREFIX.find(([prefix]) =>
      name.startsWith(prefix)
    )?.[1];
    if (!family) continue;
    const value = resolve(raw, root);
    if (/var\(|calc\(/.test(value)) continue;
    const list = families.get(family) ?? [];
    list.push({ name, value });
    families.set(family, list);
  }
  return families;
}

function renderTokens(sources: DesignSources): string {
  const root = block(sources.tokensCss, ':root');
  const themes = Object.fromEntries(
    THEMES.map((theme) => [
      theme,
      block(sources.tokensCss, `[data-theme="${theme}"]`),
    ])
  ) as Record<(typeof THEMES)[number], Map<string, string>>;
  const usage = colorUsage(JSON.parse(sources.tokenSource));

  const colors: Token[] = [];
  const shadows: Token[] = [];
  for (const [name, dark] of themes.dark) {
    const light = themes.light.get(name) ?? dark;
    const value = {
      dark: resolve(dark, themes.dark, root),
      light: resolve(light, themes.light, root),
    };
    if (name.startsWith('shadow-')) shadows.push({ name, value });
    else if (/^#[0-9a-f]{3,8}$/i.test(value.dark))
      colors.push({ name, value, usage: usage.get(name) ?? '' });
  }

  const families = lengthFamilies(root);
  const resolved = JSON.parse(sources.resolvedTokens) as {
    font: Record<string, string>;
    textStyle: Record<
      string,
      {
        fontFamily: string;
        fontSize: number;
        fontWeight: number;
        lineHeight: number;
      }
    >;
  };
  const familyKey = (stack: string) =>
    Object.entries(resolved.font).find(([, s]) => s === stack)?.[0] ?? 'sans';

  const tokens = {
    name: 'Gamezilla',
    version: 2,
    meta: {
      source: 'github',
      repo: sources.repo,
      ref: `main@${sources.commit}`,
      paths: {
        tokens: ['design-system/tokens.json'],
        docs: ['design-system/README.md', 'design-system/spaces.md'],
      },
      synced: sources.date,
    },
    color: {
      themes: [
        { id: 'dark', name: 'Dark' },
        { id: 'light', name: 'Light' },
      ],
      tokens: colors,
    },
    type: {
      fonts: [],
      families: resolved.font,
      groups: [
        {
          name: 'Text',
          family: 'sans',
          styles: Object.entries(resolved.textStyle).map(([name, style]) => ({
            name,
            family: familyKey(style.fontFamily),
            fontSize: `${style.fontSize}px`,
            lineHeight: `${style.lineHeight}px`,
            fontWeight: style.fontWeight,
          })),
        },
      ],
    },
    shadow: { tokens: shadows },
    ...Object.fromEntries(
      [...families].map(([family, list]) => [family, { tokens: list }])
    ),
  };
  return `${JSON.stringify(tokens, null, 2)}\n`;
}

/** Links relative to `design-system/` point at the repository instead. */
function absoluteLinks(markdown: string, repo: string, commit: string): string {
  return markdown.replace(
    /\]\((?!https?:|#)([^)]+)\)/g,
    (_, target: string) => {
      const path = new URL(target, 'https://x/design-system/').pathname;
      return `](https://github.com/${repo}/blob/${commit}${path})`;
    }
  );
}

function storyMeta(story: string) {
  const meta = /const meta = \{([\s\S]*?)\n\}/.exec(story)?.[1] ?? '';
  const title = /^\s*title: '([^']+)'/m.exec(meta)?.[1];
  const component = /^\s*component: ([A-Za-z0-9_]+)/m.exec(meta)?.[1];
  return { title, component };
}

/** The JSDoc right above `export function|const <name>`, as plain text. */
function docAbove(module: string, name: string): string {
  const at = new RegExp(
    `/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export (?:function|const) ${name}\\b`
  ).exec(module);
  return (at?.[1] ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();
}

function propsOf(module: string, name: string): string[] {
  const body = new RegExp(
    `export type ${name}Props = \\{([\\s\\S]*?)\\n\\};`
  ).exec(module)?.[1];
  if (!body) return [];
  const rows: string[] = [];
  for (const match of body.matchAll(
    /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n\s*([a-zA-Z0-9_]+)(\??):\s*([^;]+);/g
  )) {
    const doc = (match[1] as string).replace(/\s*\*\s*/g, ' ').trim();
    const type = (match[4] as string)
      .replace(/\s+/g, ' ')
      .replace(/\|/g, '\\|');
    rows.push(
      `| \`${match[2]}\`${match[3] ? '' : ' (required)'} | \`${type}\` | ${doc} |`
    );
  }
  return rows;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function componentFiles(sources: DesignSources): ArtifactFile[] {
  const files: ArtifactFile[] = [];
  const seen = new Set<string>();
  for (const source of sources.components) {
    const { title, component } = storyMeta(source.story);
    if (!title || !component) continue;
    const segments = title.split('/');
    const group = segments[0] as string;
    if (!['Atoms', 'Molecules', 'Organisms', 'Templates'].includes(group))
      continue;
    if (!/^[A-Z][A-Za-z0-9]*$/.test(component) || seen.has(component)) continue;
    seen.add(component);
    const doc = source.module ? docAbove(source.module, component) : '';
    const summary =
      doc.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ') ||
      `${segments.at(-1)} from the ${group.toLowerCase()} of the component library.`;
    const props = source.module ? propsOf(source.module, component) : [];
    const lines = [
      summary,
      '',
      `Built in Solid as \`${component}\` (\`${source.modulePath ?? source.storyPath}\`), with stories under \`${title}\` in Storybook. Change it in the code, never here.`,
    ];
    if (props.length > 0)
      lines.push(
        '',
        '| Prop | Type | What it does |',
        '| --- | --- | --- |',
        ...props
      );
    files.push({
      path: `components/${component}/README.md`,
      text: `${lines.join('\n')}\n`,
    });
    files.push({
      path: `components/${component}/preview.html`,
      text: `<!-- @dsCard group="${group}" height=120 floor=static -->
<div style="font-family: var(--font-sans); padding: var(--space-lg); color: var(--color-text);">
  <div class="title">${component}</div>
  <div class="caption" style="color: var(--color-text-secondary);">${escapeHtml(title)}: a static card; the live component runs in Storybook.</div>
</div>
`,
    });
  }
  return files;
}

function cover(): string {
  return `<!-- @dsCard height=288 -->
<style>
  body { margin: 0; background: var(--color-background); }
  .ground { position: relative; width: 960px; height: 288px; }
  .tint { fill: var(--color-tint-active); }
  .surface { fill: var(--color-surface-elevated); }
  .success { fill: var(--color-success); }
  .warning { fill: var(--color-warning); }
  .pill { fill: var(--color-tint); }
  .name { position: absolute; left: 48px; bottom: 72px; max-width: 440px; font-family: var(--font-display); font-weight: 700; font-size: 96px; line-height: 0.92; color: var(--color-text); }
  .tagline { position: absolute; left: 48px; bottom: 40px; max-width: 440px; font-family: var(--font-sans); font-size: 14px; color: var(--color-text-secondary); }
</style>
<div class="ground">
  <svg width="960" height="288" viewBox="0 0 960 288" aria-hidden="true" style="position:absolute;inset:0">
    <!-- blocks: color-surface-elevated 240×192 and color-tint-active 192×144 (radius-sheet 20), color-success and color-warning 96×48 pills.
         arrangement: one tall slab with satellites, right of x=480.
         pattern: pills from radius-full, because the README makes buttons, chips and avatars round.
         steps: space-3xl 48 and space-xl 24 gaps; radii radius-sheet 20 and radius-full. -->
    <rect class="surface" x="528" y="48" width="240" height="192" rx="20" />
    <rect class="tint" x="792" y="48" width="168" height="144" rx="20" />
    <rect class="success" x="792" y="216" width="96" height="48" rx="24" />
    <rect class="warning" x="552" y="72" width="96" height="48" rx="24" />
    <rect class="pill" x="552" y="144" width="192" height="48" rx="24" />
  </svg>
  <div class="name">Gamezilla</div>
  <div class="tagline">Calm chrome, one accent, expressive games.</div>
</div>
`;
}

export function renderArtifact(sources: DesignSources): ArtifactFile[] {
  const generated = `> Generated from [${sources.repo}@${sources.commit}](https://github.com/${sources.repo}/tree/${sources.commit}/design-system) on ${sources.date}. The repository is the only place this design system is edited: open a pull request there, never edit this page.\n\n`;
  return [
    { path: 'tokens.json', text: renderTokens(sources) },
    {
      path: 'README.md',
      text:
        generated + absoluteLinks(sources.readme, sources.repo, sources.commit),
    },
    {
      path: 'spaces.md',
      text: absoluteLinks(sources.spaces, sources.repo, sources.commit),
    },
    ...componentFiles(sources),
    { path: 'components/Cover/preview.html', text: cover() },
  ];
}
