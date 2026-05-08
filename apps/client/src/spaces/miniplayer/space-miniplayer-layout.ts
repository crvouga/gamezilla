export function isSpaceMiniplayerHidden(args: {
  rawPath: string;
  activeSpaceCount: number;
}): boolean {
  return args.rawPath.startsWith('/space/') || args.activeSpaceCount === 0;
}
