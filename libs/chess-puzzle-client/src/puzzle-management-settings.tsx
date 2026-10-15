import { useCan } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { DatabaseIcon } from '@pkgs/ui-root-client/icons';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { type JSX, Show } from 'solid-js';

export function PuzzleManagementSettings(): JSX.Element {
  const canManage = useCan(PERMISSION.puzzlesManage);
  const router = useRouter();
  return (
    <Show when={canManage()}>
      <MenuSection title={<Trans>Environment</Trans>}>
        <MenuRow
          title={<Trans>Puzzles</Trans>}
          caption={<Trans>Load Lichess CSV and follow progress</Trans>}
          leading={<DatabaseIcon size={20} color="icon" />}
          onClick={() => router.push('/more/puzzles')}
          dataSet={{ testid: 'settings-puzzle-management' }}
        />
      </MenuSection>
    </Show>
  );
}
