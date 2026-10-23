/** The page's sections: endpoints, stack overviews, module details. */

import { providerLogo as providerLogoFor } from './infra-kinds';
import type { EnvModel, ModuleModel, StackModel } from './infra-model-types';
import { moduleGraph, overviewGraph } from './infra-render-cards';
import { renderGraph } from './infra-render-graph';
import { logoRow, logoTile } from './infra-render-logo';
import { resourceTable } from './infra-render-rows';
import {
  esc,
  inlineCode,
  moduleAnchor,
  plural,
  slug,
  stackAnchor,
} from './infra-render-text';

const HOST_LABELS: Readonly<Record<string, string>> = {
  apex: 'Apex',
  web: 'Web',
  api: 'API',
  broker: 'Realtime broker',
};

export function renderEndpoints(env: EnvModel): string {
  const cards = Object.entries(env.hosts).map(([key, host]) => {
    const broker = key === 'broker';
    const logo = broker ? 'aws' : 'cloudflare-workers';
    const label = HOST_LABELS[key] ?? key;
    const shown = broker ? `wss://${host}/mqtt` : host;
    const inner = `${logoTile(logo, 36)}<div><div class="endpoint-label">${esc(label)}</div><div class="endpoint-host">${esc(shown)}</div></div>`;
    return broker
      ? `<div class="endpoint">${inner}</div>`
      : `<a class="endpoint" href="https://${esc(host)}" target="_blank" rel="noreferrer noopener">${inner}</a>`;
  });
  return `<div class="endpoints">${cards.join('')}</div>`;
}

function stackFacts(stack: StackModel): string {
  const managed = stack.nodes.filter((n) => n.mode === 'managed');
  const instances = managed.reduce(
    (sum, n) => sum + (n.expansion === 'unknown' ? 1 : n.instances.length),
    0
  );
  const parts = [
    plural(managed.length, 'resource'),
    plural(instances, 'instance'),
    plural(stack.modules.length, 'module'),
  ];
  const state =
    stack.state.key === null
      ? ''
      : ` · state <code>${esc(stack.state.bucket ?? '')}/${esc(stack.state.key)}</code>`;
  return `${parts.join(' · ')}${state}`;
}

export function renderStackOverview(
  env: string | null,
  stack: StackModel
): string {
  const graph = overviewGraph(env, stack);
  const id = stackAnchor(env, stack.stack);
  const description = stack.description.split('\n\n')[0]?.replace(/\n/g, ' ');
  return `<section class="stack" id="${id}">
<header class="stack-head"><h3>${esc(stack.stack)}</h3><div class="stack-facts">${stackFacts(stack)}</div></header>
${description ? `<p class="desc">${inlineCode(description)}</p>` : ''}
${renderGraph(`${slug(env ?? 'global')}-${stack.stack}`, graph.cards, graph.edges, 'overview')}
</section>`;
}

function moduleBlock(
  env: string | null,
  stack: StackModel,
  module: ModuleModel
): string {
  const nodes = stack.nodes.filter((n) => module.addresses.includes(n.address));
  if (nodes.length === 0) return '';
  const graph = moduleGraph(env, stack, module.addresses);
  const logos = [...new Set(nodes.map((n) => n.logo))];
  const first = module.description.split('\n\n')[0]?.replace(/\n/g, ' ') ?? '';
  const diagram =
    nodes.length > 1
      ? renderGraph(
          `${slug(env ?? 'global')}-${stack.stack}-${slug(module.name)}`,
          graph.cards,
          graph.edges,
          'detail'
        )
      : '';
  return `<details class="module" id="${moduleAnchor(env, stack.stack, module.name)}">
<summary>${logoRow(logos, 22)}<span class="module-name">${esc(module.name)}</span><span class="module-count">${esc(plural(nodes.length, 'resource'))}</span><code class="module-dir">${esc(module.dir)}</code></summary>
${first ? `<p class="desc">${inlineCode(first)}</p>` : ''}
${diagram}
${resourceTable(env, stack, nodes)}
</details>`;
}

function rootBlock(env: string | null, stack: StackModel): string {
  const nodes = stack.nodes.filter((n) => n.group === '');
  if (nodes.length === 0) return '';
  return `<details class="module" id="${moduleAnchor(env, stack.stack, '')}">
<summary>${logoRow([...new Set(nodes.map((n) => n.logo))], 22)}<span class="module-name">declared in the stack</span><span class="module-count">${esc(plural(nodes.length, 'resource'))}</span><code class="module-dir">${esc(stack.dir)}</code></summary>
${resourceTable(env, stack, nodes)}
</details>`;
}

export function renderStackDetails(
  env: string | null,
  stack: StackModel
): string {
  const modules = stack.modules
    .map((m) => moduleBlock(env, stack, m))
    .join('\n');
  return `<section class="stack-detail">
<h3>${esc(stack.stack)}</h3>
${rootBlock(env, stack)}
${modules}
</section>`;
}

export function renderRemoved(stacks: readonly StackModel[]): string {
  const rows = stacks.flatMap((stack) =>
    stack.removed.map((r) => ({ stack: stack.stack, r }))
  );
  if (rows.length === 0) return '';
  const items = rows
    .map(
      ({ stack, r }) =>
        `<li>${logoTile(r.provider === 'neon' ? 'neon' : providerLogoFor(r.provider), 24)}<div><code>${esc(r.address)}</code><div class="muted">${esc(stack)} stack · ${r.destroy ? 'destroyed on apply' : 'forgotten — still running at the provider, no longer managed here'}</div></div></li>`
    )
    .join('');
  return `<ul class="removed">${items}</ul>`;
}
