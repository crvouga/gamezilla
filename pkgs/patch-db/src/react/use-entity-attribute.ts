import type { AttributeTag } from '@pkgs/attribute';
import { useMemo } from 'react';
import type { PatchEntityType } from '../interface';
import { useEntity } from './use-entity';

/**
 * Reads one attribute from one entity id. Prefer over {@link useQueryAttribute}
 * when you have a stable `entityId` string — shares one subscription per entity.
 */
export function useEntityAttribute<T, K extends string>(
  entityType: PatchEntityType,
  entityId: string,
  attr: AttributeTag<T, K>
): T {
  const entity = useEntity(entityType, entityId);
  const raw = entity?.attributes[attr.key];
  return useMemo(() => attr.parse(raw), [raw, attr]);
}
