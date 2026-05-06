import { SpaceSessionMemberRailInner } from './space-session-member-rail';
import type { SpaceMemberRow } from './types';
import type { MemberPresenceFlags } from './use-member-presence-flags';
import {
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalRoot,
  ScrollView,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export type SpaceMembersListModalProps = {
  visible: boolean;
  onClose: () => void;
  host: SpaceMemberRow | null;
  guests: SpaceMemberRow[];
  flags: Map<string, MemberPresenceFlags>;
};

export function SpaceMembersListModal({
  visible,
  onClose,
  host,
  guests,
  flags,
}: SpaceMembersListModalProps) {
  const { t } = useLingui();

  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <ModalBackdrop onPress={onClose}>
        <ModalContent>
          <ModalHeader title={t`People in this space`} />
          <ScrollView style={{ maxHeight: 420 }}>
            <SpaceSessionMemberRailInner
              host={host}
              guests={guests}
              flags={flags}
            />
          </ScrollView>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
