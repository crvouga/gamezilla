import { Avatar } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type { AvatarConfig } from '../../../shared/profile/avatar-config';
import { resolveAvatarSeed } from '../../../shared/profile/avatar-config';

import { profileAvatarSvg } from '../../../shared/profile/profile-dicebear';

export type ProfileDiceBearAvatarProps = {
  config: AvatarConfig;
  /** Profile or host `entityId` when `config.seed` is empty (legacy / in-editor). */
  fallbackSeed?: string | undefined;
  size: number;
};

/**
 * Generates a DiceBear SVG from a stored {@link AvatarConfig} and renders
 * it inside the generic {@link Avatar} primitive.
 */
export function ProfileDiceBearAvatar(
  props: ProfileDiceBearAvatarProps
): JSX.Element {
  const svg = createMemo(() =>
    profileAvatarSvg(
      {
        style: props.config.style,
        seed: resolveAvatarSeed(props.config, props.fallbackSeed ?? ''),
        options: props.config.options,
      },
      props.size
    )
  );
  return <Avatar size={props.size} background="surface" svg={svg()} />;
}
