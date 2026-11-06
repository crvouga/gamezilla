import type { AvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Avatar, avatarInitials } from '@pkgs/ui-root-client-ts/avatar';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { ProfileDiceBearAvatar } from './public-profile-dicebear-avatar';

export type DeviceAvatarProps = {
  avatarConfig: AvatarConfig | null;
  /** Profile or member `entityId` for legacy empty `config.seed` only. */
  seedFallback: string;
  size: number;
  /**
   * The name others see, when known. Without a persisted avatar the face
   * shows its initials on a plate tinted by `seedFallback`, so people without
   * pictures still read apart.
   */
  name?: string | null | undefined;
  /**
   * Empty placeholder only: frosted light plate + light person
   * glyph for vivid backgrounds (e.g. space card), matching other
   * chrome on that surface.
   */
  vividBackdrop?: boolean | undefined;
};

/**
 * Renders a profile avatar: without a persisted config (e.g. not synced) the
 * person's tinted initials when `name` is known, else the person
 * placeholder; otherwise the persisted DiceBear avatar. Uses
 * `seedFallback` only when persisted config has an empty legacy seed.
 */
export function DeviceAvatar(props: DeviceAvatarProps): JSX.Element {
  const initials = (): string | undefined => {
    const letters = avatarInitials(props.name ?? '');
    return letters.length > 0 ? letters : undefined;
  };
  return (
    <Show
      when={props.avatarConfig}
      keyed
      fallback={
        <Show
          when={props.vividBackdrop}
          fallback={
            <Avatar
              size={props.size}
              initials={initials()}
              tintKey={props.seedFallback}
            />
          }
        >
          <Avatar
            size={props.size}
            initials={initials()}
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
