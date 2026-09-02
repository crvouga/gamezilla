import type { AnySystemDef } from '../define-system';
import type { JsonValue } from '../json';

export function roleIdsFromKnobs(
  system: AnySystemDef,
  knobs: Record<string, JsonValue>,
  role: string
): readonly string[] {
  const ids: string[] = [];
  for (const [roleName, spec] of Object.entries(system.nodes)) {
    if (roleName !== role) continue;
    const count =
      'count' in spec && typeof spec.count === 'function'
        ? spec.count(knobs)
        : 1;
    for (let i = 0; i < count; i += 1) {
      const idFor =
        'id' in spec && typeof spec.id === 'function' ? spec.id : undefined;
      ids.push(idFor?.(i) ?? (count === 1 ? roleName : `${roleName}${i}`));
    }
  }
  return ids;
}

export function idsFromKnobs(
  system: AnySystemDef,
  knobs: Record<string, JsonValue>
): (role: string) => readonly string[] {
  const cache = new Map<string, string[]>();
  return (role: string) => {
    const hit = cache.get(role);
    if (hit !== undefined) return hit;
    const ids = [...roleIdsFromKnobs(system, knobs, role)];
    cache.set(role, ids);
    return ids;
  };
}
