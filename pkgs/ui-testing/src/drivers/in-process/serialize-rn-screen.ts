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

function screenHostTypeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const named = (type as { displayName?: string; name?: string }).displayName;
    if (typeof named === 'string' && named.length > 0) return named;
    if (typeof type.name === 'string' && type.name.length > 0) return type.name;
  }
  return '';
}

export function isJsonRnScreen(node: JsonNode): boolean {
  return typeof node !== 'string' && screenHostTypeName(node.type) === 'RNSScreen';
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
  const hidden = 'display:none;visibility:hidden;pointer-events:none';
  if (css.includes('display:none')) {
    return css.includes('visibility:hidden') ? css : `${css};visibility:hidden;pointer-events:none`;
  }
  return css ? `${css};${hidden}` : hidden;
}

/** True when inline style already hides the node (RN-web inactive screens). */
export function stylePropHidesNode(style: unknown): boolean {
  if (style == null || typeof style !== 'object') return false;
  const record = style as Record<string, unknown>;
  if (record['display'] === 'none') return true;
  if (record['opacity'] === 0) return true;
  return false;
}
