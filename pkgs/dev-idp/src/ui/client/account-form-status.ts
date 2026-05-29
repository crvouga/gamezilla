export type PanelStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'error'; readonly message: string };

export function panelStatusState(
  status: PanelStatus
): 'idle' | 'submitting' | 'error' {
  if (status.kind === 'error') return 'error';
  if (status.kind === 'submitting') return 'submitting';
  return 'idle';
}

export function panelStatusText(status: PanelStatus, isEdit: boolean): string {
  if (status.kind === 'submitting') return isEdit ? 'Saving…' : 'Adding…';
  if (status.kind === 'error') return status.message;
  return '';
}
