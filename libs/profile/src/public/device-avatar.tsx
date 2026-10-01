import { Avatar, UserIcon } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { lazy, Show, Suspense } from 'solid-js';
import type { AvatarConfig } from './avatar-config';

/**
 * DiceBear stays off the shell entry graph — load only when a persisted
 * avatar config exists (see README.md).
 */
const ProfileDiceBearAvatar = lazy(async () => {
  const mod = await import('./profile-dicebear-avatar');
  return { default: mod.ProfileDiceBearAvatar };
});

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
 * Renders a profile avatar: generic user silhouette when there is no persisted
 * config (e.g. not synced); otherwise the persisted DiceBear avatar. Uses
 * `seedFallback` only when persisted config has an empty legacy seed.
 */
export function DeviceAvatar(props: DeviceAvatarProps): JSX.Element {
  return (
    <Show
      when={props.avatarConfig}
      keyed
      fallback={
        <Avatar
          size={props.size}
          icon={UserIcon}
          background={props.vividBackdrop ? 'onTintScrim' : 'outline'}
          foreground={props.vividBackdrop ? 'onPrimary' : 'tabIconDefault'}
        />
      }
    >
      {(config) => (
        <Suspense
          fallback={
            <Avatar
              size={props.size}
              icon={UserIcon}
              background={props.vividBackdrop ? 'onTintScrim' : 'outline'}
              foreground={props.vividBackdrop ? 'onPrimary' : 'tabIconDefault'}
            />
          }
        >
          <ProfileDiceBearAvatar
            config={config}
            fallbackSeed={props.seedFallback}
            size={props.size}
          />
        </Suspense>
      )}
    </Show>
  );
}
