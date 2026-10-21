import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { DatabaseIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
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
