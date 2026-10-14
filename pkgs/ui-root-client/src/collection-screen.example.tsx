import { createSignal, For, type JSX } from 'solid-js';
import { CollectionScreen } from './collection-screen';
import { EmptyState } from './empty-state';
import { MenuList } from './menu-list';
import { MenuRow } from './menu-row';
import { ScreenBodyScrollView } from './screen-body-scroll-view';
import { ScreenExampleFrame } from './screen-example-frame';
import { TextInput } from './text-input';

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
