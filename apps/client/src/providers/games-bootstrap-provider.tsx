import { GamesBootstrap } from '@gamezilla/app/client/games-bootstrap';
import type { ReactNode } from 'react';

export function GamesBootstrapProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <GamesBootstrap>{children}</GamesBootstrap>;
}
