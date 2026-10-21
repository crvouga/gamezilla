import type { AvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { ProfileDiceBearAvatar } from './public-profile-dicebear-avatar';

export type DeviceAvatarProps = {
  avatarConfig: AvatarConfig | null;
  /** Profile or member `entityId` for legacy empty `config.seed` only. */
  seedFallback: string;
  size: number;
  /**
   * Empty placeholder only: frosted light plate + light person
   * glyph for vivid backgrounds (e.g. space card), matching other
   * chrome on that surface.
   */
  vividBackdrop?: boolean | undefined;
};

/**
 * Renders a profile avatar: the person placeholder when there is no persisted
 * config (e.g. not synced); otherwise the persisted DiceBear avatar. Uses
 * `seedFallback` only when persisted config has an empty legacy seed.
 */
export function DeviceAvatar(props: DeviceAvatarProps): JSX.Element {
  return (
    <Show
      when={props.avatarConfig}
      keyed
      fallback={
        <Show
          when={props.vividBackdrop}
          fallback={<Avatar size={props.size} />}
        >
          <Avatar
            size={props.size}
            background="onTintScrim"
            foreground="onPrimary"
          />
        </Show>
      }
    >
      {(config) => (
        <ProfileDiceBearAvatar
          config={config}
          fallbackSeed={props.seedFallback}
          size={props.size}
        />
      )}
    </Show>
  );
}
