/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import { createSignal, onMount } from 'solid-js';
import { Button } from '../button/index';
import { safeMarkdownHref } from '../safe-markdown';
import { TextInput } from '../text-input/index';

/**
 * Focused link entry for MarkdownEditor. Accepts only safe Markdown URLs; Enter saves a valid URL and Escape cancels without changing the document.
 */
export function EditorLinkForm(props: {
  onSave: (href: string) => void;
  onCancel: () => void;
}) {
  const [href, setHref] = createSignal('');
  let host: HTMLDivElement | undefined;
  onMount(() => host?.querySelector('input')?.focus());
  const valid = () => safeMarkdownHref(href());
  return (
    <div
      ref={host}
      class="box flex-row gap-2 items-center shrink-0 p-2"
      role="group"
      aria-label="Insert link"
    >
      <TextInput
        aria-label={asLocalized('Link address')}
        placeholder={asLocalized('https://…')}
        value={href()}
        onChangeText={setHref}
        grow
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            props.onCancel();
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (valid()) props.onSave(href());
          }
        }}
      />
      <Button
        title="Apply"
        size="sm"
        disabled={!valid()}
        onClick={() => props.onSave(href())}
      />
      <Button
        title="Cancel"
        size="sm"
        variant="ghost"
        onClick={props.onCancel}
      />
    </div>
  );
}
