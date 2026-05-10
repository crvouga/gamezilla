import { StylePickerStrip } from './avatar-editor-style-picker-strip';
import { styleLabel, type StyleKey } from './dicebear-styles';
import type { AvatarConfig } from '../shared/avatar-config';
import { ResponsiveSurface, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';

import { TriggerRow } from './avatar-editor-trigger-row';

export function StyleBlock({
  styleKey,
  draft,
  seedFallback,
  setDraft,
  surface,
  setSurface,
  closeSurface,
}: {
  styleKey: StyleKey;
  draft: AvatarConfig;
  seedFallback: string;
  setDraft: (fn: (d: AvatarConfig) => AvatarConfig) => void;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  const { t } = useLingui();
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
        title={t`Choose style`}
      >
        <StylePickerStrip
          selected={styleKey}
          seed={draft.seed.trim() || seedFallback}
          seedFallback={seedFallback}
          onSelect={(k) => {
            setDraft((d) => ({ ...d, style: k, options: {} }));
            closeSurface();
          }}
        />
      </ResponsiveSurface>
    </>
  );
}
