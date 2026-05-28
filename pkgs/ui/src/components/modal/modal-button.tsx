/**
 * `ModalButton` -- action button used inside `ModalFooter`.
 *
 * Backed by the design-system {@link Button} so confirmation modals share
 * the same flat / on-color contract as every other action surface:
 *   - `default`  -> solid primary Button.
 *   - `destructive` -> solid danger Button.
 *   - `cancel`   -> ghost neutral Button.
 *
 * Sized `md` (40pt min-height) so the iOS-style full-width stack stays
 * above the recommended tap target.
 */

import type { ReactNode } from 'react';
import { Button } from '../button';

export type ModalButtonProps = {
  label: ReactNode;
  variant?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
  disabled?: boolean;
};

export function ModalButton({
  label,
  variant = 'default',
  onPress,
  disabled = false,
}: ModalButtonProps) {
  if (variant === 'destructive') {
    return (
      <Button
        title={label}
        intent="danger"
        size="md"
        onPress={onPress}
        disabled={disabled}
      />
    );
  }
  if (variant === 'cancel') {
    return (
      <Button
        title={label}
        intent="neutral"
        variant="ghost"
        size="md"
        onPress={onPress}
        disabled={disabled}
      />
    );
  }
  return (
    <Button
      title={label}
      intent="primary"
      size="md"
      onPress={onPress}
      disabled={disabled}
    />
  );
}
