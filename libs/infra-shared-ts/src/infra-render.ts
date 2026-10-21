/**
 * The infrastructure map as one self-contained HTML page: inline logos,
 * inline SVG graphs, no scripts and no network. Everything on it comes from
 * the model, which comes from the OpenTofu configuration, so regenerating it
 * is the only way it changes.
 */

import { providerLogoOfTitle, providerTitle } from './infra-kinds';
import type { EnvModel, InfraModel, StackModel } from './infra-model-types';
import { logoSprite, logoTile } from './infra-render-logo';
import { renderProviders } from './infra-render-providers';
import {
  renderEndpoints,
  renderRemoved,
  renderStackDetails,
  renderStackOverview,
} from './infra-render-sections';
import { PAGE_STYLE } from './infra-render-style';
import { esc, plural, slug } from './infra-render-text';

export type RenderOptions = {
  /** A digest of the OpenTofu sources, shown so a stale page is visible. */
  readonly digest: string;
};

const LEGEND = `<div class="legend"><span><i></i>module or resource</span><span><i class="s"></i>holds data (never deleted by an ordinary apply)</span><span><i class="d"></i>data source or outside OpenTofu</span><span>arrows run from what is produced to what uses it</span></div>`;

function allStacks(model: InfraModel): StackModel[] {
  return [...model.globals, ...model.envs.flatMap((e) => e.stacks)];
}

function summary(model: InfraModel): string {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const stack of allStacks(model)) {
    for (const node of stack.nodes) {
      const key = `${stack.stack}:${node.address}`;
      if (node.mode !== 'managed' || seen.has(key)) continue;
      seen.add(key);
      const brand = providerTitle(node.provider);
      counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([title, n]) =>
        `<span class="pill">${logoTile(providerLogoOfTitle(title), 26)}<span><b>${n}</b> <span class="muted">${esc(title)}</span></span></span>`
    )
    .join('');
}

function envSection(env: EnvModel): string {
  const id = slug(env.env);
  const prod = env.protection === 'production';
  const stacks = env.stacks;
  return `<div class="env" data-env="${id}">
<div class="env-head"><h2 id="env-${id}">${esc(env.displayName)}</h2><span class="badge${prod ? ' prod' : ''}">${esc(env.protection)}</span><span class="muted">suffix <code>${esc(env.suffix)}</code>${env.worker === null ? '' : ` · Worker <code>${esc(env.worker)}</code>`}</span></div>
<h2 id="endpoints-${id}">Public endpoints</h2><p class="sub">Hostnames this environment serves, from <code>envs/${esc(env.env)}.tfvars.json</code>.</p>
${renderEndpoints(env)}
<h2 id="topology-${id}">Topology</h2><p class="sub">Each box is a module or a resource declared in the stack; arrows are the references OpenTofu resolves between them.</p>
${LEGEND}
${stacks.map((s) => renderStackOverview(env.env, s)).join('\n')}
<h2 id="resources-${id}">Resources</h2><p class="sub">Every resource this environment declares, with the names OpenTofu will give it and where to open it.</p>
${stacks.map((s) => renderStackDetails(env.env, s)).join('\n')}
</div>`;
}

function envSwitch(envs: readonly EnvModel[]): string {
  const radios = envs
    .map((env, index) => {
      const id = slug(env.env);
      return `<input type="radio" name="env" id="env-${id}"${index === 0 ? ' checked' : ''}><label for="env-${id}">${esc(env.displayName)}</label>`;
    })
    .join('');
  return `<div class="env-switch" role="radiogroup" aria-label="Environment">${radios}</div>`;
}

function envStyle(envs: readonly EnvModel[]): string {
  const show = envs
    .map((env) => {
      const id = slug(env.env);
      return `body:has(#env-${id}:checked) .env[data-env="${id}"]{display:block}body:has(#env-${id}:checked) label[for="env-${id}"]{background:var(--accent);color:#fff}`;
    })
    .join('');
  return `${show}@supports not selector(:has(*)){.env{display:block}}`;
}

function diagnostics(model: InfraModel): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const stack of allStacks(model)) {
    for (const d of stack.diagnostics) {
      const key = `${d.file}:${d.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`<li><code>${esc(d.file)}</code> — ${esc(d.message)}</li>`);
    }
  }
  if (lines.length === 0) return '';
  return `<div class="notice"><b>Some files could not be read.</b> The map below is incomplete until these parse:<ul>${lines.join('')}</ul></div>`;
}

function removedUnique(model: InfraModel): StackModel[] {
  const seen = new Set<string>();
  return allStacks(model).map((stack) => ({
    ...stack,
    removed: stack.removed.filter((r) => {
      const key = `${stack.stack}:${r.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  }));
}

export function renderInfraMap(
  model: InfraModel,
  options: RenderOptions
): string {
  const managed = new Set<string>();
  for (const stack of allStacks(model)) {
    for (const n of stack.nodes) {
      if (n.mode === 'managed') managed.add(`${stack.stack}:${n.address}`);
    }
  }
  const globals = model.globals
    .map((s) => renderStackOverview(null, s))
    .join('\n');
  const globalDetails = model.globals
    .map((s) => renderStackDetails(null, s))
    .join('\n');
  const removed = renderRemoved(removedUnique(model));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(model.project)} infrastructure map</title>
<style>${PAGE_STYLE}${envStyle(model.envs)}</style>
</head>
<body>
${logoSprite()}
<header class="top"><div class="wrap">
<div class="brand">${logoTile('opentofu', 44)}<h1>${esc(model.project)} infrastructure</h1></div>
<p class="lede">${plural(managed.size, 'resource')} declared in OpenTofu across ${plural(allStacks(model).length, 'stack')} and ${plural(model.envs.length, 'environment')}. This page is generated from <code>libs/infra-shared-ts/tofu</code> — do not edit it; change the OpenTofu and regenerate with <code>bun run infra:map</code>.</p>
<div class="summary">${summary(model)}</div>
</div></header>
<nav class="nav"><div class="wrap">
<a href="#global">Global</a><a href="#providers">Providers</a><a href="#retired">Retired</a>
${envSwitch(model.envs)}
</div></nav>
<main><div class="wrap">
${diagnostics(model)}
${model.envs.map(envSection).join('\n')}
<section id="global">
<h2>Global stacks</h2><p class="sub">Applied once for the whole project, not per environment.</p>
${LEGEND}
${globals}
${globalDetails}
</section>
<section id="providers"><h2>Providers</h2><p class="sub">Accounts and consoles behind the resources above, from <code>global.tfvars.json</code> and the pinned provider versions.</p>
${renderProviders(model)}</section>
${removed === '' ? '' : `<section id="retired"><h2>Retired</h2><p class="sub">Resources OpenTofu was told to stop managing (<code>removed</code> blocks). Forgotten ones may still exist at the provider.</p>${removed}</section>`}
</div></main>
<footer><div class="wrap">
<p>Source digest <code>${esc(options.digest)}</code> over ${plural(model.sourceCount, 'file')} under <code>libs/infra-shared-ts</code>. Names, counts, links and arrows are all evaluated from that source.</p>
<p>Brand marks are trademarks of their owners and appear only to identify the services in use. Artwork is from SVG Logos and Simple Icons (CC0) and selfh.st/icons (CC BY 4.0).</p>
</div></footer>
</body>
</html>
`;
}
