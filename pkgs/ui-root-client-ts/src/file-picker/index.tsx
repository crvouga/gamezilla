import { ariaBoolean } from '@pkgs/ui-root-shared-ts/aria-boolean';
import {
  type ComponentDataSet,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { fileInput } from '@ui-sdk/core/file-input';
import { createParts } from '@ui-sdk/solid/primitive';
import { createUniqueId, Show } from 'solid-js';
import { FileIcon } from '../icons';
import styles from './file-picker.module.css';

const FileParts = createParts(fileInput, {
  root: 'div',
  input: 'input',
  trigger: 'button',
});

export type FilePickerProps = {
  label: JSX.Element;
  accept: string;
  /** The chooser's own words (`Choose file`). */
  chooseLabel: string;
  /** The chosen file's name; `null` shows `emptyLabel`. */
  fileName: string | null;
  /** What the field says before a file is chosen (`No file chosen`). */
  emptyLabel: string;
  /** One quiet line under the field: which files it takes. */
  hint?: JSX.Element;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
  dataSet?: ComponentDataSet;
  /** `data-*` identifiers on the chosen file's name, shown once chosen. */
  fileDataSet?: ComponentDataSet;
};

/**
 * A labelled field for choosing one file: a "Choose file" control and the
 * chosen file's name (or what is missing) in one bordered row, then an
 * optional hint. The labelled button opens the native chooser and displays
 * the caller’s chosen file name.
 */
export function FilePicker(props: FilePickerProps): JSX.Element {
  const triggerId = createUniqueId();
  const hintId = createUniqueId();
  return (
    <FileParts.Root
      disabled={props.disabled === true}
      onValueChange={(files) => props.onSelect(files[0] ?? null)}
      class="box gap-2"
      aria-disabled={ariaBoolean(props.disabled ?? false)}
      {...dataAttrs({ component: 'FilePicker', ...props.dataSet })}
    >
      <FileParts.Input accept={props.accept} />
      <label for={triggerId} class="text textLabel">
        {props.label}
      </label>
      <FileParts.Trigger
        id={triggerId}
        aria-describedby={props.hint === undefined ? undefined : hintId}
        class={[
          styles['field'],
          { [styles['empty'] ?? '']: props.fileName === null },
        ]}
      >
        <span class={styles['choose']} aria-hidden="true">
          {props.chooseLabel}
        </span>
        <span class={styles['name']}>
          <FileIcon size={16} color="secondary" />
          <span
            class={styles['nameText']}
            {...(props.fileName === null
              ? {}
              : dataAttrs({
                  component: 'FilePickerName',
                  ...props.fileDataSet,
                }))}
          >
            {props.fileName ?? props.emptyLabel}
          </span>
        </span>
      </FileParts.Trigger>
      <Show when={props.hint !== undefined}>
        <span id={hintId} class="text textCaption">
          {props.hint}
        </span>
      </Show>
    </FileParts.Root>
  );
}
