import type { JSX } from 'solid-js';
import { FriendsPlayingNowView, usePlayingRooms } from './friends-playing-now';
import { useFriends } from './use-friends';

/**
 * Fills the profile's playing slot from synced friends and live spaces:
 * the rooms friends are in right now, each once, with Join.
 */
export function ProfileFriendsPlaying(): JSX.Element {
  const friendsState = useFriends();
  const rooms = usePlayingRooms(friendsState.friends);
  return <FriendsPlayingNowView rooms={rooms()} />;
}
