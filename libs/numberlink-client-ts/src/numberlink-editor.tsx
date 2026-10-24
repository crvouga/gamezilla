import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import type { EndpointPair } from '@libs/numberlink-shared-ts/numberlink-types';
import { PAIR_COLORS } from '@libs/numberlink-shared-ts/numberlink-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { NumberStepper } from '@pkgs/ui-root-client-ts/number-stepper';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX, Show } from 'solid-js';
import { NumberlinkBoard } from './numberlink-board';
import { useNumberlinkEditor } from './use-numberlink-editor';

type Editor = ReturnType<typeof useNumberlinkEditor>;

function PairTools(props: {
  editor: Editor;
  pair: EndpointPair;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const names = () => ({
    red: t`Red`,
    orange: t`Orange`,
    yellow: t`Yellow`,
    green: t`Green`,
    blue: t`Blue`,
    purple: t`Purple`,
  });
  return (
    <StackVertical gap="md">
      <TextInput
        label={t`Pair label`}
        value={props.pair.label}
        maxLength={8}
        disabled={props.disabled}
        onChangeText={(label) =>
          props.editor.editPair({ ...props.pair, label })
        }
        dataSet={{ testid: 'numberlink-pair-label' }}
      />
      <Select
        label={t`Pair color`}
        options={PAIR_COLORS.map((color) => ({
          value: color,
          label: names()[color],
        }))}
        value={props.pair.color}
        disabled={props.disabled}
        onValueChange={(color) =>
          props.editor.editPair({ ...props.pair, color })
        }
      />
      <StackHorizontal gap="sm">
        <Button
          title={t`Move first endpoint`}
          dataSet={{ testid: 'numberlink-move-first' }}
          aria-pressed={props.editor.endpoint() === 0}
          disabled={props.disabled}
          onClick={() => props.editor.setEndpoint(0)}
        />
        <Button
          title={t`Move second endpoint`}
          dataSet={{ testid: 'numberlink-move-second' }}
          aria-pressed={props.editor.endpoint() === 1}
          disabled={props.disabled}
          onClick={() => props.editor.setEndpoint(1)}
        />
      </StackHorizontal>
    </StackVertical>
  );
}

function RemoveEndpoints(props: {
  editor: Editor;
  disabled: boolean;
}): JSX.Element {
  const [operation, setOperation] = createSignal<
    { kind: 'pair'; id: string } | { kind: 'all' } | null
  >(null);
  return (
    <>
      <StackHorizontal gap="sm">
        <Button
          title={<Trans>Remove pair</Trans>}
          disabled={props.disabled || props.editor.pair() === undefined}
          onClick={() =>
            setOperation({ kind: 'pair', id: props.editor.selected() })
          }
          intent="neutral"
          variant="outline"
        />
        <Button
          title={<Trans>Clear endpoints</Trans>}
          disabled={props.disabled || props.editor.board()?.pairs.length === 0}
          onClick={() => setOperation({ kind: 'all' })}
          intent="neutral"
          variant="outline"
        />
      </StackHorizontal>
      <MutationModal
        visible={operation() !== null}
        onClose={() => setOperation(null)}
        title={
          operation()?.kind === 'pair' ? (
            <Trans>Remove this pair?</Trans>
          ) : (
            <Trans>Clear every endpoint?</Trans>
          )
        }
        message={
          <Trans>
            This changes your working draft. Published editions keep their
            endpoints.
          </Trans>
        }
        submitLabel={<Trans>Remove endpoints</Trans>}
        variant="destructive"
        successTitle={<Trans>Endpoints removed</Trans>}
        operation={() => {
          const pending = operation();
          if (pending?.kind === 'pair') props.editor.remove(pending.id);
          else if (pending?.kind === 'all') props.editor.clear();
          return Promise.resolve();
        }}
      />
    </>
  );
}

/** Shared authoring owns saving, history, validation, playtesting and publication. */
export function NumberlinkEditor(props: PuzzleEditorProps): JSX.Element {
  const { t } = useLingui();
  const editor = useNumberlinkEditor(props);
  return (
    <Show
      when={editor.board()}
      fallback={
        <Notice tone="error">
          <Trans>
            This drawing cannot be opened. Choose an earlier saved draft to
            continue editing.
          </Trans>
        </Notice>
      }
    >
      {(board) => (
        <StackVertical gap="lg">
          <NumberStepper
            label={t`Columns`}
            dataSet={{ testid: 'numberlink-columns' }}
            value={board().width}
            min={2}
            max={20}
            disabled={props.disabled}
            onChange={(n) => editor.resize('width', n)}
          />
          <NumberStepper
            label={t`Rows`}
            dataSet={{ testid: 'numberlink-rows' }}
            value={board().height}
            min={2}
            max={20}
            disabled={props.disabled}
            onChange={(n) => editor.resize('height', n)}
          />
          <Select
            label={t`Coverage`}
            value={board().coverage}
            disabled={props.disabled}
            options={[
              { value: 'all' as const, label: t`Cover every cell` },
              { value: 'pairs' as const, label: t`Connect pairs only` },
            ]}
            onValueChange={(coverage) =>
              editor.change({ ...board(), coverage }, '')
            }
          />
          <NumberlinkBoard
            definition={board()}
            state={{ paths: [] }}
            disabled={props.disabled}
            onActivate={editor.place}
          />
          <P variant="caption" tone="secondary">
            <Trans>
              Choose a pair and which endpoint to move, then choose an empty
              cell. Every pair has a label as well as a color.
            </Trans>
          </P>
          <Show when={editor.error()}>
            {(error) => <Notice tone="error">{error()}</Notice>}
          </Show>
          <Show when={board().pairs.length > 0}>
            <Select
              label={t`Pair`}
              value={editor.selected()}
              options={board().pairs.map((pair) => ({
                value: pair.id,
                label: pair.label,
              }))}
              disabled={props.disabled}
              onValueChange={editor.setSelected}
            />
          </Show>
          <Show when={editor.pair()}>
            {(pair) => (
              <PairTools
                editor={editor}
                pair={pair()}
                disabled={props.disabled}
              />
            )}
          </Show>
          <Button
            title={t`Add pair`}
            disabled={props.disabled}
            onClick={editor.add}
          />
          <RemoveEndpoints editor={editor} disabled={props.disabled} />
        </StackVertical>
      )}
    </Show>
  );
}
