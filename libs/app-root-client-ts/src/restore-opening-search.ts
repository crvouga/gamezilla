/** Carry the unfinished search into the mounted form before its first interaction. */
export function restoreOpeningSearch(
  opening: HTMLElement,
  root: HTMLElement,
  focused: Element | null
): boolean {
  const selector = 'input[name="people-search"]';
  const draft = opening.querySelector<HTMLInputElement>(selector);
  const field = root.querySelector<HTMLInputElement>(selector);
  if (!draft || !field) return false;

  if (field.value !== draft.value) {
    field.value = draft.value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (focused !== draft) return false;
  field.focus({ preventScroll: true });
  field.setSelectionRange(
    draft.selectionStart,
    draft.selectionEnd,
    draft.selectionDirection ?? 'none'
  );
  return true;
}
