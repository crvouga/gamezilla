/** @jsxImportSource solid-js */

import { type JSX, Show } from 'solid-js';
import { ProfileScreen } from './profile-screen';
import { useProfileScreenSlots } from './profile-screen-slots';

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
