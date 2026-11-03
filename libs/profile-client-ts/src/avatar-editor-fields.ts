import type { AvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import type { SchemaField } from '@libs/profile-shared-ts/dicebear-schema';
import { getFieldsByTab } from '@libs/profile-shared-ts/dicebear-schema';
import type { StyleKey } from '@libs/profile-shared-ts/dicebear-styles';
import { isStyleKey } from '@libs/profile-shared-ts/dicebear-styles';

export type AvatarEnumField = Extract<SchemaField, { kind: 'enum' }>;
export type AvatarColorField = Extract<SchemaField, { kind: 'color' }>;

/** The draft's style, or the default look when it names none we know. */
export function avatarStyleKey(draft: AvatarConfig): StyleKey {
  return isStyleKey(draft.style) ? draft.style : 'funEmoji';
}

/** The trait pickers and background color pickers a style offers. */
export function avatarEditorFields(styleKey: StyleKey): {
  readonly featureEnums: AvatarEnumField[];
  readonly colorFields: AvatarColorField[];
} {
  const byTab = getFieldsByTab(styleKey);
  return {
    featureEnums: byTab.features.filter(
      (f): f is AvatarEnumField => f.kind === 'enum'
    ),
    colorFields: byTab.colors.filter(
      (f): f is AvatarColorField =>
        f.kind === 'color' && f.key === 'backgroundColor'
    ),
  };
}
