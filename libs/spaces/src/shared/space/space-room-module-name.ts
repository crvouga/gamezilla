/**
 * Wire id for the space collaborative room:
 * - DO adapter: required `module` query param (validated by
 *   {@link assertRoomModuleName} / {@link parseRoomModuleName} in `@pkgs/room`)
 * - Client: {@link SPACE_ROOM_NAME} registry key (`@pkgs/room`)
 *
 * Used as the `name` of the composed space module built by
 * `composeSpaceRoomModule` in `@libs/spaces/shared/load-game-plugins`.
 */
export const SPACE_ROOM_MODULE_NAME = 'space' as const;
