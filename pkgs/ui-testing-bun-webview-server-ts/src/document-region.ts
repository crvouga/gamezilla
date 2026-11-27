import type { DriverNode } from '@pkgs/ui-testing-root-shared-ts/driver';

export type RegionMarkers = Readonly<Record<string, string>>;
export type VisibleRegion = (
  origin: string,
  markers: RegionMarkers
) => Promise<string | null>;

type Document = {
  readonly url: string;
  readonly loading: boolean;
  readonly navigation: number;
};

type Node = {
  readonly ignored: boolean;
  readonly role?: { readonly value: string };
  readonly name?: { readonly value: string };
};

type AccessibilityTree = (
  method: 'Accessibility.getFullAXTree',
  params: Record<string, never>
) => Promise<{ nodes: readonly Node[] }>;

/** Only a single exposed region with a recognized name identifies a form. */
export function chromeRegionMarker(cdp: AccessibilityTree) {
  return async (markers: RegionMarkers) => {
    const { nodes } = await cdp('Accessibility.getFullAXTree', {});
    const matches = nodes.flatMap(({ ignored, role, name }) =>
      ignored === false &&
      role?.value === 'region' &&
      name &&
      Object.hasOwn(markers, name.value)
        ? [markers[name.value]!]
        : []
    );
    return matches.length === 1 ? matches[0]! : null;
  };
}

/** Native backends without an accessibility reader use their document controls. */
export function documentMarker(
  get: (id: string) => Pick<DriverNode, 'isVisible'>
) {
  return async (markers: RegionMarkers) => {
    for (const id of Object.values(markers)) {
      if (await get(id).isVisible()) return id;
    }
    return null;
  };
}

/** Navigation can start while a document read is queued or in flight. */
export function visibleDocumentRegion(
  document: () => Document,
  read: (markers: RegionMarkers) => Promise<string | null>
): VisibleRegion {
  return async (origin, markers) => {
    const before = document();
    if (before.loading || URL.parse(before.url)?.origin !== origin) return null;
    const marker = await read(markers);
    const after = document();
    return !after.loading &&
      before.navigation === after.navigation &&
      before.url === after.url
      ? marker
      : null;
  };
}
