/** @jsxImportSource solid-js */

import { useProfileScreenSlots } from './profile-screen-slots';
import { ProfileScreen } from './profile-screen';
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
