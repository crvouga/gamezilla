import {
  type ComponentDataSet,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { FileIcon } from '../icons';
import styles from './file-picker.module.css';

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
 * optional hint. The native file input stays in the tab order, unseen
 * under the row, so the keyboard and screen readers reach it by its label;
 * its ring is drawn on the row. The caller owns the chosen name, so the
 * field never contradicts what the screen says was chosen.
 */
export function FilePicker(props: FilePickerProps): JSX.Element {
  const labelId = createUniqueId();
  const hintId = createUniqueId();
  return (
    <label
      class="box gap-2"
      aria-disabled={props.disabled ?? false}
      {...dataAttrs({ component: 'FilePicker', ...props.dataSet })}
    >
      <span id={labelId} class="text textLabel">
        {props.label}
      </span>
      <span
        class={styles['field']}
        classList={{ [styles['empty'] ?? '']: props.fileName === null }}
      >
        <input
          type="file"
          accept={props.accept}
          disabled={props.disabled}
          class={styles['input']}
          aria-labelledby={labelId}
          aria-describedby={props.hint === undefined ? undefined : hintId}
          onChange={(event) =>
            props.onSelect(event.currentTarget.files?.[0] ?? null)
          }
        />
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
      </span>
      <Show when={props.hint !== undefined}>
        <span id={hintId} class="text textCaption">
          {props.hint}
        </span>
      </Show>
    </label>
  );
}
