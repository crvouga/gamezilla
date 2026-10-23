import { createSignal } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExplorerWorkspace } from './explorer-workspace';
import { MenuRow } from './menu-row';
import { MenuSection } from './menu-section';

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
