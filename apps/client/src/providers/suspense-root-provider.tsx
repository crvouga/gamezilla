import { Box, Spinner } from '@pkgs/ui';
import { Suspense, type ReactNode } from 'react';

export function SuspenseRootProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner />
        </Box>
      }
    >
      {children}
    </Suspense>
  );
}
