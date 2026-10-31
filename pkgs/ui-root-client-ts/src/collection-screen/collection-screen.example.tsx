import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client-ts/screen-body-scroll-view';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, For, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

const PEOPLE = [
  'Alex',
  'Robin',
  'Morgan',
  'Sam',
  'Taylor',
  'Casey',
  'Jordan',
  'Avery',
];
export default function CollectionScreenExample(): JSX.Element {
  const [query, setQuery] = createSignal('');
  const people = () =>
    PEOPLE.filter((name) => name.toLowerCase().includes(query().toLowerCase()));
  return (
    <ScreenExampleFrame>
      <CollectionScreen
        screenId="example-collection"
        breadcrumbs={[{ name: 'People' }]}
        controls={
          <TextInput
            label="Find people"
            value={query()}
            onChangeText={setQuery}
          />
        }
      >
        <ScreenBodyScrollView>
          <MenuList>
            <For
              each={people()}
              fallback={
                <EmptyState title="No people found" body="Try another name." />
              }
            >
              {(name) => <MenuRow title={name} caption="Available to play" />}
            </For>
          </MenuList>
        </ScreenBodyScrollView>
      </CollectionScreen>
    </ScreenExampleFrame>
  );
}
