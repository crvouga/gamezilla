/**
 * Convertible export names for the sx-codemod.
 *
 * `CONVERTIBLE` — peel to HTML (Box → div, …). Imports prune after peel.
 * `HOST_CONVERTIBLE` — keep the component tag; rewrite sx-family props to
 * class / style (and frameClass / enterClass / …). Imports stay.
 */

/** Peel-to-HTML primitives (and thin wrappers Card / Divider). */
export const CONVERTIBLE = new Set([
  'Box',
  'Clickable',
  'Text',
  'Stack',
  'Center',
  'Spacer',
  /** Thin Box wrappers → `div` + base class (`card` / `divider`; CSS later). */
  'Card',
  'Divider',
]);

/**
 * Behavior / chrome hosts: keep PascalCase tag, rewrite styling props only.
 * Icons (`*Icon` from `createIcon`) match via {@link isHostConvertible}.
 */
export const HOST_CONVERTIBLE = new Set([
  'ScrollView',
  'VirtualList',
  'ScreenBodyScrollView',
  'ScreenBodyVirtualList',
  'Motion',
  'Island',
  'GradientBox',
  'FocusTrap',
  'SpinnerBox',
  'MenuList',
  'ExampleRoot',
  'BrandIcon',
  'RelativeTime',
  'JsonView',
  'SpeakingAvatar',
  'CopyToClipboardField',
  'TextInput',
  'DataTable',
  // Lib wrappers that forward sx — keep tag, rewrite prop.
  'SpaceCardGradientBox',
  'UserUsername',
  'MyUsername',
  'SpaceTitleText',
  'SpaceHostNameText',
  'SpaceHostFallbackTitle',
  'SpaceGuestNamesLine',
  'SpaceGuestMembershipUsernamesJoined',
  'SpaceGuestMembershipUsername',
  'SpaceGuestCountText',
  'NoGuestsText',
  'AccountDeviceListTitleText',
  'AccountDeviceListCaptionText',
]);

/** True for peel targets (HTML rewrite + import prune). */
export function isPeelConvertible(exportName: string): boolean {
  return CONVERTIBLE.has(exportName);
}

/** True for host call sites (tag kept; sx → class/style). */
export function isHostConvertible(exportName: string): boolean {
  if (HOST_CONVERTIBLE.has(exportName)) return true;
  // createIcon exports: ChevronDownIcon, HouseIcon, …
  return exportName.endsWith('Icon');
}

/** Any export the leaf-first pass may convert. */
export function isConvertibleExport(exportName: string): boolean {
  return isPeelConvertible(exportName) || isHostConvertible(exportName);
}
