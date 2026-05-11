import { SkiaWebRoot } from '@gamezilla/client/ui/skia-web-root';
import type { ReactNode } from 'react';

export function SkiaRootProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <SkiaWebRoot>{children}</SkiaWebRoot>;
}
