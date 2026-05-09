import {
  SPACE_ROOM_NAME,
  type RoomCommandPayload,
  type RoomState,
  useRoomDispatch,
  useRoomSelector,
} from '@gamezilla/room';

export { SPACE_ROOM_NAME } from '@gamezilla/room';

/**
 * Select from the default space room (`{@link SPACE_ROOM_NAME}`).
 */
export function useSpaceSelector<R>(selector: (state: RoomState) => R): R {
  return useRoomSelector(SPACE_ROOM_NAME, selector);
}

/**
 * Dispatch to the default space room (`{@link SPACE_ROOM_NAME}`).
 */
export function useSpaceDispatch(): (payload: RoomCommandPayload) => void {
  return useRoomDispatch(SPACE_ROOM_NAME);
}
