import { Button } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

/** Back button atom for the space join screen. */
export function SpaceBackButton(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <Button title={t`Back`} intent="neutral" onPress={() => router.back()} />
  );
}
