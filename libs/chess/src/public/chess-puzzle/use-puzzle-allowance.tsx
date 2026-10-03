import { usePermissions } from '@libs/permissions/public/use-permissions';
import { t } from '@lingui/core/macro';
import { createMemo } from 'solid-js';

export function usePuzzleAllowance() {
  const permissions = usePermissions();
  const remaining = createMemo(() =>
    permissions.remaining('puzzle.rated.solve')
  );
  const label = () =>
    remaining() === null ? '' : t`${remaining()} rated puzzles remaining today`;
  return { remaining, label };
}
