import type { UiAttribution } from '../types';

type SourceBucket = {
  count: number;
  components: string[];
  componentSet: Set<string>;
};

export type MutableUiAttribution = {
  components: Record<string, number>;
  sources: Record<string, SourceBucket>;
};

export function createMutableUiAttribution(): MutableUiAttribution {
  return { components: {}, sources: {} };
}

/**
 * Scan frame HTML for data-component / data-src and merge into attribution.
 * Each data-src is associated with the nearest preceding data-component.
 */
export function mergeFrameHtmlAttribution(
  acc: MutableUiAttribution,
  html: string
): void {
  const attrRe = /data-(component|src)="([^"]*)"/g;
  let lastComponent = '';
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(html)) !== null) {
    const kind = match[1];
    const value = match[2];
    if (!value || !kind) continue;
    if (kind === 'component') {
      lastComponent = value;
      acc.components[value] = (acc.components[value] ?? 0) + 1;
      continue;
    }
    let entry = acc.sources[value];
    if (!entry) {
      entry = { count: 0, components: [], componentSet: new Set() };
      acc.sources[value] = entry;
    }
    entry.count += 1;
    if (lastComponent && !entry.componentSet.has(lastComponent)) {
      entry.componentSet.add(lastComponent);
      entry.components.push(lastComponent);
    }
  }
}

export function freezeUiAttribution(acc: MutableUiAttribution): UiAttribution {
  const sources: Record<string, { count: number; components: string[] }> = {};
  for (const [key, value] of Object.entries(acc.sources)) {
    sources[key] = { count: value.count, components: [...value.components] };
  }
  return {
    components: { ...acc.components },
    sources,
  };
}
