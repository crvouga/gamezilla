#!/usr/bin/env bun
// @io-wall-ok — composition root

/**
 * Writes tmp/package-deps-graph.html — Mermaid flowchart (DAG-style layout)
 * of @apps|@libs|@pkgs/* runtime imports.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Tier } from './workspace-package-import-graph';
import {
  buildPackageImportGraph,
  discoverPackagesWithTier,
  REPO_ROOT,
} from './workspace-package-import-graph';

const OUT_DIR = join(REPO_ROOT, 'tmp');
const OUT_HTML = join(OUT_DIR, 'package-deps-graph.html');

const TIER_CLASS: Record<Tier, string> = {
  apps: 'tierApps',
  libs: 'tierLibs',
  pkgs: 'tierPkgs',
};

function mermaidNodeId(shortName: string): string {
  const base = shortName.replace(/[^a-zA-Z0-9_]/g, '_');
  const id = base || 'pkg';
  return /^\d/.test(id) ? `pkg_${id}` : id;
}

/** Packages that appear as source or target of at least one edge. */
function connectedNames(
  names: string[],
  graph: ReturnType<typeof buildPackageImportGraph>
): Set<string> {
  const connected = new Set<string>();
  for (const from of names) {
    const targets = graph.get(from);
    if (!targets?.size) continue;
    connected.add(from);
    for (const to of targets.keys()) connected.add(to);
  }
  return connected;
}

function buildMermaidSource(): { source: string; omitted: number } {
  const packages = discoverPackagesWithTier();
  if (packages.size === 0) {
    throw new Error(
      'No @apps|@libs|@pkgs/* packages found under apps/, libs/, pkgs/.'
    );
  }
  const dirs = new Map(
    [...packages.entries()].map(([name, info]) => [name, info.dir])
  );
  const graph = buildPackageImportGraph(dirs);
  const allNames = [...packages.keys()].sort();
  const connected = connectedNames(allNames, graph);
  const names = allNames.filter((n) => connected.has(n));
  const omitted = allNames.length - names.length;

  const idFor = new Map<string, string>();
  const tierFor = new Map<string, Tier>();
  for (const name of names) {
    idFor.set(name, mermaidNodeId(name));
    const info = packages.get(name);
    if (info) tierFor.set(name, info.tier);
  }

  const lines: string[] = ['flowchart TD'];
  for (const name of names) {
    const id = idFor.get(name);
    if (!id) continue;
    // Mermaid has no backslash escape: a quote in a label is `#quot;`.
    const label = name.replace(/"/g, '#quot;');
    lines.push(`  ${id}["${label}"]`);
  }

  const seen = new Set<string>();
  for (const from of names) {
    const targets = graph.get(from);
    if (!targets) continue;
    for (const to of [...targets.keys()].sort()) {
      const key = `${from}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fromId = idFor.get(from);
      const toId = idFor.get(to);
      if (!fromId || !toId) continue;
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  lines.push(
    '',
    '  classDef tierApps fill:#238636,stroke:#3fb950,color:#e6edf3',
    '  classDef tierLibs fill:#1f6feb,stroke:#58a6ff,color:#e6edf3',
    '  classDef tierPkgs fill:#8957e5,stroke:#d2a8ff,color:#e6edf3'
  );

  const byTier = new Map<Tier, string[]>();
  for (const name of names) {
    const tier = tierFor.get(name);
    const id = idFor.get(name);
    if (!tier || !id) continue;
    let ids = byTier.get(tier);
    if (!ids) {
      ids = [];
      byTier.set(tier, ids);
    }
    ids.push(id);
  }
  for (const tier of ['apps', 'libs', 'pkgs'] as const) {
    const ids = byTier.get(tier);
    if (!ids?.length) continue;
    lines.push(`  class ${ids.join(',')} ${TIER_CLASS[tier]}`);
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
  mkdirSync(OUT_DIR, { recursive: true });
  const { source, omitted } = buildMermaidSource();
  writeFileSync(OUT_HTML, buildHtml(source), 'utf8');
  const omittedNote =
    omitted > 0
      ? ` (${omitted} isolated package${omitted === 1 ? '' : 's'} omitted)`
      : '';
  console.log(`Wrote ${OUT_HTML}${omittedNote}`);
  tryOpen(OUT_HTML);
}

main();
