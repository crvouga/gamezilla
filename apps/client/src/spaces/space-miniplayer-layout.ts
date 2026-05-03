export function isSpaceMiniplayerHidden(args: {
  rawPath: string;
  currentLoading: boolean;
  activeSpaceId: string | null;
  spaceLoading: boolean;
}): boolean {
  if (args.rawPath.startsWith('/space/')) return true;
  if (args.currentLoading) return true;
  if (!args.activeSpaceId) return true;
  return args.spaceLoading;
}
