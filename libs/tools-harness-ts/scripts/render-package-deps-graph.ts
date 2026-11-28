#!/usr/bin/env bun
// @io-wall-ok — composition root

/**
 * Writes tmp/package-deps-graph.html — Mermaid flowchart (DAG-style layout)
 * of @apps|@libs|@pkgs/* runtime imports.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  type PackageEdges,
  packageEdges,
  packageReport,
  REPO_ROOT,
} from './workspace-package-import-graph';

const OUT_DIR = join(REPO_ROOT, 'tmp');
const OUT_HTML = join(OUT_DIR, 'package-deps-graph.html');

function mermaidNodeId(shortName: string): string {
  const base = shortName.replace(/[^a-zA-Z0-9_]/g, '_');
  const id = base || 'pkg';
  return /^\d/.test(id) ? `pkg_${id}` : id;
}

function buildMermaidSource(graph: PackageEdges): {
  source: string;
  omitted: number;
} {
  const connected = new Set<string>();
  for (const [name, targets] of graph) {
    if (targets.length > 0) connected.add(name);
    for (const target of targets) connected.add(target);
  }
  const names = [...connected].sort();
  const omitted = graph.size - names.length;
  const idFor = new Map(names.map((name) => [name, mermaidNodeId(name)]));
  const lines: string[] = ['flowchart TD'];
  for (const name of names) {
    const id = idFor.get(name);
    if (!id) continue;
    // Mermaid has no backslash escape: a quote in a label is `#quot;`.
    const label = name.replace(/"/g, '#quot;');
    lines.push(`  ${id}["${label}"]`);
  }

  for (const from of names)
    for (const to of graph.get(from) ?? [])
      lines.push(`  ${idFor.get(from)} --> ${idFor.get(to)}`);

  lines.push(
    '',
    '  classDef tierApps fill:#238636,stroke:#3fb950,color:#e6edf3',
    '  classDef tierLibs fill:#1f6feb,stroke:#58a6ff,color:#e6edf3',
    '  classDef tierPkgs fill:#8957e5,stroke:#d2a8ff,color:#e6edf3'
  );

  for (const [scope, theme] of [
    ['apps', 'tierApps'],
    ['libs', 'tierLibs'],
    ['pkgs', 'tierPkgs'],
  ] as const) {
    const ids = names
      .filter((name) => name.startsWith(`@${scope}/`))
      .map((name) => idFor.get(name));
    if (ids.length) lines.push(`  class ${ids.join(',')} ${theme}`);
  }

  return { source: lines.join('\n'), omitted };
}

function buildHtml(mermaidBody: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>workspace package import graph</title>
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: #0d1117;
      color: #e6edf3;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #30363d;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.75rem 1.5rem;
    }
    .title-block h1 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }
    p.sub {
      font-size: 0.8rem;
      color: #8b949e;
      margin: 0.4rem 0 0;
      max-width: 52rem;
      line-height: 1.45;
    }
    p.sub code {
      font-size: 0.78rem;
      background: #21262d;
      padding: 0.12rem 0.35rem;
      border-radius: 4px;
      color: #79c0ff;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      align-items: center;
      font-size: 0.8rem;
      color: #8b949e;
      margin-left: auto;
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .swatch {
      width: 0.85rem;
      height: 0.85rem;
      border-radius: 3px;
      border: 1px solid;
    }
    .swatch.apps { background: #238636; border-color: #3fb950; }
    .swatch.libs { background: #1f6feb; border-color: #58a6ff; }
    .swatch.pkgs { background: #8957e5; border-color: #d2a8ff; }
    .wrap {
      padding: 1rem 1.25rem 2rem;
      overflow: auto;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
  </style>
</head>
<body>
  <header>
    <div class="title-block">
      <h1>workspace — package import graph</h1>
      <p class="sub">
        Directed edges from runtime <code>@apps|@libs|@pkgs/*</code> imports in TypeScript
        under <code>{apps,libs,pkgs}/*/src</code> (type-only imports omitted). Packages with no workspace package imports in or out are omitted.
      </p>
    </div>
    <div class="legend" aria-label="tier colors">
      <span class="legend-item"><span class="swatch apps"></span>@apps</span>
      <span class="legend-item"><span class="swatch libs"></span>@libs</span>
      <span class="legend-item"><span class="swatch pkgs"></span>@pkgs</span>
    </div>
  </header>
  <div class="wrap">
    <div class="mermaid">
${mermaidBody}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: {
        curve: 'basis',
        padding: 14,
        useMaxWidth: true,
        htmlLabels: true,
        nodeSpacing: 50,
        rankSpacing: 55,
      },
      themeVariables: {
        primaryColor: '#238636',
        primaryTextColor: '#e6edf3',
        primaryBorderColor: '#3fb950',
        lineColor: '#8b949e',
        secondaryColor: '#161b22',
        tertiaryColor: '#21262d',
        background: '#0d1117',
        mainBkg: '#161b22',
        nodeBorder: '#30363d',
        clusterBkg: '#161b22',
        titleColor: '#e6edf3',
        edgeLabelBackground: '#21262d',
      },
    });
    void mermaid.run({ querySelector: '.mermaid' });
  </script>
</body>
</html>
`;
}

function tryOpen(path: string): void {
  if (process.platform === 'darwin') {
    spawnSync('open', [path], { stdio: 'inherit' });
  } else if (process.platform === 'linux') {
    spawnSync('xdg-open', [path], { stdio: 'ignore' });
  } else {
    console.log(`Wrote ${path}`);
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      json: { type: 'boolean' },
      all: { type: 'boolean' },
      output: { type: 'string' },
      summary: { type: 'boolean' },
      declared: { type: 'boolean' },
      package: { type: 'string' },
    },
  });
  if (values.all && values.declared)
    throw new Error('Select either --all or --declared');
  const graph = packageEdges(
    REPO_ROOT,
    values.declared ? 'declared' : values.all ? 'all' : 'src'
  );
  if (
    values.package !== undefined ||
    values.all ||
    values.output ||
    values.summary ||
    values.json ||
    values.declared
  ) {
    const data =
      values.json && !values.package && !values.summary
        ? Object.fromEntries(graph)
        : packageReport(graph, values.package);
    const json = JSON.stringify(data, null, 2);
    if (values.output) {
      mkdirSync(dirname(values.output), { recursive: true });
      writeFileSync(values.output, json + '\n');
    } else console.log(json);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const { source, omitted } = buildMermaidSource(graph);
  writeFileSync(OUT_HTML, buildHtml(source), 'utf8');
  const omittedNote =
    omitted > 0
      ? ` (${omitted} isolated package${omitted === 1 ? '' : 's'} omitted)`
      : '';
  console.log(`Wrote ${OUT_HTML}${omittedNote}`);
  tryOpen(OUT_HTML);
}

main();
