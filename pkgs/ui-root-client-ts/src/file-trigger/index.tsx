/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type FileTriggerProps = {
  /** Accessible name of the file input. */
  label: string;
  /** File types the chooser offers (`image/png,video/mp4`). */
  accept: string;
  onSelect: (file: File) => void;
  /** The control that opens the chooser. */
  children: (open: () => void) => JSX.Element;
  /** Rendered as `data-testid` on the file input. */
  testId?: string | undefined;
};

/**
 * `FileTrigger` -- opens the system file chooser from a control of your
 * own (an icon button in a composer, a "Choose photo" button). The native
 * file input stays in the document, out of sight and out of the tab order;
 * `children` is handed `open`, which the control calls on press. A chosen
 * file goes to `onSelect`, and choosing the same file again fires again.
 *
 * For a labelled field that shows the chosen name, use `FilePicker`.
 *
 * @example
 * ```tsx
 * <FileTrigger label={t`Attach a screenshot`} accept="image/*" onSelect={attach}>
 *   {(open) => (
 *     <IconButton label={t`Attach screenshot`} onClick={open}>
 *       <PaperclipIcon size={18} />
 *     </IconButton>
 *   )}
 * </FileTrigger>
 * ```
 */
export function FileTrigger(props: FileTriggerProps): JSX.Element {
  let input: HTMLInputElement | undefined;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={props.accept}
        class="hidden"
        tabIndex={-1}
        aria-label={props.label}
        data-testid={props.testId}
        data-component={componentId('FileTrigger')}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file !== undefined) props.onSelect(file);
          event.currentTarget.value = '';
        }}
      />
      {props.children(() => input?.click())}
    </>
  );
}
