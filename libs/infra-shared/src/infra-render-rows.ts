/** Resource tables: one row per declared resource, with names and links. */

import type { Link } from './infra-kinds';
import type { NodeModel, StackModel } from './infra-model-types';
import { logoTile } from './infra-render-logo';
import { esc, plural, resourceAnchor } from './infra-render-text';

const INLINE_LIMIT = 6;

function badges(node: NodeModel): string[] {
  const out: string[] = [];
  if (node.mode === 'data') {
    out.push(
      '<span class="badge muted" title="Read by OpenTofu, never created or changed">data source</span>'
    );
  }
  if (node.preventDestroy) {
    out.push(
      '<span class="badge lock" title="lifecycle { prevent_destroy = true }">prevent_destroy</span>'
    );
  } else if (node.stateful && node.mode === 'managed') {
    out.push(
      '<span class="badge stateful" title="Not on the deletion allow-list in policy/stateful.rego: an ordinary apply refuses to delete or replace it">stateful</span>'
    );
  }
  if (node.adopted) {
    out.push(
      '<span class="badge info" title="Adopted into state through an import block">imported</span>'
    );
  }
  if (node.expansion === 'count' && node.instances.length === 0) {
    out.push(
      '<span class="badge muted" title="count = 0 for this environment">not created here</span>'
    );
  }
  if (node.expansion === 'unknown') {
    out.push(
      '<span class="badge muted" title="The number of instances is known only after apply">expands at apply</span>'
    );
  }
  return out;
}

function nameChip(label: string, href: string | null): string {
  const text = `<span class="chip">${esc(label)}</span>`;
  return href === null
    ? text
    : `<a class="chip-link" href="${esc(href)}" target="_blank" rel="noreferrer noopener">${esc(label)}</a>`;
}

function names(node: NodeModel): string {
  if (node.expansion === 'unknown') {
    return '<span class="muted">one per item known at apply</span>';
  }
  if (node.instances.length === 0) {
    return '<span class="muted">none</span>';
  }
  const chips = node.instances.map((instance) =>
    nameChip(String(instance.label ?? instance.key ?? node.name), null)
  );
  if (chips.length === 1 && node.expansion === 'single') {
    return `<span class="name">${esc(String(node.instances[0]?.label ?? node.name))}</span>`;
  }
  const shown = chips.slice(0, INLINE_LIMIT).join('');
  if (chips.length <= INLINE_LIMIT) return `<div class="chips">${shown}</div>`;
  const rest = chips.slice(INLINE_LIMIT).join('');
  return `<div class="chips">${shown}</div><details class="more"><summary>${esc(plural(chips.length - INLINE_LIMIT, 'more instance'))}</summary><div class="chips">${rest}</div></details>`;
}

function linksOf(node: NodeModel): Link[] {
  const hrefs = new Map<string, Link>();
  const distinct = new Set(
    node.instances.flatMap((i) => i.links.map((l) => l.href))
  ).size;
  for (const instance of node.instances) {
    for (const link of instance.links) {
      if (hrefs.has(link.href)) continue;
      const qualify = distinct > 1 && instance.label !== null;
      hrefs.set(link.href, {
        href: link.href,
        label: qualify ? `${link.label} · ${instance.label}` : link.label,
      });
    }
  }
  return [...hrefs.values()];
}

function links(node: NodeModel): string {
  const found = linksOf(node);
  if (found.length === 0) return '<span class="muted">—</span>';
  return found
    .map(
      (l) =>
        `<a class="btn" href="${esc(l.href)}" target="_blank" rel="noreferrer noopener">${esc(l.label)}<span aria-hidden="true"> ↗</span></a>`
    )
    .join('');
}

export function resourceRow(
  env: string | null,
  stack: StackModel,
  node: NodeModel
): string {
  const id = resourceAnchor(env, stack.stack, node.address);
  return `<tr id="${id}">
<td class="res">${logoTile(node.logo, 32)}<div><div class="res-title">${esc(node.title)} ${badges(node).join(' ')}</div><code class="addr" title="${esc(`${node.file}:${node.line}`)}">${esc(node.address)}</code></div></td>
<td class="names">${names(node)}</td>
<td class="links">${links(node)}</td>
</tr>`;
}

export function resourceTable(
  env: string | null,
  stack: StackModel,
  nodes: readonly NodeModel[]
): string {
  const rows = nodes.map((n) => resourceRow(env, stack, n)).join('\n');
  return `<table class="resources"><thead><tr><th>Resource</th><th>Name</th><th>Open</th></tr></thead><tbody>
${rows}
</tbody></table>`;
}
