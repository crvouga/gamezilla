/**
 * Wire id for the space collaborative room:
 * - DO adapter: required `module` query param (validated by
 *   {@link assertRoomModuleName} / {@link parseRoomModuleName} in `@pkgs/room`)
 * - Client: {@link SPACE_ROOM_NAME} registry key (`@pkgs/room`)
 *
 * Must match `APP_SPACE_MODULE.name` (see `@libs/app/shared/games`).
 */
export const SPACE_ROOM_MODULE_NAME = 'space' as const;
