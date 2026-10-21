/** @jsxImportSource solid-js */
/**
 * Tells the person, in a short-lived toast, about a change that showed at
 * once on this device and was then refused, so the device undid it (a
 * rename made offline under rules that changed meanwhile, say). Without it
 * the change would just quietly revert; a toast says so without a banner
 * standing over every screen. Each refusal is told once, and acknowledged,
 * here and wherever it is kept, when its toast leaves.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { useUnheardRefusals } from '@pkgs/sync-engine-client/use-unheard-refusals';
import { useToast } from '@pkgs/ui-root-client/toast';
import { createEffect } from 'solid-js';
import { useRefusedChangeCopy } from './refused-change-copy';

export function RefusedChangeNotice(): null {
  const { refusals, acknowledge } = useUnheardRefusals();
  const toast = useToast();
  const copy = useRefusedChangeCopy();
  const told = new Set<string>();
  createEffect(() => {
    for (const refusal of refusals()) {
      if (told.has(refusal.mutationId)) continue;
      told.add(refusal.mutationId);
      toast.show({
        id: `refused-${refusal.mutationId}`,
        message: copy.title(refusal.mutationName),
        description: copy.detail(refusal.code),
        testId: Handles.refusedChange,
        dataSet: {
          mutation: refusal.mutationName ?? '',
          code: refusal.code,
        },
        onClose: () => void acknowledge(refusal),
      });
    }
  });
  return null;
}
