import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { For, type JSX } from 'solid-js';
import { ContentPackItem } from './content-pack-item';
import type { useContentPackEdit } from './use-content-pack-edit';

type Tools = ReturnType<typeof useContentPackEdit>;

/** The pack's puzzles, in order, each moving one place at a time. */
export function ContentPackItems(props: {
  ids: readonly string[];
  tools: Tools;
  disabled: boolean;
  onRemove: (id: string) => void;
}): JSX.Element {
  const up = (id: string): void => {
    const beforeId = props.ids[props.ids.indexOf(id) - 1];
    if (beforeId !== undefined)
      props.tools.execute({ kind: 'move', puzzleId: id, beforeId });
  };
  const down = (id: string): void => {
    const next = props.ids[props.ids.indexOf(id) + 1];
    if (next !== undefined)
      props.tools.execute({ kind: 'move', puzzleId: next, beforeId: id });
  };
  return (
    <For each={props.ids}>
      {(id, index) => (
        <ContentPackItem
          id={id}
          first={index() === 0}
          last={index() === props.ids.length - 1}
          disabled={props.disabled || props.tools.change.loading()}
          onUp={() => up(id)}
          onDown={() => down(id)}
          onRemove={() => props.onRemove(id)}
        />
      )}
    </For>
  );
}

/** Taking a puzzle out of the working pack asks first. */
export function ContentPackRemoval(props: {
  puzzleId: string | null;
  tools: Tools;
  onClose: () => void;
}): JSX.Element {
  const removePuzzle = async (): Promise<void> => {
    const id = props.puzzleId;
    if (id !== null) await props.tools.run({ kind: 'remove', puzzleId: id });
  };
  return (
    <MutationModal
      visible={props.puzzleId !== null}
      onClose={() => props.onClose()}
      title={<Trans>Remove this puzzle from the pack?</Trans>}
      message={
        <Trans>
          The puzzle stays available on its own. Published pack editions keep
          their contents.
        </Trans>
      }
      submitLabel={<Trans>Remove from pack</Trans>}
      variant="destructive"
      successTitle={<Trans>Puzzle removed from the working pack</Trans>}
      operation={removePuzzle}
    />
  );
}
