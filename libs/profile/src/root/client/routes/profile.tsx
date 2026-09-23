/** @jsxImportSource solid-js */

import { useProfileScreenSlots } from '@libs/profile/public/profile-screen-slots';
import { ProfileScreen } from '@libs/profile/root/client/profile-screen';
import { type JSX, Show } from 'solid-js';

export default function ProfileRoute(): JSX.Element {
  const slots = useProfileScreenSlots();
  return (
    <ProfileScreen
      friendsStats={
        <Show when={slots.stats} keyed>
          {(Stats) => <Stats />}
        </Show>
      }
      friendsActions={
        <Show when={slots.actions} keyed>
          {(Actions) => <Actions />}
        </Show>
      }
    />
  );
}
