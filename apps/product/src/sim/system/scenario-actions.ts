/**
 * Product scenario actions (pool: false). Explore still uses spawnActor /
 * uiOp / partition; these are named user-intent stimuli for `s.apply`.
 */

import { returnToTabs, signInWithDev, signOut } from './auth-actions';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
} from './chess-actions';
import { acceptFriendRequest, openFriendsList } from './friends-actions';
import {
  leaveAvatarEditor,
  openAvatarEditor,
  openProfileEdit,
  saveAvatar,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
} from './profile-actions';
import { addFriend, searchUsername } from './search-actions';
import { focusActor, openSettings } from './shell-actions';
import {
  createSpace,
  endSpace,
  joinFromPrompt,
  openLobbyCard,
  openSpacesTab,
  reenterActiveSpace,
  returnToLobby,
} from './space-actions';

export {
  acceptFriendRequest,
  addFriend,
  createSpace,
  endSpace,
  focusActor,
  joinFromPrompt,
  leaveAvatarEditor,
  openAvatarEditor,
  openFriendsList,
  openLobbyCard,
  openProfileEdit,
  openPuzzleFromSpace,
  openSettings,
  openSpacesTab,
  playUntilSolved,
  pressPuzzleNext,
  reenterActiveSpace,
  returnToLobby,
  returnToTabs,
  saveAvatar,
  searchUsername,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
  signInWithDev,
  signOut,
};

export const productScenarioActions = [
  openSettings,
  focusActor,
  signInWithDev,
  signOut,
  returnToTabs,
  openSpacesTab,
  createSpace,
  returnToLobby,
  openLobbyCard,
  joinFromPrompt,
  reenterActiveSpace,
  endSpace,
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
  openProfileEdit,
  setUsername,
  openAvatarEditor,
  setAvatarSeed,
  setAvatarStyle,
  saveAvatar,
  leaveAvatarEditor,
  searchUsername,
  addFriend,
  acceptFriendRequest,
  openFriendsList,
];
