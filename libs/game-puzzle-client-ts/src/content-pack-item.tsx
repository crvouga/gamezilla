import { workingContentDraft } from '@libs/game-puzzle-shared-ts/content-library';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

export function ContentPackItem(props: {
  id: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const document = () =>
    data.content().documents.find((entry) => entry.id === props.id);
  const draft = () => workingContentDraft(data.content(), props.id);
  const revision = () =>
    data
      .content()
      .revisions.find(
        (entry) => entry.id === document()?.published_revision_id
      );
  const title = () =>
    (draft()?.title ?? revision()?.title ?? '') || t`Unavailable puzzle`;
  const decision = useDecision(PERMISSION.puzzlesEditContent, () => ({
    puzzleOwnerId: document()?.owner_id ?? '',
  }));
  const open = (): void => {
    if (decision().allowed) game.open({ kind: 'edit', documentId: props.id });
    else {
      const id = revision()?.id;
      if (id !== undefined)
        game.open({ kind: 'edition', revisionId: id, packRevisionId: null });
    }
  };
  return (
    <MenuRow
      title={
        <Button
          title={title()}
          intent="neutral"
          variant="ghost"
          onClick={open}
          disabled={!decision().allowed && revision() === undefined}
        />
      }
      caption={
        draft()?.validation_status === 'invalid'
          ? t`Needs corrections`
          : document()?.status === 'published'
            ? t`Published`
            : t`Draft: publish this puzzle before publishing the pack`
      }
      trailing={
        <StackHorizontal gap="xs">
          <IconButton
            size={32}
            tooltip="none"
            label={t`Move ${title()} up`}
            aria-label={t`Move ${title()} up`}
            disabled={props.disabled || props.first}
            onClick={() => props.onUp()}
            dataSet={{ testid: 'content-pack-up' }}
          >
            <ChevronUpIcon size={20} color="icon" />
          </IconButton>
          <IconButton
            size={32}
            tooltip="none"
            label={t`Move ${title()} down`}
            aria-label={t`Move ${title()} down`}
            disabled={props.disabled || props.last}
            onClick={() => props.onDown()}
            dataSet={{ testid: 'content-pack-down' }}
          >
            <ChevronDownIcon size={20} color="icon" />
          </IconButton>
          <IconButton
            size={32}
            tooltip="none"
            label={t`Remove ${title()} from pack`}
            aria-label={t`Remove ${title()} from pack`}
            disabled={props.disabled}
            onClick={() => props.onRemove()}
            dataSet={{ testid: 'content-pack-remove' }}
          >
            <Trash2Icon size={20} color="icon" />
          </IconButton>
        </StackHorizontal>
      }
      dataSet={{ testid: `content-pack-item-${props.id}` }}
    />
  );
}
