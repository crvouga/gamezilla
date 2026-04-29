import { StylePickerStrip } from '@gamezilla/client/profile/components/style-picker-strip';
import {
  styleLabel,
  type StyleKey,
} from '@gamezilla/client/profile/dicebear-styles';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { ResponsiveSurface, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

import { TriggerRow } from './avatar-editor-trigger-row';

export function StyleBlock({
  styleKey,
  draft,
  principalId,
  setDraft,
  surface,
  setSurface,
  closeSurface,
}: {
  styleKey: StyleKey;
  draft: AvatarConfig;
  principalId: string;
  setDraft: (
    fn: (d: AvatarConfig) => AvatarConfig
  ) => void;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  return (
    <>
      <Text variant="label" sx={{ mt: 2 }} label={<Trans>Style</Trans>} />
      <TriggerRow
        label={<Trans>Avatar style</Trans>}
        value={styleLabel(styleKey)}
        onPress={() => setSurface('style')}
      />
      <ResponsiveSurface
        visible={surface === 'style'}
        onClose={closeSurface}
        title="Choose style"
      >
        <StylePickerStrip
          selected={styleKey}
          seed={draft.seed.trim() || principalId}
          principalId={principalId}
          onSelect={(k) => {
            setDraft((d) => ({ ...d, style: k, options: {} }));
            closeSurface();
          }}
        />
      </ResponsiveSurface>
    </>
  );
}
