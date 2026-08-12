/**
 * react-native-screens native hosts keep covered stack screens mounted with
 * activityState still elevated; web applies `display:none`. Snapshot HTML must
 * mirror that or z-indexed chrome (FABs, titles) bleeds through later screens.
 */

type JsonNode =
  | string
  | {
      type: string | unknown;
      props: Record<string, unknown>;
      children: JsonNode[] | null;
    };

export function isRnScreenHost(typeName: string): boolean {
  return typeName === 'RNSScreen';
}

export function isRnScreenStackHost(typeName: string): boolean {
  return typeName === 'RNSScreenStack';
}

export function isJsonRnScreen(node: JsonNode): boolean {
  return typeof node !== 'string' && node.type === 'RNSScreen';
}

/** Last RNSScreen sibling index (top of native stack). */
export function topRnScreenIndex(children: readonly JsonNode[]): number | null {
  let top: number | null = null;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child !== undefined && isJsonRnScreen(child)) top = i;
  }
  return top;
}

export function isRnScreenInactive(props: Record<string, unknown>): boolean {
  const activityState = props['activityState'];
  if (activityState === 0 || activityState === '0') return true;
  const active = props['active'];
  return active === 0 || active === '0' || active === false;
}

export function shouldHideRnScreen(
  typeName: string,
  props: Record<string, unknown>,
  coveredByStack: boolean
): boolean {
  if (!isRnScreenHost(typeName)) return false;
  return coveredByStack || isRnScreenInactive(props);
}

export function withRnScreenHiddenCss(css: string, hide: boolean): string {
  if (!hide) return css;
  return css.includes('display:none')
    ? css
    : css
      ? `${css};display:none`
      : 'display:none';
}
