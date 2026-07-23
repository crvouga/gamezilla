import { useLingui } from '@lingui/react/macro';
import { ChipGroup, type ChipGroupOption } from '@pkgs/ui';
import { useCallback, useMemo, type ReactNode } from 'react';

import type { SpaceVisibility } from '../../shared/space-visibility';
import { useSetVisibility } from '../set-visibility/use-set-visibility';

function useVisibilityOptions(): readonly ChipGroupOption<SpaceVisibility>[] {
  const { t } = useLingui();
  return useMemo(
    () => [
      { key: 'private', label: t`Invite only` },
      { key: 'friends', label: t`Friends` },
      { key: 'public', label: t`Public` },
    ],
    [t]
  );
}

export type SpaceVisibilityChipsProps = {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
  readonly disabled?: boolean;
};

/** Host visibility picker — ChipGroup so labels stay pressable on web. */
export function SpaceVisibilityChips({
  spaceId,
  visibility,
  disabled = false,
}: SpaceVisibilityChipsProps): ReactNode {
  const setVisibility = useSetVisibility();
  const options = useVisibilityOptions();
  const onSelect = useCallback(
    (next: SpaceVisibility) => {
      if (next === visibility) return;
      void setVisibility(spaceId, next);
    },
    [setVisibility, spaceId, visibility]
  );

  return (
    <ChipGroup
      options={options}
      selected={visibility}
      onSelect={onSelect}
      disabled={disabled}
    />
  );
}
