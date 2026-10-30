import {
  type ComponentDataSet,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type FilePickerProps = {
  label: JSX.Element;
  accept: string;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
  dataSet?: ComponentDataSet;
};

/** Native keyboard-accessible file selection using the shared field vocabulary. */
export function FilePicker(props: FilePickerProps): JSX.Element {
  return (
    <label
      class="box gap-2"
      aria-disabled={props.disabled ?? false}
      {...dataAttrs({ component: 'FilePicker', ...props.dataSet })}
    >
      <span class="text textLabel">{props.label}</span>
      <input
        type="file"
        accept={props.accept}
        disabled={props.disabled}
        class="text textBody bg-surface-muted rounded-control p-3 w-full min-w-0"
        onChange={(event) =>
          props.onSelect(event.currentTarget.files?.[0] ?? null)
        }
      />
    </label>
  );
}
