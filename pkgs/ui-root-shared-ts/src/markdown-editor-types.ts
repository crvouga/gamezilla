import type { ComponentDataSet } from './component-id';

export type MarkdownEditorCommand = {
  id: string;
  label: string;
  description: string;
  aliases?: readonly string[];
  body: string;
};

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  maxLength?: number;
  commands?: readonly MarkdownEditorCommand[];
  onCommand?: (id: string) => void;
  onSubmit?: () => void;
  dataSet?: ComponentDataSet;
};
