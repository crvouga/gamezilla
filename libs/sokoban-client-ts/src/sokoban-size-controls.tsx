import type { SokobanBoard } from '@libs/sokoban-shared-ts/sokoban-types';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createEffect, createSignal, type JSX } from 'solid-js';

/** Resizing can remove pieces, so a new size applies only when chosen. */
export function SokobanSizeControls(props: {
  board: SokobanBoard;
  disabled: boolean;
  onResize: (columns: number, rows: number) => void;
}): JSX.Element {
  const { t } = useLingui();
  const [columns, setColumns] = createSignal('');
  const [rows, setRows] = createSignal('');
  createEffect(() => {
    setColumns(String(props.board.width));
    setRows(String(props.board.height));
  });
  const whole = (text: string): number =>
    /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  return (
    <StackHorizontal gap="sm" wrap align="end">
      <TextInput
        label={t`Columns`}
        inputMode="numeric"
        value={columns()}
        maxLength={3}
        disabled={props.disabled}
        onChangeText={setColumns}
        dataSet={{ testid: 'sokoban-columns' }}
      />
      <TextInput
        label={t`Rows`}
        inputMode="numeric"
        value={rows()}
        maxLength={3}
        disabled={props.disabled}
        onChangeText={setRows}
        dataSet={{ testid: 'sokoban-rows' }}
      />
      <Button
        title={t`Change size`}
        intent="neutral"
        variant="outline"
        disabled={props.disabled}
        onClick={() => props.onResize(whole(columns()), whole(rows()))}
        dataSet={{ testid: 'sokoban-resize' }}
      />
    </StackHorizontal>
  );
}
