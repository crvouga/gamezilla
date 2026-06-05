import { useSpaceActions } from './lifecycle/space-actions';
import { FloatingActionButton, useMutationButton } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useRef, type ReactNode } from 'react';

export function CreateSpaceFloatingAction(): ReactNode {
  const router = useRouter();
  const { createSpaceAsync } = useSpaceActions();
  const { t } = useLingui();
  const createdIdRef = useRef<string | null>(null);
  const create = useMutationButton({
    operation: useCallback(async () => {
      createdIdRef.current = await createSpaceAsync();
    }, [createSpaceAsync]),
    labels: {
      idle: t`New space`,
      loading: t`Creating…`,
      success: t`Created`,
      error: t`Couldn't create space`,
    },
    onSuccess: useCallback(() => {
      const id = createdIdRef.current;
      if (id !== null) {
        router.push({ pathname: '/space/[id]', params: { id } });
      }
    }, [router]),
    successHoldMs: 0,
  });

  return <FloatingActionButton {...create.fabProps} />;
}
