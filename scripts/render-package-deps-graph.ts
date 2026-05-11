#!/usr/bin/env bun
/**
 * Writes tmp/package-deps-graph.html — Mermaid flowchart (DAG-style layout)
 * of @gamezilla/* runtime imports. Same graph model as ci:circular-deps.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  buildPackageImportGraph,
  discoverPackages,
} from './workspace-package-import-graph';

const OUT_DIR = join(REPO_ROOT, 'tmp');
const OUT_HTML = join(OUT_DIR, 'package-deps-graph.html');

function mermaidNodeId(shortName: string): string {
  const base = shortName.replace(/[^a-zA-Z0-9_]/g, '_');
  const id = base || 'pkg';
  return /^\d/.test(id) ? `pkg_${id}` : id;
}

function buildMermaidSource(): string {
  const packages = discoverPackages();
  if (packages.size === 0) {
    throw new Error('No @gamezilla/* packages found under packages/.');
  }
  const graph = buildPackageImportGraph(packages);
  const names = [...packages.keys()].sort();
  const idFor = new Map<string, string>();
  for (const name of names) {
    idFor.set(name, mermaidNodeId(name));
  }

  const lines: string[] = ['flowchart TD'];
  for (const name of names) {
    const id = idFor.get(name);
    if (!id) continue;
    const label = `@gamezilla/${name}`.replace(/"/g, '\\"');
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

  return lines.join('\n');
}

function buildHtml(mermaidBody: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>@gamezilla package import graph</title>
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
    }
    h1 {
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
    <h1>@gamezilla workspace — package import graph</h1>
    <p class="sub">
      Directed edges from runtime <code>@gamezilla/*</code> imports in TypeScript under
      <code>packages/*/src</code> (type-only imports omitted). Same model as
      <code>bun run ci:circular-deps</code>. Cycles, if any, appear as loops in the diagram.
    </p>
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
  const mermaid = buildMermaidSource();
  writeFileSync(OUT_HTML, buildHtml(mermaid), 'utf8');
  console.log(`Wrote ${OUT_HTML}`);
  tryOpen(OUT_HTML);
}

main();
