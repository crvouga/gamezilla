export type SpaceFilter = 'all' | 'live';

/** UI row for the spaces list (from patch-db entities + resolved host label). */
export type SpaceView = {
  id: string;
  title: string;
  hostId: string;
  hostDisplayName: string;
  live: boolean;
};

export type SpaceMemberRow = {
  principalId: string;
  displayName: string;
  role: 'host' | 'guest';
};
