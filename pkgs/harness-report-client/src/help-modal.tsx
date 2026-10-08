import { useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client/badge';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { ModalBackdrop } from '@pkgs/ui-root-client/modal-backdrop';
import { ModalContent } from '@pkgs/ui-root-client/modal-content';
import {
  ModalButton,
  ModalFooter,
  ModalHeader,
} from '@pkgs/ui-root-client/modal-parts';
import { ModalRoot } from '@pkgs/ui-root-client/modal-root';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { For } from 'solid-js';

const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['⌘ K / Ctrl K', 'Open command palette'],
  ['← / →', 'Previous / next frame'],
  ['↑ / ↓', 'Previous / next step'],
  ['N / Shift N', 'Next / previous failure'],
  ['Home / End', 'First / last frame'],
  ['Space', 'Play / pause scrubbing'],
  ['[ / ]', 'Previous / next test'],
  ['1–9', 'Focus client panel'],
  ['M', 'All clients / focused client'],
  ['A', 'Toggle state panel'],
  ['P', 'Toggle press highlight'],
  ['F', 'Cycle zoom (fit → 50 → 75 → 100)'],
  ['?', 'Toggle this help'],
  ['Esc', 'Back to test list / close help'],
];

export function HelpModal(props: { onClose: () => void }) {
  const { t } = useLingui();
  return (
    <ModalRoot visible onRequestClose={props.onClose}>
      <ModalBackdrop onClick={props.onClose}>
        <ModalContent size="medium">
          <ModalHeader title={t`Keyboard shortcuts`} />
          <ScrollView>
            <MenuSection>
              <For each={SHORTCUTS}>
                {([key, description]) => (
                  <MenuRow
                    title={description}
                    trailing={<Badge label={key} intent="neutral" />}
                  />
                )}
              </For>
            </MenuSection>
          </ScrollView>
          <ModalFooter>
            <ModalButton
              label={t`Close`}
              variant="cancel"
              onClick={props.onClose}
            />
          </ModalFooter>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
