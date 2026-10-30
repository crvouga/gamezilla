import { ExplorerWorkspace } from '@pkgs/ui-root-client-ts/explorer-workspace';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function ExplorerWorkspaceExample() {
  const [selected, setSelected] = createSignal(false);
  return (
    <ExampleRoot>
      <div class="box h-80">
        <ExplorerWorkspace
          masterLabel="Entries"
          detailLabel="Selected entry"
          selected={selected()}
          backLabel="All entries"
          onBack={() => setSelected(false)}
          master={
            <MenuSection title="Entries">
              <MenuRow
                title="First entry"
                selected={selected()}
                onClick={() => setSelected(true)}
              />
            </MenuSection>
          }
          detail={
            <p class="text">
              {selected() ? 'First entry details' : 'Choose an entry'}
            </p>
          }
        />
      </div>
    </ExampleRoot>
  );
}
