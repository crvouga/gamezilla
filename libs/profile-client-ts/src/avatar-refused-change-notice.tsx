import { RefusedChangeNotice } from '@libs/app-root-client-ts/refused-change-notice';
import { patchAvatarMutation } from '@libs/profile-shared-ts/patch-avatar-mutation';
import type { JSX } from 'solid-js';

const AVATAR_CHANGES: readonly string[] = [patchAvatarMutation.name];

/** A refused avatar change, inline on the profile and the avatar editor. */
export function AvatarRefusedChangeNotice(): JSX.Element {
  return <RefusedChangeNotice mutations={AVATAR_CHANGES} />;
}
