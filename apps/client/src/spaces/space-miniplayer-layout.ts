export function isSpaceMiniplayerHidden(args: {
  rawPath: string;
  activeSpaceId: string | null;
}): boolean {
  return args.rawPath.startsWith('/space/') || !args.activeSpaceId;
}
